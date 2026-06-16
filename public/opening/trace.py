import cv2, numpy as np

SRC = "/sessions/trusting-modest-fermi/mnt/public/png/badjuju_logo.png"
img = cv2.imread(SRC, cv2.IMREAD_UNCHANGED)
print("shape", img.shape)

# Build mask from alpha if present, else from luminance (dark = shape)
if img.shape[2] == 4:
    alpha = img[:,:,3]
    mask = (alpha > 128).astype(np.uint8)*255
    print("used alpha")
else:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mask = (gray < 128).astype(np.uint8)*255
    print("used luminance")

# Smooth the mask slightly to reduce pixel jaggies before tracing
mask = cv2.medianBlur(mask, 5)
mask = cv2.GaussianBlur(mask, (7,7), 0)
mask = (mask > 127).astype(np.uint8)*255

H, W = mask.shape
print("size", W, H)
area = int((mask>0).sum()/255)
print("fg area px", area, "coverage", round(area/(W*H),3))

# Contours: external + holes
cnts, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
print("num contours", len(cnts))
sizes = sorted([cv2.contourArea(c) for c in cnts], reverse=True)
print("top areas", [int(s) for s in sizes[:8]])
