import cv2, numpy as np, re

SRC = "/sessions/trusting-modest-fermi/mnt/public/png/badjuju_logo.png"
OUT = "/sessions/trusting-modest-fermi/mnt/outputs/"

img = cv2.imread(SRC, cv2.IMREAD_UNCHANGED)
alpha = img[:,:,3]
mask = (alpha > 128).astype(np.uint8)*255
mask = cv2.medianBlur(mask, 5)
mask = cv2.GaussianBlur(mask, (9,9), 0)
mask = (mask > 127).astype(np.uint8)*255

cnts, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
keep = [c for c in cnts if cv2.contourArea(c) > 300]
keep.sort(key=lambda c:-cv2.contourArea(c))

def catmull(pts):
    n=len(pts)
    d=f"M {pts[0][0]:.1f},{pts[0][1]:.1f} "
    for i in range(n):
        p0=pts[(i-1)%n]; p1=pts[i]; p2=pts[(i+1)%n]; p3=pts[(i+2)%n]
        c1=(p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6)
        c2=(p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6)
        d+=f"C {c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f} "
    return d+"Z"

polys=[]
for idx,c in enumerate(keep):
    peri=cv2.arcLength(c,True)
    # smooth small (eye) contour more aggressively to remove jaggies
    eps = (0.004 if idx>0 else 0.0010)*peri
    ap=cv2.approxPolyDP(c,eps,True).reshape(-1,2).astype(float)
    polys.append(ap)

allpts=np.vstack(polys)
minx,miny=allpts.min(0); maxx,maxy=allpts.max(0)
pad=20
vbx,vby=minx-pad,miny-pad
VBW,VBH=round((maxx-minx)+2*pad),round((maxy-miny)+2*pad)
def shift(p):
    q=p.copy(); q[:,0]-=vbx; q[:,1]-=vby; return q
ds=[catmull(shift(p)) for p in polys]
print("points per contour", [len(p) for p in polys], "viewBox", VBW, VBH)

fill_d=" ".join(ds)

# 1. filled
open(OUT+"badjuju-logo.svg","w").write(
 f'<svg viewBox="0 0 {VBW} {VBH}" xmlns="http://www.w3.org/2000/svg">\n'
 f'  <path fill="#000000" fill-rule="evenodd" d="{fill_d}"/>\n</svg>\n')

# 2. outline only
out=[f'<svg viewBox="0 0 {VBW} {VBH}" xmlns="http://www.w3.org/2000/svg">']
for d in ds:
    out.append(f'  <path fill="none" stroke="#000000" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" d="{d}"/>')
out.append('</svg>')
open(OUT+"badjuju-logo-outline.svg","w").write("\n".join(out)+"\n")

# 3. animated draw-on
paths_anim=""
for i,d in enumerate(ds):
    cls = "stroke p%d"%i
    paths_anim+=f'    <path class="{cls}" pathLength="1" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" d="{d}"/>\n'
fill_path=f'    <path class="fill" fill="currentColor" fill-rule="evenodd" fill-opacity="0" d="{fill_d}"/>\n'

anim=f'''<svg viewBox="0 0 {VBW} {VBH}" xmlns="http://www.w3.org/2000/svg" color="#000000" role="img" aria-label="Bad Juju logo draw-on animation">
  <style>
    .stroke {{ stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 5s ease-in-out infinite; }}
    .p1 {{ animation-delay: .15s; }}
    .fill {{ animation: fillin 5s ease-in-out infinite; }}
    @keyframes draw {{
      0% {{ stroke-dashoffset: 1; }}
      8% {{ stroke-dashoffset: 1; }}
      50% {{ stroke-dashoffset: 0; }}
      92% {{ stroke-dashoffset: 0; }}
      97% {{ stroke-dashoffset: 1; }}
      100% {{ stroke-dashoffset: 1; }}
    }}
    @keyframes fillin {{
      0%, 52% {{ fill-opacity: 0; }}
      70% {{ fill-opacity: 1; }}
      90% {{ fill-opacity: 1; }}
      96% {{ fill-opacity: 0; }}
      100% {{ fill-opacity: 0; }}
    }}
  </style>
{paths_anim}{fill_path}</svg>
'''
open(OUT+"badjuju-logo-animated.svg","w").write(anim)
print("wrote 3 svgs")
