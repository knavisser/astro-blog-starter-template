// Localised liquid displacement of an image that follows the pointer, rendered
// with a small WebGL shader. The marble drifts slowly and constantly; only the
// area along the pointer's recent path distorts and drags, then recovers.
//
// Smoothness: the displacement is driven entirely from the rAF loop off a
// smoothed cursor (not raw pointer events), and pushes are spaced by distance
// travelled — so slow movement stays smooth instead of stuttering. A constant
// background drift means there's always some velocity, so the marble distorts
// as it slides past a still cursor too.

const N = 20; // trail samples summed per fragment

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uCanvasAspect;
uniform float uImgAspect;
uniform float uRadius;
uniform vec2 uDrift;      // global slow scroll
uniform vec2 uMouse;      // smoothed cursor (uv)
uniform vec2 uDriftBlob;  // distortion from the marble sliding past the cursor
uniform vec4 uPts[${N}];  // xy = pos (uv), zw = displacement vector

vec2 coverUv(vec2 uv) {
  vec2 c = uv - 0.5;
  if (uCanvasAspect > uImgAspect) {
    c.y *= uImgAspect / uCanvasAspect;
  } else {
    c.x *= uCanvasAspect / uImgAspect;
  }
  return c + 0.5;
}

float fall(vec2 a, vec2 b) {
  vec2 d = a - b;
  d.x *= uCanvasAspect; // keep the falloff circular on screen
  return exp(-dot(d, d) / (uRadius * uRadius));
}

void main() {
  vec2 disp = uDriftBlob * fall(vUv, uMouse);
  for (int i = 0; i < ${N}; i++) {
    disp += uPts[i].zw * fall(vUv, uPts[i].xy);
  }
  vec2 uv = coverUv(vUv + disp + uDrift);
  vec3 col = texture2D(uTex, uv).rgb;
  col *= 0.85;                                       // brightness
  col = mix(col, col * vec3(0.82, 1.0, 0.7), 0.06); // subtle acid-green tint
  gl_FragColor = vec4(col, 1.0);
}`;

export interface MapDistort {
  pointerMove(clientX: number, clientY: number): void;
  destroy(): void;
}

const NOOP: MapDistort = { pointerMove() {}, destroy() {} };

export function initMapDistort(
  canvas: HTMLCanvasElement,
  imageUrl: string
): MapDistort {
  // alpha:true so if we bail the canvas stays transparent and the CSS map shows
  const gl = canvas.getContext("webgl", { antialias: false, alpha: true });
  if (!gl) return NOOP;

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return NOOP;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uTex = gl.getUniformLocation(prog, "uTex");
  const uCanvasAspect = gl.getUniformLocation(prog, "uCanvasAspect");
  const uImgAspect = gl.getUniformLocation(prog, "uImgAspect");
  const uRadius = gl.getUniformLocation(prog, "uRadius");
  const uDrift = gl.getUniformLocation(prog, "uDrift");
  const uMouse = gl.getUniformLocation(prog, "uMouse");
  const uDriftBlob = gl.getUniformLocation(prog, "uDriftBlob");
  const uPts = gl.getUniformLocation(prog, "uPts");

  let imgAspect = 1;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([20, 18, 16, 255])
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const img = new Image();
  img.onload = () => {
    imgAspect = img.naturalWidth / Math.max(1, img.naturalHeight);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  };
  img.src = imageUrl;

  // ---- tunable feel ----
  const DPR = Math.min(window.devicePixelRatio || 1, 1); // map is soft; cap at 1
  const RADIUS = 0.4; // area of effect around the cursor (smaller = tighter)
  const DECAY = 0.5; // per-frame fade of the drag trail (higher = slower recovery)
  const SPACING = 0.014; // distance between trail samples (smooth pacing)
  const STRENGTH = 0.2; // how far the paint drags
  const DRIFTK = 100; // how strongly the drifting marble distorts past the cursor

  // ---- state ----
  const pts = new Float32Array(N * 4);
  const strength = new Float32Array(N);
  const arr = new Float32Array(N * 4);
  let head = 0;
  let tx = -1, ty = -1; // latest pointer (uv)
  let mx = -1, my = -1; // smoothed cursor
  let pmx = 0, pmy = 0;
  let dist = 0;
  let pDriftX = 0, pDriftY = 0;
  let start = 0;
  let raf = 0;

  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth * DPR));
    const h = Math.max(1, Math.round(canvas.clientHeight * DPR));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl!.viewport(0, 0, canvas.width, canvas.height);
  }

  function pointerMove(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    tx = (clientX - rect.left) / Math.max(1, rect.width);
    ty = 1 - (clientY - rect.top) / Math.max(1, rect.height);
  }

  function frame(t: number) {
    if (!start) start = t;
    const time = (t - start) / 1000;

    // constant slow drift, and its per-frame velocity
    const driftX = Math.sin(time * 0.17) * 0.05;
    const driftY = Math.sin(time * 0.13 + 1.3) * 0.045;
    const dvx = driftX - pDriftX;
    const dvy = driftY - pDriftY;
    pDriftX = driftX;
    pDriftY = driftY;

    // smooth the cursor each frame (decouples from raw event timing) and drop
    // trail samples spaced by distance travelled
    if (tx >= 0) {
      if (mx < 0) {
        mx = tx;
        my = ty;
      }
      pmx = mx;
      pmy = my;
      mx += (tx - mx) * 0.2;
      my += (ty - my) * 0.2;
      const vx = mx - pmx;
      const vy = my - pmy;
      dist += Math.sqrt(vx * vx + vy * vy);
      if (dist >= SPACING) {
        dist = 0;
        pts[head * 4 + 0] = mx;
        pts[head * 4 + 1] = my;
        pts[head * 4 + 2] = vx;
        pts[head * 4 + 3] = vy;
        strength[head] = 1;
        head = (head + 1) % N;
      }
    }

    for (let i = 0; i < N; i++) {
      strength[i] *= DECAY;
      const s = strength[i];
      arr[i * 4 + 0] = pts[i * 4 + 0];
      arr[i * 4 + 1] = pts[i * 4 + 1];
      // negative so the paint drags WITH the pointer
      arr[i * 4 + 2] = pts[i * 4 + 2] * s * -STRENGTH;
      arr[i * 4 + 3] = pts[i * 4 + 3] * s * -STRENGTH;
    }

    resize();
    gl!.useProgram(prog);
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.uniform1i(uTex, 0);
    gl!.uniform1f(uCanvasAspect, canvas.width / Math.max(1, canvas.height));
    gl!.uniform1f(uImgAspect, imgAspect);
    gl!.uniform1f(uRadius, RADIUS);
    gl!.uniform2f(uDrift, driftX, driftY);
    gl!.uniform2f(uMouse, mx < 0 ? -1 : mx, my < 0 ? 0 : my);
    gl!.uniform2f(
      uDriftBlob,
      mx < 0 ? 0 : -dvx * DRIFTK,
      mx < 0 ? 0 : -dvy * DRIFTK
    );
    gl!.uniform4fv(uPts, arr);
    gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function destroy() {
    cancelAnimationFrame(raf);
    gl!.getExtension("WEBGL_lose_context")?.loseContext();
  }

  return { pointerMove, destroy };
}
