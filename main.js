/* ============================================================
   YOLO Algorithm Visualizer — main.js
   ============================================================ */

(function () {
  'use strict';

  // ── Canvas Setup ───────────────────────────────────────────
  const canvas = document.getElementById('mainCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;   // 900
  const H = canvas.height;  // 420

  // ── Color Palette ──────────────────────────────────────────
  const C = {
    bg:        '#0d0e0f',
    surface:   '#141516',
    surface2:  '#1a1c1e',
    border:    'rgba(255,255,255,0.08)',
    borderHi:  'rgba(255,255,255,0.22)',
    txt:       '#e8e6e0',
    txtSec:    '#888680',
    txtMute:   '#4a4845',
    teal:      '#00c49a',
    tealDim:   'rgba(0,196,154,0.15)',
    purple:    '#a78bfa',
    purpleDim: 'rgba(167,139,250,0.15)',
    amber:     '#f59e0b',
    amberDim:  'rgba(245,158,11,0.18)',
    coral:     '#f87171',
    coralDim:  'rgba(248,113,113,0.15)',
    blue:      '#60a5fa',
    blueDim:   'rgba(96,165,250,0.15)',
    red:       '#fb923c',
  };

  // ── Scene Constants ────────────────────────────────────────
  const IMG = { x: 50, y: 40, w: 300, h: 280 }; // main image box
  const GRID_COLS = 7, GRID_ROWS = 7;
  const CELL_W = IMG.w / GRID_COLS;
  const CELL_H = IMG.h / GRID_ROWS;

  // Objects in the scene (normalized 0–1 within IMG)
  const OBJECTS = [
    { label: 'Kucing', cx: 0.32, cy: 0.50, w: 0.36, h: 0.60, color: C.teal,   conf: 0.91 },
    { label: 'Anjing', cx: 0.73, cy: 0.50, w: 0.30, h: 0.55, color: C.purple, conf: 0.87 },
  ];

  // All anchor confidence map
  const CONF_MAP = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const nx = (c + 0.5) / GRID_COLS;
      const ny = (r + 0.5) / GRID_ROWS;
      let conf = 0;
      for (const o of OBJECTS) {
        const d = Math.hypot(nx - o.cx, ny - o.cy);
        conf = Math.max(conf, Math.exp(-d * d * 16));
      }
      CONF_MAP.push({ r, c, conf });
    }
  }

  // ── Utility Helpers ────────────────────────────────────────
  function toScene(nx, ny) {
    return [IMG.x + nx * IMG.w, IMG.y + ny * IMG.h];
  }

  function roundRect(cx2, x, y, w, h, r) {
    cx2.beginPath();
    cx2.roundRect(x, y, w, h, r);
  }

  function setFont(size, weight = 400, family = "'DM Sans', sans-serif") {
    ctx.font = `${weight} ${size}px ${family}`;
  }

  function monoFont(size, weight = 400) {
    ctx.font = `${weight} ${size}px 'Space Mono', monospace`;
  }

  function arrow(x1, y1, x2, y2, color = C.txtSec, width = 1.5) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 9 * Math.cos(angle - 0.38), y2 - 9 * Math.sin(angle - 0.38));
    ctx.lineTo(x2 - 9 * Math.cos(angle + 0.38), y2 - 9 * Math.sin(angle + 0.38));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function label(text, x, y, color = C.txtSec, size = 11, align = 'center') {
    ctx.save();
    setFont(size);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function monoLabel(text, x, y, color = C.txtSec, size = 10, align = 'left') {
    ctx.save();
    monoFont(size);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ── Drawing Primitives ─────────────────────────────────────

  function clearCanvas() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawImage(alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;

    // Image frame
    roundRect(ctx, IMG.x, IMG.y, IMG.w, IMG.h, 8);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.strokeStyle = C.borderHi;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Sky
    ctx.fillStyle = '#1c2c3c';
    ctx.fillRect(IMG.x + 1, IMG.y + 1, IMG.w - 2, (IMG.h - 2) * 0.45);

    // Ground
    ctx.fillStyle = '#1a2618';
    ctx.fillRect(IMG.x + 1, IMG.y + (IMG.h - 2) * 0.55, IMG.w - 2, (IMG.h - 2) * 0.45);

    // Horizon blend
    ctx.fillStyle = '#1e2e1e';
    ctx.fillRect(IMG.x + 1, IMG.y + (IMG.h - 2) * 0.44, IMG.w - 2, (IMG.h - 2) * 0.14);

    // Cat silhouette
    const [cx, cy] = toScene(0.14, 0.22);
    ctx.fillStyle = '#8B6914';
    ctx.beginPath(); ctx.ellipse(cx + 36, cy + 52, 30, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 32, cy + 24, 16, 17, 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 20, cy + 12); ctx.lineTo(cx + 24, cy + 1); ctx.lineTo(cx + 32, cy + 14); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 40, cy + 12); ctx.lineTo(cx + 45, cy + 1); ctx.lineTo(cx + 38, cy + 14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c0920a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx + 65, cy + 60); ctx.quadraticCurveTo(cx + 80, cy + 36, cx + 70, cy + 20); ctx.stroke();

    // Dog silhouette
    const [dx, dy] = toScene(0.58, 0.24);
    ctx.fillStyle = '#7c4dba';
    ctx.beginPath(); ctx.ellipse(dx + 32, dy + 50, 34, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(dx + 40, dy + 26, 18, 15, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(dx + 26, cy + 4); ctx.lineTo(dx + 22, cy - 8); ctx.lineTo(dx + 32, cy + 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(dx + 50, dy + 22); ctx.lineTo(dx + 68, dy + 14); ctx.lineTo(dx + 56, dy + 30); ctx.closePath(); ctx.fill();

    ctx.restore();

    // Frame label
    label('448 × 448 px', IMG.x + IMG.w / 2, IMG.y - 14, C.txtMute, 10);
  }

  function drawGrid(alpha = 1, highlightCells = []) {
    ctx.save();
    ctx.globalAlpha = alpha;

    // Highlighted cells
    for (const { r, c } of highlightCells) {
      ctx.fillStyle = C.amberDim;
      ctx.fillRect(IMG.x + c * CELL_W + 0.5, IMG.y + r * CELL_H + 0.5, CELL_W - 1, CELL_H - 1);
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= GRID_ROWS; r++) {
      const y = IMG.y + r * CELL_H;
      ctx.beginPath(); ctx.moveTo(IMG.x, y); ctx.lineTo(IMG.x + IMG.w, y); ctx.stroke();
    }
    for (let c = 0; c <= GRID_COLS; c++) {
      const x = IMG.x + c * CELL_W;
      ctx.beginPath(); ctx.moveTo(x, IMG.y); ctx.lineTo(x, IMG.y + IMG.h); ctx.stroke();
    }

    ctx.restore();

    label('Grid 7 × 7', IMG.x + IMG.w / 2, IMG.y + IMG.h + 18, C.txtMute, 10);
  }

  function drawConfidenceMap() {
    for (const { r, c, conf } of CONF_MAP) {
      if (conf < 0.04) continue;
      ctx.fillStyle = `rgba(245,158,11,${conf * 0.65})`;
      ctx.fillRect(IMG.x + c * CELL_W + 0.5, IMG.y + r * CELL_H + 0.5, CELL_W - 1, CELL_H - 1);
    }
  }

  function drawObjectCenters() {
    for (const o of OBJECTS) {
      const [cx, cy] = toScene(o.cx, o.cy);
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = o.color; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  function drawAllBoxes() {
    const boxes = [
      { x: 0.14, y: 0.18, w: 0.40, h: 0.64, conf: 0.91, color: C.teal },
      { x: 0.10, y: 0.22, w: 0.46, h: 0.58, conf: 0.72, color: C.teal },
      { x: 0.18, y: 0.14, w: 0.37, h: 0.70, conf: 0.65, color: C.teal },
      { x: 0.16, y: 0.20, w: 0.38, h: 0.60, conf: 0.55, color: C.teal },
      { x: 0.11, y: 0.12, w: 0.42, h: 0.72, conf: 0.47, color: C.teal },
      { x: 0.56, y: 0.20, w: 0.34, h: 0.58, conf: 0.87, color: C.purple },
      { x: 0.52, y: 0.16, w: 0.40, h: 0.64, conf: 0.70, color: C.purple },
      { x: 0.59, y: 0.24, w: 0.32, h: 0.52, conf: 0.62, color: C.purple },
      { x: 0.54, y: 0.18, w: 0.36, h: 0.58, conf: 0.53, color: C.purple },
      { x: 0.50, y: 0.22, w: 0.42, h: 0.60, conf: 0.44, color: C.purple },
    ];
    ctx.save();
    ctx.setLineDash([3, 3]);
    for (const b of boxes) {
      const [bx, by] = toScene(b.x, b.y);
      const bw = b.w * IMG.w, bh = b.h * IMG.h;
      ctx.fillStyle = b.color + '18';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = b.color + 'cc';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(bx, by, bw, bh);
      monoLabel((b.conf * 100).toFixed(0) + '%', bx + 3, by + 8, b.color, 8);
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawFinalBoxes() {
    for (const o of OBJECTS) {
      const bx = IMG.x + (o.cx - o.w / 2) * IMG.w;
      const by = IMG.y + (o.cy - o.h / 2) * IMG.h;
      const bw = o.w * IMG.w;
      const bh = o.h * IMG.h;

      // Fill
      ctx.fillStyle = o.color + '18';
      ctx.fillRect(bx, by, bw, bh);

      // Border
      ctx.strokeStyle = o.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(bx, by, bw, bh);

      // Corner accents
      const L = 14;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = o.color;
      ctx.beginPath();
      ctx.moveTo(bx, by + L); ctx.lineTo(bx, by); ctx.lineTo(bx + L, by);
      ctx.moveTo(bx + bw - L, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + L);
      ctx.moveTo(bx, by + bh - L); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + L, by + bh);
      ctx.moveTo(bx + bw - L, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - L);
      ctx.stroke();

      // Label pill
      const txt = `${o.label}  ${(o.conf * 100).toFixed(0)}%`;
      ctx.save();
      monoFont(10, 700);
      const tw = ctx.measureText(txt).width + 14;
      roundRect(ctx, bx, by - 22, tw, 18, 3);
      ctx.fillStyle = o.color; ctx.fill();
      ctx.fillStyle = '#000';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, bx + 7, by - 13);
      ctx.restore();
    }
  }

  // ── Panel Drawings (right side of canvas) ─────────────────

  function drawCNNPanel() {
    const px = 400, py = 40;
    label('Jaringan CNN (backbone)', px + 200, py - 14, C.txtMute, 10);

    const layers = [
      { w: 18, h: 90, color: C.blue,   name: 'Conv\n1-3' },
      { w: 18, h: 72, color: C.blue,   name: 'Pool' },
      { w: 18, h: 58, color: C.purple, name: 'Conv\n4-9' },
      { w: 18, h: 46, color: C.purple, name: 'Pool' },
      { w: 18, h: 36, color: C.teal,   name: 'FC' },
      { w: 18, h: 28, color: C.amber,  name: 'Out' },
    ];

    let lx = px;
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      const ly = py + 110 - l.h / 2;

      if (i > 0) {
        const prev = layers[i - 1];
        ctx.strokeStyle = C.border;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(lx - 10, py + 110);
        ctx.lineTo(lx, py + 110);
        ctx.stroke();
      }

      ctx.fillStyle = l.color + '30';
      ctx.strokeStyle = l.color + 'bb';
      ctx.lineWidth = 0.5;
      roundRect(ctx, lx, ly, l.w, l.h, 3);
      ctx.fill(); ctx.stroke();

      lx += l.w + 10;
    }

    // Input arrow
    arrow(IMG.x + IMG.w + 12, IMG.y + IMG.h / 2, px - 2, py + 110, C.teal, 1);
    monoLabel('tensor', IMG.x + IMG.w + 14, IMG.y + IMG.h / 2 - 10, C.txtMute, 9);
  }

  function drawPredPanel() {
    const px = 390, py = 36;
    label('Vektor prediksi per sel', px + 130, py - 14, C.txtMute, 10);

    const items = [
      { label: 'x, y — posisi center', color: C.amber },
      { label: 'w, h — lebar & tinggi', color: C.amber },
      { label: 'Conf — keyakinan objek', color: C.coral },
      { label: 'P(kucing) — skor kelas', color: C.teal },
      { label: 'P(anjing) — skor kelas', color: C.purple },
      { label: '... (20 kelas total)', color: C.txtMute },
    ];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const iy = py + 20 + i * 26;
      ctx.fillStyle = it.color + '22';
      roundRect(ctx, px, iy, 260, 20, 3);
      ctx.fill();
      ctx.strokeStyle = it.color + '55';
      ctx.lineWidth = 0.5; ctx.stroke();
      monoLabel(it.label, px + 10, iy + 10, it.color, 9);
    }

    // Arrow from grid to panel
    arrow(IMG.x + IMG.w + 10, IMG.y + 100, px - 5, py + 80, C.amber, 1);
    monoLabel('49 sel', IMG.x + IMG.w + 12, IMG.y + 90, C.txtMute, 9);
  }

  function drawNMSPanel() {
    const px = 390, py = 36;
    label('Non-Maximum Suppression', px + 200, py - 14, C.txtMute, 10);

    // Box A
    const bA = { x: px + 20, y: py + 20, w: 100, h: 78 };
    ctx.fillStyle = C.tealDim; ctx.strokeStyle = C.teal; ctx.lineWidth = 1;
    roundRect(ctx, bA.x, bA.y, bA.w, bA.h, 4); ctx.fill(); ctx.stroke();
    monoLabel('A  0.91', bA.x + 5, bA.y + 11, C.teal, 9);

    // Box B
    const bB = { x: px + 65, y: py + 44, w: 100, h: 78 };
    ctx.fillStyle = C.purpleDim; ctx.strokeStyle = C.purple; ctx.lineWidth = 1;
    roundRect(ctx, bB.x, bB.y, bB.w, bB.h, 4); ctx.fill(); ctx.stroke();
    monoLabel('B  0.72', bB.x + 5, bB.y + 11, C.purple, 9);

    // Intersection
    const ix = Math.max(bA.x, bB.x);
    const iy = Math.max(bA.y, bB.y);
    const ix2 = Math.min(bA.x + bA.w, bB.x + bB.w);
    const iy2 = Math.min(bA.y + bA.h, bB.y + bB.h);
    ctx.fillStyle = C.amberDim;
    ctx.fillRect(ix, iy, ix2 - ix, iy2 - iy);
    ctx.strokeStyle = C.amber; ctx.lineWidth = 0.5;
    ctx.strokeRect(ix, iy, ix2 - ix, iy2 - iy);
    monoLabel('∩', ix + (ix2 - ix) / 2 - 4, iy + (iy2 - iy) / 2, C.amber, 11);

    // IoU formula
    const fx = px + 185, fy = py + 28;
    monoLabel('IoU =', fx, fy, C.txtSec, 10);
    ctx.strokeStyle = C.amber + 'aa'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(fx, fy + 8); ctx.lineTo(fx + 95, fy + 8); ctx.stroke();
    monoLabel('|A ∩ B|', fx + 12, fy + 2, C.amber, 10);
    monoLabel('|A ∪ B|', fx + 12, fy + 18, C.txtSec, 10);

    // Steps
    const steps = [
      { text: '① Urutkan berdasar confidence', ok: true },
      { text: '② Pilih box terbaik', ok: true },
      { text: '③ Hapus IoU > 0.5', ok: true },
      { text: '④ Ulangi untuk semua kelas', ok: false },
    ];
    let sy = py + 140;
    for (const s of steps) {
      monoLabel(s.text, px + 20, sy, s.ok ? C.teal : C.txtMute, 9);
      sy += 20;
    }

    // Cross on suppressed box
    ctx.save();
    ctx.strokeStyle = C.coral + 'aa'; ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(bB.x, bB.y); ctx.lineTo(bB.x + bB.w, bB.y + bB.h);
    ctx.moveTo(bB.x + bB.w, bB.y); ctx.lineTo(bB.x, bB.y + bB.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawOutputPanel() {
    const px = 390, py = 36;
    label('Deteksi akhir', px + 200, py - 14, C.txtMute, 10);

    const results = [
      { label: 'Kucing', conf: 0.91, color: C.teal,   box: '[82, 63, 189, 216]' },
      { label: 'Anjing', conf: 0.87, color: C.purple, box: '[243, 78, 335, 231]' },
    ];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const ry = py + 20 + i * 110;

      // Card
      ctx.fillStyle = r.color + '14';
      ctx.strokeStyle = r.color + '55';
      ctx.lineWidth = 0.5;
      roundRect(ctx, px, ry, 300, 94, 8);
      ctx.fill(); ctx.stroke();

      // Top accent line
      ctx.fillStyle = r.color;
      roundRect(ctx, px, ry, 300, 3, [8, 8, 0, 0]);
      ctx.fill();

      // Label
      ctx.save();
      setFont(14, 700);
      ctx.fillStyle = r.color;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(r.label, px + 14, ry + 22);
      ctx.restore();

      // Conf text
      monoLabel(`Confidence: ${(r.conf * 100).toFixed(0)}%`, px + 14, ry + 42, C.txtSec, 9);

      // Confidence bar track
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      roundRect(ctx, px + 14, ry + 52, 200, 6, 3); ctx.fill();

      // Confidence bar fill
      ctx.fillStyle = r.color;
      roundRect(ctx, px + 14, ry + 52, 200 * r.conf, 6, 3); ctx.fill();

      // BBox
      monoLabel('bbox: ' + r.box, px + 14, ry + 74, C.txtMute, 9);
    }

    // Speed note
    ctx.fillStyle = C.teal + 'cc';
    setFont(10);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('⚡  ~45ms · Single forward pass · Real-time capable', px, py + 252);
  }

  // ── Step Definitions ───────────────────────────────────────

  const STEPS = [
    {
      badge: '01',
      title: 'Input Gambar',
      desc: '<strong>YOLO</strong> menerima gambar berukuran tetap — biasanya <strong>448×448 piksel</strong>. Seluruh gambar diproses sekaligus dalam satu kali <em>forward pass</em> melalui jaringan CNN. Berbeda dengan metode dua tahap seperti R-CNN, tidak ada tahap proposal region terpisah.',
      metrics: [
        { label: 'Ukuran Input', val: '448×448' },
        { label: 'Channels', val: 'RGB 3' },
        { label: 'Tipe', val: 'Tensor' },
      ],
      legend: [
        { color: '#8B6914', label: 'Objek: Kucing' },
        { color: '#7c4dba', label: 'Objek: Anjing' },
      ],
      formula: '<span class="f-label">Format input tensor</span>\n<span class="f-eq">X ∈ ℝ^(448 × 448 × 3)</span>',
      draw() {
        clearCanvas();
        drawImage(1);
        arrow(IMG.x + IMG.w + 12, IMG.y + IMG.h / 2, IMG.x + IMG.w + 80, IMG.y + IMG.h / 2, C.teal, 1.5);
        label('→ CNN', IMG.x + IMG.w + 82, IMG.y + IMG.h / 2, C.teal, 11, 'left');
      },
    },
    {
      badge: '02',
      title: 'Pembagian Grid',
      desc: 'Gambar dibagi menjadi grid <strong>S × S</strong> sel (default: 7×7 = 49 sel). Setiap sel bertanggung jawab mendeteksi objek yang <strong>titik pusatnya</strong> berada di dalam sel tersebut. Sel yang mengandung pusat objek disebut "sel aktif".',
      metrics: [
        { label: 'Ukuran Grid', val: '7 × 7' },
        { label: 'Total Sel', val: '49' },
        { label: 'Sel Aktif', val: '2' },
      ],
      legend: [
        { color: '#f59e0b', label: 'Sel aktif (mengandung pusat objek)' },
        { color: '#4a4845', label: 'Sel tidak aktif' },
      ],
      formula: '<span class="f-label">Parameter grid</span>\n<span class="f-eq">S=7, B=2, C=20</span>\n<span style="color:#4a4845">Output: S×S×(B×5+C)</span>',
      draw() {
        clearCanvas();
        const hi = OBJECTS.map(o => ({
          r: Math.floor(o.cy * GRID_ROWS),
          c: Math.floor(o.cx * GRID_COLS),
        }));
        drawImage(0.65);
        drawGrid(1, hi);
        drawObjectCenters();
      },
    },
    {
      badge: '03',
      title: 'Prediksi per Sel',
      desc: 'Setiap sel menghasilkan <strong>B vektor prediksi</strong> (B=2 anchor box). Tiap vektor berisi: koordinat bounding box (x,y,w,h), <strong>confidence score</strong> keberadaan objek, dan <strong>probabilitas kelas</strong> (20 kelas di VOC). Peta kepercayaan menunjukkan sel paling aktif.',
      metrics: [
        { label: 'Anchor/Sel', val: 'B = 2' },
        { label: 'Jumlah Kelas', val: 'C = 20' },
        { label: 'Dim Output', val: '1470' },
      ],
      legend: [
        { color: '#f59e0b', label: 'Confidence tinggi (objek ada)' },
        { color: '#4a4845', label: 'Confidence rendah' },
      ],
      formula: '<span class="f-label">Dimensi output</span>\n<span class="f-eq">7×7×(2×5+20) = 1470</span>',
      draw() {
        clearCanvas();
        drawImage(0.5);
        drawGrid(0.4);
        drawConfidenceMap();
        drawPredPanel();
      },
    },
    {
      badge: '04',
      title: 'Semua Bounding Boxes',
      desc: 'Jaringan menghasilkan <strong>98 bounding box kandidat</strong> (2 per sel × 49 sel). Setiap box memiliki confidence yang berbeda. Sel-sel yang berdekatan sering menghasilkan box yang saling tumpang tindih. Box dengan confidence di bawah threshold dibuang terlebih dahulu.',
      metrics: [
        { label: 'Total Box', val: '98' },
        { label: 'Threshold', val: '> 0.5' },
        { label: 'Tumpang tindih', val: 'Tinggi' },
      ],
      legend: [
        { color: '#00c49a', label: 'Kandidat: Kucing' },
        { color: '#a78bfa', label: 'Kandidat: Anjing' },
      ],
      formula: '<span class="f-label">Jumlah kandidat</span>\n<span class="f-eq">S² × B = 7² × 2 = 98</span>',
      draw() {
        clearCanvas();
        drawImage(0.55);
        drawGrid(0.2);
        drawAllBoxes();
      },
    },
    {
      badge: '05',
      title: 'Non-Maximum Suppression',
      desc: '<strong>NMS</strong> memilih satu bounding box terbaik dari banyak kandidat yang tumpang tindih. Dihitung <strong>IoU</strong> (Intersection over Union) antar box — jika IoU melebihi threshold (0.5), box dengan confidence lebih rendah dihapus. Proses diulang per kelas.',
      metrics: [
        { label: 'IoU Threshold', val: '0.5' },
        { label: 'Box Dihapus', val: '~96' },
        { label: 'Box Tersisa', val: '2' },
      ],
      legend: [
        { color: '#f59e0b', label: 'Area irisan (Intersection)' },
        { color: '#f87171', label: 'Box ditekan (suppressed)' },
        { color: '#00c49a', label: 'Box terpilih (terbaik)' },
      ],
      formula: '<span class="f-label">Rumus IoU</span>\n<span class="f-eq">IoU = |A∩B| / |A∪B|</span>',
      draw() {
        clearCanvas();
        drawImage(0.5);
        drawGrid(0.12);
        ctx.save(); ctx.globalAlpha = 0.18; drawAllBoxes(); ctx.restore();
        drawNMSPanel();
      },
    },
    {
      badge: '06',
      title: 'Output Deteksi Akhir',
      desc: 'Hasil akhir YOLO: <strong>bounding box presisi</strong> dengan label kelas dan confidence score. Seluruh proses hanya memerlukan <strong>satu kali forward pass</strong> — jauh lebih cepat dari metode two-stage. YOLO dapat memproses 45+ FPS pada GPU standar.',
      metrics: [
        { label: 'Objek Terdeteksi', val: '2' },
        { label: 'Inferensi', val: '~45ms' },
        { label: 'Forward Pass', val: '1×' },
      ],
      legend: [
        { color: '#00c49a', label: 'Kucing — 91% confidence' },
        { color: '#a78bfa', label: 'Anjing — 87% confidence' },
      ],
      formula: '<span class="f-label">Keunggulan YOLO</span>\n<span class="f-eq">45+ FPS real-time</span>\n<span style="color:#4a4845">vs R-CNN: ~0.02 FPS</span>',
      draw() {
        clearCanvas();
        drawImage(0.8);
        drawFinalBoxes();
        drawOutputPanel();
      },
    },
  ];

  // ── UI State ───────────────────────────────────────────────
  let currentStep = 0;
  const TOTAL = STEPS.length;

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const progressDots = document.getElementById('progressDots');
  const stepBadge = document.getElementById('stepBadge');
  const stepTitle = document.getElementById('stepTitle');
  const stepDesc = document.getElementById('stepDesc');
  const metricRow = document.getElementById('metricRow');
  const legendBlock = document.getElementById('legendBlock');
  const formulaBox = document.getElementById('formulaBox');

  // Build progress dots
  for (let i = 0; i < TOTAL; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => goStep(i));
    progressDots.appendChild(dot);
  }

  function goStep(n) {
    if (n < 0 || n >= TOTAL) return;
    currentStep = n;
    const s = STEPS[n];

    // Draw canvas
    s.draw();

    // Canvas fade effect
    const cs = document.querySelector('.canvas-section');
    cs.classList.remove('canvas-fade');
    void cs.offsetWidth;
    cs.classList.add('canvas-fade');

    // Update info panel
    stepBadge.textContent = s.badge;
    stepTitle.textContent = s.title;
    stepDesc.innerHTML = s.desc;

    // Metrics
    metricRow.innerHTML = '';
    for (const m of s.metrics) {
      const chip = document.createElement('div');
      chip.className = 'metric-chip';
      chip.innerHTML = `<span class="metric-label">${m.label}</span><span class="metric-val">${m.val}</span>`;
      metricRow.appendChild(chip);
    }

    // Legend
    legendBlock.innerHTML = '';
    for (const l of s.legend) {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `<div class="legend-swatch" style="background:${l.color}"></div><span>${l.label}</span>`;
      legendBlock.appendChild(item);
    }

    // Formula
    formulaBox.innerHTML = `<div class="f-label">Rumus / Catatan</div>${s.formula}`;

    // Nav buttons
    prevBtn.disabled = n === 0;
    nextBtn.disabled = n === TOTAL - 1;

    // Step pills
    document.querySelectorAll('.step-pill').forEach((p, i) => {
      p.classList.toggle('active', i === n);
    });

    // Progress dots
    document.querySelectorAll('.dot').forEach((d, i) => {
      d.classList.toggle('active', i === n);
    });
  }

  // ── Event Listeners ────────────────────────────────────────
  prevBtn.addEventListener('click', () => goStep(currentStep - 1));
  nextBtn.addEventListener('click', () => goStep(currentStep + 1));

  document.querySelectorAll('.step-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.step, 10);
      goStep(n);
    });
  });

  // Keyboard navigation
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goStep(currentStep + 1);
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goStep(currentStep - 1);
  });

  // ── Init ───────────────────────────────────────────────────
  goStep(0);

})();
