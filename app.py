# app.py
# Dental AI Segmentation API with YOLO Val-Style Output
# Saves: val_batch0_pred.jpg, val_batch1_pred.jpg, ...

from flask import Flask, send_from_directory, request, jsonify
from ultralytics import YOLO
import cv2
import numpy as np
import base64
import os
import uuid
import colorsys

# ==============================
# Flask Setup
# ==============================
app = Flask(__name__)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_file(filename):
    return send_from_directory(BASE_DIR, filename)

# ==============================
# Folders
# ==============================
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
RESULTS_FOLDER = os.path.join(BASE_DIR, 'results')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp', 'tiff'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ==============================
# Load YOLO Model
# ==============================
MODEL_PATH = "runs/segment/train8/weights/best.pt"
print(f"[INFO] Loading model from: {MODEL_PATH}")
model = YOLO(MODEL_PATH)

# ==============================
# Global: Class Colors & Batch Counter
# ==============================
def get_class_colors(names, seed=42):
    np.random.seed(seed)
    n = len(names)
    hsv = [(i / n, 1.0, 1.0) for i in range(n)]
    colors = [colorsys.hsv_to_rgb(*c) for c in hsv]
    np.random.shuffle(colors)
    return [(int(c[0]*250), int(c[1]*250), int(c[2]*250)) for c in colors]

CLASS_COLORS = get_class_colors(model.names)
print(f"[INFO] Generated {len(CLASS_COLORS)} class colors")

# Batch counter for val-style naming
batch_counter = 0

# ==============================
# Helper Functions
# ==============================
def mask_to_polygon(mask):
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []
    return contours[0].squeeze(1).tolist()

def encode_image(img):
    _, buffer = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    return base64.b64encode(buffer).decode('utf-8')

# ==============================
# API: /api/segment
# ==============================
@app.route('/api/segment', methods=['POST'])
def segment():
    global batch_counter

    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400

    # Generate unique filename
    ext = file.filename.rsplit('.', 1)[1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, unique_name)
    file.save(filepath)

    # Load image
    img = cv2.imread(filepath)
    if img is None:
        os.remove(filepath)
        return jsonify({"error": "Cannot read image"}), 400

    H, W = img.shape[:2]
    print(f"[DEBUG] Input: {W}×{H}")

    # ==============================
    # INFERENCE: Use imgsz=960
    # ==============================
    IMG_SIZE = 960
    try:
        results = model(filepath, imgsz=IMG_SIZE, verbose=False)[0]
    except Exception as e:
        os.remove(filepath)
        return jsonify({"error": f"Model error: {str(e)}"}), 500

    # ==============================
    # Rescale to original size
    # ==============================
    scale_x = 1
    scale_y = 1

    orig_b64 = encode_image(img)
    result_img = img.copy()
    overlay = np.zeros_like(img)
    detections = []

    # ==============================
    # ULTRALYTICS VAL-STYLE DRAWING
    # ==============================
    if results.boxes is not None and len(results.boxes) > 0:
        for i in range(len(results.boxes)):
            box = results.boxes[i]
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            label = results.names[cls_id]

            # Consistent color per class
            color_rgb = CLASS_COLORS[cls_id]
            color_bgr = (color_rgb[2], color_rgb[1], color_rgb[0])  # RGB → BGR

            # Rescale bbox
            x1 = int(x1 * scale_x); y1 = int(y1 * scale_y)
            x2 = int(x2 * scale_x); y2 = int(y2 * scale_y)

            # === MASK OVERLAY ===
            polygon = []
            if results.masks is not None:
                raw = results.masks.data[i].cpu().numpy()
                mask = cv2.resize(raw, (W, H), interpolation=cv2.INTER_NEAREST)
                mask_bin = (mask > 0.5).astype(np.uint8)
                color_mask = np.zeros_like(img)
                color_mask[mask_bin > 0] = color_rgb
                overlay = cv2.addWeighted(overlay, 1.0, color_mask, 0.4, 0)
                polygon = mask_to_polygon((mask_bin * 255).astype(np.uint8))

            # === BOUNDING BOX ===
            cv2.rectangle(result_img, (x1, y1), (x2, y2), color_bgr, 2)

            # === LABEL TEXT ===
            label_text = f"{label} {conf:.2f}"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.5
            thickness = 1

            (tw, th), _ = cv2.getTextSize(label_text, font, font_scale, thickness)
            label_y = y1 - 10 if y1 - th - 10 > 0 else y1 + th + 10

            # Black background
            cv2.rectangle(result_img, (x1, label_y - th - 4), (x1 + tw + 4, label_y), (0, 0, 0), -1)
            # White text
            cv2.putText(result_img, label_text, (x1 + 2, label_y - 2),
                        font, font_scale, (255, 255, 255), thickness)

            detections.append({
                "id": i,
                "label": label,
                "confidence": round(conf, 3),
                "bbox": [x1, y1, x2, y2],
                "polygon": polygon,
                "color": color_rgb
            })

        print(f"[DEBUG] Found {len(detections)} detections")

    else:
        print("[DEBUG] No detections found")

    # === FINAL OVERLAY BLEND ===
    result_img = cv2.addWeighted(result_img, 0.6, overlay, 0.4, 0)

    # === ENCODE FOR FRONTEND ===
    result_b64 = encode_image(result_img)

    # === SAVE AS VAL-STYLE: val_batchX_pred.jpg ===
    result_filename = f"val_batch{batch_counter}_pred.jpg"
    result_path = os.path.join(RESULTS_FOLDER, result_filename)
    cv2.imwrite(result_path, result_img)
    print(f"[SAVED] {result_path}")

    # Increment batch counter
    batch_counter += 1

    # Clean up upload
    try:
        os.remove(filepath)
    except:
        pass

    return jsonify({
        "original": orig_b64,
        "segmented": result_b64,
        "detections": detections,
        "saved_file": unique_name,
        "result_file": result_filename,
        "result_url": f"/results/{result_filename}",
        "width": W,
        "height": H
    })

# ==============================
# Serve Saved Results
# ==============================
@app.route('/results/<filename>')
def serve_result(filename):
    return send_from_directory(RESULTS_FOLDER, filename)

# ==============================
# Run Server
# ==============================
if __name__ == '__main__':
    print(f"[INFO] Uploads folder: {UPLOAD_FOLDER}")
    print(f"[INFO] Results folder: {RESULTS_FOLDER}")
    print(f"[INFO] Server starting at http://localhost:5000")
    app.run(host='0.0.0.0', port=5001, debug=False)
