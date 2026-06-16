import cv2, numpy as np

SRC = "/sessions/trusting-modest-fermi/mnt/public/png/badjuju_logo.png"
OUT = "/sessions/trusting-modest-fermi/mnt/outputs/"

img = cv2.imread(SRC, cv2.IMREAD_UNCHANGED)
alpha = img[:,:,3]
mask = (alpha > 128).astype(np.uint8)*255
mask = cv2.medianBlur(mask, 5)
mask = cv2.GaussianBlur(mask, (9,9), 0)
mask = (mask > 127).astype(np.uint8)*255

cnts, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
hier = hier[0]

# keep contours above area threshold
keep = [(i,c) for i,c in enumerate(cnts) if cv2.contourArea(c) > 300]

def catmull_to_bezier(pts):
    # pts: Nx2 closed loop (no repeated last point)
    n = len(pts)
    d = f"M {pts[0][0]:.1f},{pts[0][1]:.1f} "
    for i in range(n):
        p0 = pts[(i-1) % n]
        p1 = pts[i]
        p2 = pts[(i+1) % n]
        p3 = pts[(i+2) % n]
        c1 = (p1[0] + (p2[0]-p0[0])/6.0, p1[1] + (p2[1]-p0[1])/6.0)
        c2 = (p2[0] - (p3[0]-p1[0])/6.0, p2[1] - (p3[1]-p1[1])/6.0)
        d += f"C {c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f} "
    d += "Z"
    return d

paths = []
for i,c in keep:
    peri = cv2.arcLength(c, True)
    eps = 0.0010*peri  # light simplification
    ap = cv2.approxPolyDP(c, eps, True).reshape(-1,2).astype(float)
    paths.append((cv2.contourArea(c), ap, len(ap)))

paths.sort(key=lambda t:-t[0])
print("contours kept:", [(int(a), n) for a,_,n in paths])

# bounding box across all kept contours
allpts = np.vstack([p for _,p,_ in paths])
minx,miny = allpts.min(0); maxx,maxy = allpts.max(0)
pad = 20
vb_x = minx-pad; vb_y = miny-pad
vb_w = (maxx-minx)+2*pad; vb_h = (maxy-miny)+2*pad

# shift coords so viewBox starts near 0
def shift(p): 
    q = p.copy(); q[:,0]-=vb_x; q[:,1]-=vb_y; return q

dstrings = [catmull_to_bezier(shift(p)) for _,p,_ in paths]
VBW, VBH = round(vb_w), round(vb_h)
print("viewBox", VBW, VBH)

# combined d for fill (evenodd holes)
fill_d = " ".join(dstrings)

# ---- 1. filled silhouette ----
with open(OUT+"badjuju-logo.svg","w") as f:
    f.write(f'<svg viewBox="0 0 {VBW} {VBH}" xmlns="http://www.w3.org/2000/svg">\n')
    f.write(f'  <path fill="#000000" fill-rule="evenodd" d="{fill_d}"/>\n</svg>\n')

# ---- 2. outline only (each contour stroked) ----
with open(OUT+"badjuju-logo-outline.svg","w") as f:
    f.write(f'<svg viewBox="0 0 {VBW} {VBH}" xmlns="http://www.w3.org/2000/svg">\n')
    for d in dstrings:
        f.write(f'  <path fill="none" stroke="#000000" stroke-width="3" d="{d}"/>\n')
    f.write('</svg>\n')

# path length estimate per contour for animation timing
def path_len(pts):
    n=len(pts); s=0
    for i in range(n):
        a=pts[i]; b=pts[(i+1)%n]; s+=((a[0]-b[0])**2+(a[1]-b[1])**2)**0.5
    return s
lens = [path_len(shift(p)) for _,p,_ in paths]
print("approx path lengths", [int(l) for l in lens])

# save d strings to a text file for reuse
with open(OUT+"paths.txt","w") as f:
    f.write(f"viewBox 0 0 {VBW} {VBH}\n\n")
    for idx,d in enumerate(dstrings):
        f.write(f"path {idx} (area {int(paths[idx][0])}):\n{d}\n\n")
print("done")
