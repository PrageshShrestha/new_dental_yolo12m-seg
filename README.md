# 🦷 Dental YOLOv12m-Seg: Instance Segmentation for Dental X-Rays

**Advanced tooth instance segmentation model using Ultralytics YOLOv12m-seg**

This repository contains a custom-trained **YOLOv12m-seg** (medium variant with segmentation head) model fine-tuned specifically for **instance segmentation of teeth** in panoramic and periapical dental X-ray images.

It provides precise detection (bounding boxes) and pixel-level masks for individual teeth, which can assist in:
- Automatic tooth numbering
- Detection of caries (cavities), restorations, and anomalies
- Treatment planning and AI-assisted dental radiology

![GitHub stars](https://img.shields.io/github/stars/PrageshShrestha/new_dental_yolo12m-seg?style=social)
![GitHub license](https://img.shields.io/github/license/PrageshShrestha/new_dental_yolo12m-seg)
![Ultralytics YOLO](https://img.shields.io/badge/Powered%20by-Ultralytics%20YOLOv12-blue)

## 🚀 Key Features
- Built on the latest **YOLOv12** architecture (released February 2025) with attention mechanisms for better handling of small/overlapping objects like tooth roots and crowns.
- Supports **instance segmentation** (boxes + masks).
- Trained on dental X-ray datasets for high clinical relevance.
- Easy inference with Ultralytics API.

## 📊 Example Segmentation Results
Here are real-world examples of instance segmentation on panoramic dental X-rays (colorful masks for each tooth):

<div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;">
  <img src="https://www.mdpi.com/applsci/applsci-13-07947/article_deploy/html/images/applsci-13-07947-g003.png" alt="Segmentation Example 1" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"/>
  <img src="https://www.mdpi.com/applsci/applsci-13-07947/article_deploy/html/images/applsci-13-07947-g002.png" alt="Segmentation Example 2" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"/>
  <img src="https://www.mdpi.com/bioengineering/bioengineering-10-00843/article_deploy/html/images/bioengineering-10-00843-g004-550.jpg" alt="Segmentation Example 3" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"/>
  <img src="https://media.springernature.com/lw1200/springer-static/image/art%3A10.1007%2Fs44352-025-00021-2/MediaObjects/44352_2025_21_Fig2_HTML.jpg" alt="Segmentation Example 4" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"/>
</div>

![Teeth instance segmentation example 5](https://media.springernature.com/lw1200/springer-static/image/art%3A10.1007%2Fs44352-025-00021-2/MediaObjects/44352_2025_21_Fig2_HTML.jpg)

## 🦠 Dental X-Ray Examples with Potential Issues (e.g., Cavities)
Real-world panoramic X-rays showing conditions like caries:

![Panoramic X-ray with cavity detection](https://pub.mdpi-res.com/applsci/applsci-13-12771/article_deploy/html/images/applsci-13-12771-g002.png?1701181943)

![Annotated caries examples](https://www.researchgate.net/publication/357659058/figure/fig1/AS:11431281360886950@1744104686410/Example-of-different-grade-caries-lesions-from-panoramic-radiograph-shallow-caries-in.png)

## 🛠️ Quick Start: Run the Dental Segmentation Web App

This project includes a **FastAPI-based web application** (`app.py`) that allows you to upload dental X-ray images and get real-time instance segmentation results using the custom-trained YOLOv12m-seg model.

### Prerequisites
- Python 3.8 or higher
- NVIDIA GPU recommended for faster inference (CUDA support)
- Git (to clone the repo)

### Installation & Running the App

```bash
# Clone the repository
git clone https://github.com/PrageshShrestha/new_dental_yolo12m-seg.git
cd new_dental_yolo12m-seg

# Create a virtual environment
# Linux / macOS
python3 -m venv dental_env
source dental_env/bin/activate

# Windows
python -m venv dental_env
dental_env\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install PyTorch with CUDA support (for GPU acceleration)
# Recommended as of December 2025: CUDA 12.6
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126

# If you don't have a compatible NVIDIA GPU, install CPU-only version instead:
# pip install torch torchvision torchaudio

# Run the FastAPI server (with auto-reload for development)
uvicorn app:app --reload


