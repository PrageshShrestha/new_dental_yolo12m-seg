// script.js – Full final version with absolute positioning + clean canvas
const dropZone    = document.getElementById('dropZone');
const fileInput   = document.getElementById('fileInput');
const loading     = document.getElementById('loading');
const viewer      = document.getElementById('viewer');
const origCanvas  = document.getElementById('origCanvas');
const segCanvas   = document.getElementById('segCanvas');
const origPanel   = document.getElementById('origPanel');
const toggleOrig  = document.getElementById('toggleOrig');
const closeOrig   = document.getElementById('closeOrig');
const tooltip     = document.getElementById('tooltip');
const toothInfo   = document.getElementById('toothInfo');
const foundList   = document.getElementById('foundList');
const missingList = document.getElementById('missingList');

let origImg = null, segImg = null;
let detections = [];
let selectedId = null;
let hoveredId = null;

// === FDI MAP (32 teeth) ===
const FDI_MAP = {};
for (let i = 0; i < 32; i++) {
  const q = i < 8 ? 1 : i < 16 ? 2 : i < 24 ? 3 : 4;
  const num = ((q-1)*10 + (i%8 + 1)).toString();
  FDI_MAP[i] = { number: num, name: `Tooth ${num}`, quadrant: q };
}
// Correct FDI numbers
FDI_MAP[0].number = "11"; FDI_MAP[1].number = "12"; FDI_MAP[2].number = "13"; FDI_MAP[3].number = "14";
FDI_MAP[4].number = "15"; FDI_MAP[5].number = "16"; FDI_MAP[6].number = "17"; FDI_MAP[7].number = "18";
FDI_MAP[8].number = "21"; FDI_MAP[9].number = "22"; FDI_MAP[10].number = "23"; FDI_MAP[11].number = "24";
FDI_MAP[12].number = "25"; FDI_MAP[13].number = "26"; FDI_MAP[14].number = "27"; FDI_MAP[15].number = "28";
FDI_MAP[16].number = "31"; FDI_MAP[17].number = "32"; FDI_MAP[18].number = "33"; FDI_MAP[19].number = "34";
FDI_MAP[20].number = "35"; FDI_MAP[21].number = "36"; FDI_MAP[22].number = "37"; FDI_MAP[23].number = "38";
FDI_MAP[24].number = "41"; FDI_MAP[25].number = "42"; FDI_MAP[26].number = "43"; FDI_MAP[27].number = "44";
FDI_MAP[28].number = "45"; FDI_MAP[29].number = "46"; FDI_MAP[30].number = "47"; FDI_MAP[31].number = "48";


// correct FDI map

const correctFDIMap = new Map();

// Upper Right (1x)
correctFDIMap.set('11', 0);
correctFDIMap.set('12', 0);
correctFDIMap.set('13', 0);
correctFDIMap.set('14', 0);
correctFDIMap.set('15', 0);
correctFDIMap.set('16', 0);
correctFDIMap.set('17', 0);
correctFDIMap.set('18', 0);

// Upper Left (2x)
correctFDIMap.set('21', 0);
correctFDIMap.set('22', 0);
correctFDIMap.set('23', 0);
correctFDIMap.set('24', 0);
correctFDIMap.set('25', 0);
correctFDIMap.set('26', 0);
correctFDIMap.set('27', 0);
correctFDIMap.set('28', 0);

// Lower Left (3x)
correctFDIMap.set('31', 0);
correctFDIMap.set('32', 0);
correctFDIMap.set('33', 0);
correctFDIMap.set('34', 0);
correctFDIMap.set('35', 0);
correctFDIMap.set('36', 0);
correctFDIMap.set('37', 0);
correctFDIMap.set('38', 0);

// Lower Right (4x)
correctFDIMap.set('41', 0);
correctFDIMap.set('42', 0);
correctFDIMap.set('43', 0);
correctFDIMap.set('44', 0);
correctFDIMap.set('45', 0);
correctFDIMap.set('46', 0);
correctFDIMap.set('47', 0);
correctFDIMap.set('48', 0);


// === CANVAS VIEW (Absolute Positioning) ===
class CanvasView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isPanning = false;
    this.lastX = 0;
    this.lastY = 0;
    this.initEvents();
  }

  initEvents() {
    // Zoom
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const oldScale = this.scale;
      this.scale = Math.max(0.2, Math.min(this.scale * delta, 20));

      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      this.offsetX = mx - (mx - this.offsetX) * (this.scale / oldScale);
      this.offsetY = my - (my - this.offsetY) * (this.scale / oldScale);

      this.syncAll();
      this.draw();
    });

    // Pan (right-click)
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('mousedown', e => {
      if (e.button === 2) {
        this.isPanning = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.canvas.style.cursor = 'move';
      }
    });
    this.canvas.addEventListener('mousemove', e => {
      if (this.isPanning) {
        this.offsetX += e.clientX - this.lastX;
        this.offsetY += e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.syncAll();
        this.draw();
      } else if (this.canvas.id === 'segCanvas') {
        this.handleHover(e);
      }
    });
    ['mouseup', 'mouseleave'].forEach(ev => this.canvas.addEventListener(ev, () => {
      this.isPanning = false;
      this.canvas.style.cursor = 'default';
      if (this.canvas.id === 'segCanvas') tooltip.style.display = 'none';
    }));
  }

  setImage(img) {
    this.img = img;
    this.resize();
    this.resetView();
    this.draw();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  resetView() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  draw() {
    if (!this.img) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // Draw base image
    ctx.drawImage(this.img, 0, 0);

    if (this.canvas.id !== 'segCanvas') {
      ctx.restore();
      return;
    }

    const showMasks  = document.getElementById('showMasks').checked;
    const showLabels = document.getElementById('showLabels').checked;

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    detections.forEach(t => {
      const [r, g, b] = t.color;
      // const fdi = FDI_MAP[t.id] || { number: `T${t.id + 1}`, name: "Unknown" };
      const label = t.label;
      console.log(t);
      console.log(label);
      const isSelected = selectedId === t.label;
      const isHovered = hoveredId === t.label;

      // === MASK (Absolute Polygon) ===
      if (showMasks && t.polygon && t.polygon.length > 0) {
        const baseAlpha = 0.3;
        const hoverAlpha = 0.75;
        const selectAlpha = 0.95;

        let alpha = baseAlpha;
        if (isSelected) alpha = selectAlpha;
        else if (isHovered) alpha = hoverAlpha;

        const brightness = isSelected ? 1.6 : isHovered ? 1.4 : 1.0;
        const cr = Math.min(255, r * brightness);
        const cg = Math.min(255, g * brightness);
        const cb = Math.min(255, b * brightness);

        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha})`;

        if (isHovered || isSelected) {
          ctx.shadowColor = `rgba(${cr}, ${cg}, ${cb}, 0.9)`;
          ctx.shadowBlur = isSelected ? 25 : 18;
        }

        ctx.beginPath();
        const p0 = t.polygon[0];
        ctx.moveTo(p0[0], p0[1]);
        t.polygon.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
      }

      
      if (showLabels) {
        const [x1, y1, x2, y2] = t.bbox;
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const text = `${label} ${t.confidence.toFixed(2)}`;
        const fontSize = Math.max(12, 16);
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        const metrics = ctx.measureText(text);
        const pad = 8;

        // const bgAlpha = isSelected ? 0.98 : isHovered ? 0.9 : 0.85;
        const bgAlpha = 0;
        const bgColor = isSelected || isHovered ? '251,191,36' : '0,0,0';

        if (isSelected || isHovered) {
          ctx.shadowColor = `rgba(251,191,36,0.8)`;
          ctx.shadowBlur = isSelected ? 20 : 14;
        }

        ctx.fillStyle = `rgba(${bgColor},${bgAlpha})`;
        ctx.fillRect(cx - metrics.width / 2 - pad, cy - fontSize / 2 - pad,
                     metrics.width + pad * 2, fontSize + pad * 2);

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        //ctx.fillText(text, cx, cy);

        ctx.shadowBlur = 0;
      }
    });

    ctx.restore();
  }

  syncAll() {
    [origView, segView].forEach(v => {
      if (v !== this) {
        v.scale = this.scale;
        v.offsetX = this.offsetX;
        v.offsetY = this.offsetY;
        v.draw();
      }
    });
  }

  handleHover(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - this.offsetX) / this.scale;
    const my = (e.clientY - rect.top - this.offsetY) / this.scale;

    let best = null;

    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);

    for (const t of detections) {
      if (!t.polygon || t.polygon.length < 3) continue;

      this.ctx.beginPath();
      const p0 = t.polygon[0];
      this.ctx.moveTo(p0[0], p0[1]);
      t.polygon.slice(1).forEach(p => this.ctx.lineTo(p[0], p[1]));
      this.ctx.closePath();

      if (this.ctx.isPointInPath(mx, my)) {
        best = t;
        break;
      }
    }

    this.ctx.restore();

    hoveredId = best ? best.label : null;
    this.draw();

    // Update active button
    document.querySelectorAll('.list button').forEach(b => b.classList.remove('active'));

    if (!best) return;

    console.log(best);
    const btn = document.querySelector(`.list button[data-id="${best.label}"]`);
    if (btn) btn.classList.add('active');
    

    // Update tooltip & info
    if (best) {
      // const fdi = FDI_MAP[best.id] || { number: "??", name: "Unknown" };
      const area = ((best.bbox[2] - best.bbox[0]) * (best.bbox[3] - best.bbox[1])).toFixed(0);
      const status = best.confidence >= 0.5 ? "Present" : "Missing / Low Confidence";
      const statusColor = best.confidence >= 0.5 ? '#34d399' : '#ef4444';

      toothInfo.innerHTML = `
        <div style="text-align:center;padding:.5rem;">
          <h4 style="margin:.4rem 0;color:#60a5fa;font-size:1.3em;">${best.label}</h4>
          // <p style="margin:.3rem 0;font-weight:500;">$/{fe.name}</p>
          <p style="margin:.3rem 0;">Confidence: <strong>${best.confidence.toFixed(3)}</strong></p>
          <p style="margin:.3rem 0;">Status: <strong style="color:${statusColor}">${status}</strong></p>
          <p style="margin:.3rem 0;color:#94a3b8;">Area: <strong>${area} px²</strong></p>
        </div>
      `;

      tooltip.innerHTML = `<strong>${best.label}</strong><br>Conf: <strong>${best.confidence.toFixed(3)}</strong>`;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.pageX + 12) + 'px';
      tooltip.style.top = (e.pageY + 12) + 'px';
    } else {
      tooltip.style.display = 'none';
      if (selectedId === null) {
        toothInfo.innerHTML = "<p style='color:#94a3b8;text-align:center;'>Hover or click a tooth to view details</p>";
      }
    }
  }
}

const origView = new CanvasView(origCanvas);
const segView  = new CanvasView(segCanvas);

// === BUILD TOOTH LISTS ===
function buildLists(data) {
  foundList.innerHTML = '';
  missingList.innerHTML = '';

  // console.log(data);
  const { detections } = data;

  correctFDIMap.forEach((_, label) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.dataset.id = label;

    const foundDetection = detections.find(detection => detection.label == label);

    if (!foundDetection) {
      btn.classList.add('missing');
      btn.disabled = true;
      missingList.append(btn);
    } else {
      foundList.append(btn);

      btn.addEventListener('click', () => {
        selectTooth(label);
      });
    }
  })
  

  // for (let i = 0; i < 32; i++) {
  //   const btn = document.createElement('button');
  //   btn.textContent = FDI_MAP[i].number;
  //     // btn.textContent = fdi;

  //   btn.dataset.id = i;

  //   const detection = detections.find(d => d.id === i);
  //   if (detection && detection.confidence >= 0.5) {
  //     foundList.appendChild(btn);
  //     btn.addEventListener('click', () => selectTooth(i));
  //   } else {
  //     const clone = btn.cloneNode(true);
  //     clone.classList.add('missing');
  //     clone.disabled = true;
  //     missingList.appendChild(clone);
  //   }
  // }
}

function selectTooth(label) {
  selectedId = label;
  const t = detections.find(d => d.label === label);
  const area = t ? ((t.bbox[2] - t.bbox[0]) * (t.bbox[3] - t.bbox[1])).toFixed(0) : '—';
  const status = t && t.confidence >= 0.5 ? "Present" : "Missing";
  const statusColor = status === "Present" ? '#34d399' : '#ef4444';

  toothInfo.innerHTML = `
    <div style="text-align:center;padding:.5rem;">
      <h4 style="margin:.4rem 0;color:#60a5fa;font-size:1.3em;">${t.label}</h4>
      <p style="margin:.3rem 0;font-weight:500;">Teeht # ${t.label}</p>
      <p style="margin:.3rem 0;">Confidence: <strong>${t ? t.confidence.toFixed(3) : '—'}</strong></p>
      <p style="margin:.3rem 0;">Status: <strong style="color:${statusColor}">${status}</strong></p>
      <p style="margin:.3rem 0;color:#94a3b8;">Area: <strong>${area} px²</strong></p>
    </div>
  `;

  document.querySelectorAll('.list button').forEach(b => b.classList.remove('active'));
  document.querySelector(`.list button[data-id="${label}"]`)?.classList.add('active');
  segView.draw();
}

// === PANEL TOGGLE ===
toggleOrig.addEventListener('click', () => origPanel.classList.toggle('open'));
closeOrig.addEventListener('click', () => origPanel.classList.remove('open'));

// === UPLOAD ===
['dragover', 'dragenter'].forEach(ev => dropZone.addEventListener(ev, e => e.preventDefault()));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]);
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) upload(fileInput.files[0]);
});

async function upload(file) {
  const form = new FormData();
  form.append('file', file);
  loading.style.display = 'block';
  viewer.style.display = 'none';

  try {
    const res = await fetch('/api/segment', { method: 'POST', body: form });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    origImg = new Image();
    segImg = new Image();

    origImg.onload = () => origView.setImage(origImg);
    segImg.onload = () => {
      segView.setImage(segImg);
      detections = data.detections || [];
      buildLists(data);
      segView.draw();
    };

    origImg.src = 'data:image/jpeg;base64,' + data.original;
    segImg.src  = 'data:image/jpeg;base64,' + data.segmented;

    viewer.style.display = 'block';
    toothInfo.innerHTML = "<p style='color:#94a3b8;text-align:center;'>Hover or click a tooth to view details</p>";
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    loading.style.display = 'none';
  }
}

// === CONTROLS ===
['showMasks', 'showLabels'].forEach(id =>
  document.getElementById(id).addEventListener('change', () => segView.draw())
);

document.getElementById('resetView').addEventListener('click', () => {
  [origView, segView].forEach(v => v.resetView());
  v.draw();
  selectedId = null;
  hoveredId = null;
  document.querySelectorAll('.list button').forEach(b => b.classList.remove('active'));
  toothInfo.innerHTML = "<p style='color:#94a3b8;text-align:center;'>Hover or click a tooth to view details</p>";
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = segCanvas.toDataURL('image/jpeg', 0.95);
  a.download = `dental-ai-${Date.now()}.jpg`;
  a.click();
});

// === RESIZE ===
window.addEventListener('resize', () => {
  [origView, segView].forEach(v => {
    v.resize();
    v.draw();
  });
});