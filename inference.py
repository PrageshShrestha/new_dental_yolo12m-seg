# --------------------------------------------------------------
#  simple_interactive_yolo.py
#  --------------------------------------------------------------
#  pip install ultralytics opencv-python
# --------------------------------------------------------------

import cv2
import numpy as np
from ultralytics import YOLO

# ---------- 1. Load model & run inference ----------
model = YOLO("./runs/segment/train8/weights/best.pt")
results = model("test.jpg")[0]                     # first image only

img = results.orig_img.copy()
H, W = img.shape[:2]

# ---------- 2. Interaction state ----------
zoom = 1.0
offset = np.array([0, 0])                         # pan (x, y)
show_boxes = True
show_labels = True
show_masks = True
mask_alpha = 0.35
selected = -1                                     # index of clicked tooth

# ---------- 3. Helper: class → pastel colour ----------
def class_color(cls_id):
    np.random.seed(cls_id)
    return tuple(int(x) for x in np.random.randint(100, 255, 3))

# ---------- 4. Draw function ----------
def draw():
    canvas = img.copy() #draw function 

    # --- masks ---
    if show_masks and results.masks is not None:
        overlay = np.zeros_like(canvas)
        for i, m in enumerate(results.masks.data.cpu().numpy()):
            overlay[m > 0.5] = class_color(i)
        canvas = cv2.addWeighted(overlay, mask_alpha, canvas, 1 - mask_alpha, 0)

    # --- boxes + labels ---
    if results.boxes is not None:
        for i, b in enumerate(results.boxes):
            x1, y1, x2, y2 = map(int, b.xyxy[0])
            cls = int(b.cls[0])
            conf = b.conf[0].item()
            txt = f"{results.names[cls]} {conf:.2f}"

            col = class_color(cls)
            if i == selected:
                col = (0, 255, 255)                 # yellow for selected

            if show_boxes:
                cv2.rectangle(canvas, (x1, y1), (x2, y2), col, 2)

            if show_labels:
                tw, th = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                cv2.rectangle(canvas,
                              (cx - tw//2 - 4, cy - th//2 - 4),
                              (cx + tw//2 + 4, cy + th//2 + 4),
                              (0, 0, 0), -1)
                cv2.putText(canvas, txt,
                            (cx - tw//2, cy + th//2),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    return canvas

# ---------- 5. Mouse callback ----------
def mouse(event, x, y, flags, param):
    global zoom, offset, selected

    if event == cv2.EVENT_MOUSEWHEEL:                     # zoom
        factor = 1.2 if flags > 0 else 0.8
        old = zoom
        zoom = max(0.2, min(zoom * factor, 30))
        # keep point under cursor fixed
        cx = (x - offset[0]) / old
        cy = (y - offset[1]) / old
        offset[0] = x - cx * zoom
        offset[1] = y - cy * zoom

    elif event == cv2.EVENT_LBUTTONDOWN:                  # start pan
        cv2.setMouseCallback(win_name, mouse)             # keep capturing
        param['drag'] = (x, y)

    elif event == cv2.EVENT_MOUSEMOVE and 'drag' in param:
        dx = x - param['drag'][0]
        dy = y - param['drag'][1]
        offset[0] += dx
        offset[1] += dy
        param['drag'] = (x, y)

    elif event == cv2.EVENT_LBUTTONUP:
        if 'drag' in param:
            del param['drag']

        # ---- click detection ----
        if results.boxes is not None:
            img_x = (x - offset[0]) / zoom
            img_y = (y - offset[1]) / zoom
            best, dist = -1, 1e9
            for i, b in enumerate(results.boxes):
                x1, y1, x2, y2 = map(int, b.xyxy[0])
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                d = ((img_x - cx) ** 2 + (img_y - cy) ** 2) ** 0.5
                if d < dist:
                    dist, best = d, i
            if dist < 80 / zoom:                         # tolerance
                selected = best
            else:
                selected = -1

# ---------- 6. Keyboard shortcuts ----------
def key(k):
    global show_boxes, show_labels, show_masks, selected
    if k == ord('b'):   show_boxes   = not show_boxes
    if k == ord('l'):   show_labels  = not show_labels
    if k == ord('m'):   show_masks   = not show_masks
    if k == ord('s'):   cv2.imwrite("result_view.jpg", draw())
    if k == 27:         return False                     # ESC → quit
    return True

# ---------- 7. Main loop ----------
win_name = "YOLO Teeth – wheel=zoom, drag=pan, b/l/m=toggle, s=save"
cv2.namedWindow(win_name, cv2.WINDOW_NORMAL)
cv2.resizeWindow(win_name, 1000, 700)

mouse_param = {}
cv2.setMouseCallback(win_name, mouse, mouse_param)

while True:
    canvas = draw()

    # apply zoom + pan
    M = cv2.getRotationMatrix2D((W/2, H/2), 0, zoom)
    M[:, 2] += offset
    view = cv2.warpAffine(canvas, M, (W, H), flags=cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_CONSTANT, borderValue=(30,30,30))

    cv2.imshow(win_name, view)
    if not key(cv2.waitKey(1) & 0xFF):
        break

cv2.destroyAllWindows()
