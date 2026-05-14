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
  let animationFrameId = null;
  let stepStartTime = performance.now() / 1000;
  const sceneImage = new Image();
  sceneImage.src = 'catdog.jpg';

  // ── Color Palette ──────────────────────────────────────────
  const C = {
    bg:        '#0d0e0f',
    surface:   '#141516',
    surface2:  '#1a1c1e',
    border:    'rgba(255,255,255,0.08)',
    borderHi:  'rgba(255,255,255,0.22)',
    amber:     '#f59e0b',
    amberDim:  'rgba(245,158,11,0.14)',
    teal:      '#14b8a6',
    tealDim:   'rgba(20,184,166,0.12)',
    purple:    '#7c4dba',
    purpleDim: 'rgba(124,77,186,0.12)',
    coral:     '#ff6b6b',
    blue:      '#60a5fa',
    txtMute:   '#9aa0a6',
    txtSec:    '#e8e6e0',
    // utility: allow appending alpha suffixes in code (e.g., C.teal + 'cc')
  };

  // Layout & grid defaults
  const GRID_ROWS = 7;
  const GRID_COLS = 7;
  const IMG = { x: 36, y: 28, w: 320, h: 320 };
  const CELL_W = IMG.w / GRID_COLS;
  const CELL_H = IMG.h / GRID_ROWS;

  // Scene objects (two example detections: cat and dog)
  const OBJECTS = [
    // moved cat center one grid cell to the right
    { cx: 0.363, cy: 0.60, w: 0.36, h: 0.56, label: 'Kucing', conf: 0.91, color: C.amber },
    { cx: 0.68, cy: 0.46, w: 0.34, h: 0.58, label: 'Anjing', conf: 0.87, color: C.purple },
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

  function pulse(time, speed = 1, phase = 0) {
    return 0.5 + 0.5 * Math.sin(time * speed + phase);
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function easeOutCubic(value) {
    const t = clamp01(value);
    return 1 - Math.pow(1 - t, 3);
  }

  function readableCanvasColor(color) {
    if (color === C.txtMute) return 'rgba(232,230,224,0.84)';
    if (color === C.txtSec) return 'rgba(232,230,224,0.92)';
    return color;
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
    ctx.fillStyle = readableCanvasColor(color);
    ctx.strokeStyle = 'rgba(13,14,15,0.92)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function monoLabel(text, x, y, color = C.txtSec, size = 10, align = 'left') {
    ctx.save();
    monoFont(size);
    ctx.fillStyle = readableCanvasColor(color);
    ctx.strokeStyle = 'rgba(13,14,15,0.92)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ── Drawing Primitives ─────────────────────────────────────

  function clearCanvas() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawImage(alpha = 1, time = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;

    // Image frame
    roundRect(ctx, IMG.x, IMG.y, IMG.w, IMG.h, 8);
    ctx.fillStyle = C.surface;
    ctx.fill();
    ctx.strokeStyle = C.borderHi;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    const innerX = IMG.x + 1;
    const innerY = IMG.y + 1;
    const innerW = IMG.w - 2;
    const innerH = IMG.h - 2;

    if (sceneImage.complete && sceneImage.naturalWidth > 0) {
      ctx.save();
      roundRect(ctx, innerX, innerY, innerW, innerH, 8);
      ctx.clip();
      const scale = Math.max(innerW / sceneImage.naturalWidth, innerH / sceneImage.naturalHeight);
      const drawW = sceneImage.naturalWidth * scale;
      const drawH = sceneImage.naturalHeight * scale;
      const drawX = innerX + (innerW - drawW) / 2;
      const drawY = innerY + (innerH - drawH) / 2;
      ctx.drawImage(sceneImage, drawX, drawY, drawW, drawH);
      ctx.restore();
    } else {
      ctx.fillStyle = '#1b2230';
      ctx.fillRect(innerX, innerY, innerW, innerH * 0.46);
      ctx.fillStyle = '#1b2618';
      ctx.fillRect(innerX, innerY + innerH * 0.46, innerW, innerH * 0.54);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fillRect(innerX, innerY, innerW, innerH);

    // Mild scan band to indicate processing.
    const sweep = (time * 8) % (innerH + 40) - 20;
    const scan = ctx.createLinearGradient(IMG.x, IMG.y + sweep, IMG.x + IMG.w, IMG.y + sweep + 42);
    scan.addColorStop(0, 'rgba(255,255,255,0)');
    scan.addColorStop(0.5, 'rgba(255,255,255,0.035)');
    scan.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = scan;
    ctx.fillRect(innerX, IMG.y + sweep, innerW, 42);

    ctx.restore();

    // Frame label
    label('448 × 448 px', IMG.x + IMG.w / 2, IMG.y - 14, C.txtMute, 10);
  }

  function drawGrid(alpha = 1, highlightCells = [], time = 0, reveal = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    // Grid-only reveal: each cell becomes a dark overlay square, one by one.
    const showCells = highlightCells.length > 0;
    const cellDelay = 0.022; // slightly slower stagger for a calmer reveal
    const totalCells = GRID_ROWS * GRID_COLS;
    if (showCells) {
      // Darken the whole image first so the overlay reads consistently.
      ctx.save();
      ctx.globalAlpha = 0.28 * alpha;
      ctx.fillStyle = 'rgba(4, 8, 18, 0.96)';
      ctx.fillRect(IMG.x, IMG.y, IMG.w, IMG.h);
      ctx.restore();

      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const idx = r * GRID_COLS + c;
          const start = (idx / totalCells) * 0.72;
          const raw = clamp01((reveal - start) / 0.28);
          const cr = easeOutCubic(raw);
          if (cr > 0.005) {
              const x = IMG.x + c * CELL_W;
              const y = IMG.y + r * CELL_H;
              const w = CELL_W;
              const h = CELL_H;
            // full-size dark overlay square that reaches the exact cell bounds
            ctx.save();
              ctx.globalAlpha = (0.16 + 0.12 * cr) * alpha;
              ctx.fillStyle = 'rgba(4, 8, 18, 0.92)';
            ctx.fillRect(x, y, w, h);
            // Grid border with slightly higher visibility
            ctx.globalAlpha = (0.05 + 0.08 * cr) * alpha;
            ctx.strokeStyle = 'rgba(255,255,255,0.22)';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(x, y, w, h);
            ctx.restore();
          }
        }
      }
      // Active cells get a slightly stronger shade, but still no visible grid lines.
      for (let i = 0; i < highlightCells.length; i++) {
        const { r, c } = highlightCells[i];
        const idx = r * GRID_COLS + c;
        const raw = clamp01((reveal - idx * cellDelay) * 1.8);
        const hi = (0.18 + pulse(time, 2, i) * 0.10) * easeOutCubic(raw);
        if (hi > 0.01) {
          ctx.fillStyle = `rgba(0, 0, 0, ${0.12 + hi})`;
          ctx.fillRect(IMG.x + c * CELL_W, IMG.y + r * CELL_H, CELL_W, CELL_H);
        }
      }
    } else {
      // Other steps keep the previous visible grid lines.
      const dashOffset = -time * 24;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 8]);
      ctx.lineDashOffset = dashOffset;

      let lineIndex = 0;
      for (let r = 0; r <= GRID_ROWS; r++) {
        const y = IMG.y + r * CELL_H;
        const lineReveal = clamp01((reveal - lineIndex * 0.06) * 1.9);
        if (lineReveal > 0.02) {
          ctx.globalAlpha = alpha * lineReveal * 0.9;
          ctx.strokeStyle = C.blue + 'bb';
          ctx.beginPath(); ctx.moveTo(IMG.x, y); ctx.lineTo(IMG.x + IMG.w, y); ctx.stroke();
        }
        lineIndex += 1;
      }
      for (let c = 0; c <= GRID_COLS; c++) {
        const x = IMG.x + c * CELL_W;
        const lineReveal = clamp01((reveal - lineIndex * 0.06) * 1.9);
        if (lineReveal > 0.02) {
          ctx.globalAlpha = alpha * lineReveal * 0.9;
          ctx.strokeStyle = C.blue + 'bb';
          ctx.beginPath(); ctx.moveTo(x, IMG.y); ctx.lineTo(x, IMG.y + IMG.h); ctx.stroke();
        }
        lineIndex += 1;
      }

    }

    ctx.setLineDash([]);
    ctx.globalAlpha = alpha;
    ctx.restore();

    label('Grid 7 × 7', IMG.x + IMG.w / 2, IMG.y + IMG.h + 18, C.txtMute, 10);
  }

  function drawConfidenceMap(time = 0) {
    for (const { r, c, conf } of CONF_MAP) {
      if (conf < 0.04) continue;
      const shimmer = 0.03 + pulse(time, 1.2, r * 0.4 + c * 0.2) * 0.04;
      ctx.fillStyle = `rgba(245,158,11,${Math.min(0.48, conf * 0.28 + shimmer)})`;
      ctx.fillRect(IMG.x + c * CELL_W + 0.5, IMG.y + r * CELL_H + 0.5, CELL_W - 1, CELL_H - 1);
    }
  }

  function drawObjectCenters(time = 0) {
    for (let i = 0; i < OBJECTS.length; i++) {
      const o = OBJECTS[i];
      const [cx, cy] = toScene(o.cx, o.cy);
      const radius = 4.5 + pulse(time, 1.4, i) * 0.6;
      const drawColor = o.label === 'Kucing' ? '#00c49a' : (o.label === 'Anjing' ? '#a78bfa' : o.color);
      
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = drawColor; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  function drawAllBoxes(time = 0) {
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
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const driftX = Math.sin(time * 1.1 + i * 0.7) * 0.4;
      const driftY = Math.cos(time * 0.9 + i * 0.5) * 0.35;
      const [bx, by] = toScene(b.x, b.y);
      const bw = b.w * IMG.w, bh = b.h * IMG.h;
      const pop = 0.42 + pulse(time, 1.1, i * 0.55) * 0.12;
      ctx.globalAlpha = pop;
      ctx.fillStyle = b.color + '18';
      ctx.fillRect(bx + driftX, by + driftY, bw, bh);
      ctx.strokeStyle = b.color + 'cc';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(bx + driftX, by + driftY, bw, bh);
      monoLabel((b.conf * 100).toFixed(0) + '%', bx + 3 + driftX, by + 8 + driftY, b.color, 8);
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Draw boxes sequentially by confidence (for step 04)
  function drawAllBoxesSequenced(time = 0) {
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

    // order by confidence desc
    const ordered = boxes.slice().sort((a, b) => b.conf - a.conf);
    const baseDelay = 0.28;
    const perBox = 0.06;
    const dur = 0.26;

    for (let i = 0; i < ordered.length; i++) {
      const b = ordered[i];
      const t0 = baseDelay + i * perBox;
      const t = clamp01((time - t0) / dur);
      if (t <= 0) continue;
      const pop = easeOutCubic(t);

      const [bx, by] = toScene(b.x, b.y);
      const bw = b.w * IMG.w, bh = b.h * IMG.h;

      // subtle pop & fade
      ctx.save();
      ctx.globalAlpha = 0.12 + pop * 0.88;
      ctx.fillStyle = b.color + '18';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = b.color + 'cc';
      ctx.lineWidth = 0.9 + pop * 1.2;
      ctx.strokeRect(bx, by, bw, bh);
      monoLabel((b.conf * 100).toFixed(0) + '%', bx + 4, by + 10, b.color, 9);
      ctx.restore();
    }
  }

  function drawFinalBoxes(time = 0) {
    for (let i = 0; i < OBJECTS.length; i++) {
      const o = OBJECTS[i];
      const bx = IMG.x + (o.cx - o.w / 2) * IMG.w;
      const by = IMG.y + (o.cy - o.h / 2) * IMG.h;
      const bw = o.w * IMG.w;
      const bh = o.h * IMG.h;
      const appear = 0.88 + pulse(time, 1.2, i) * 0.04;

      const drawColor = o.label === 'Kucing' ? '#00c49a' : (o.label === 'Anjing' ? '#a78bfa' : o.color);

      // Fill
      ctx.save();
      ctx.globalAlpha = appear;
      ctx.fillStyle = drawColor + '18';
      ctx.fillRect(bx, by, bw, bh);

      // Border
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(bx, by, bw, bh);

      // Corner accents
      const L = 14;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = drawColor;
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
      ctx.fillStyle = drawColor; ctx.fill();
      ctx.fillStyle = '#000';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, bx + 7, by - 13);
      ctx.restore();
      ctx.restore();
    }
  }

  // ── Panel Drawings (right side of canvas) ─────────────────

  function drawCNNPanel(time = 0) {
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

      // Pulsing activations inside each layer.
      const dotY = ly + l.h / 2;
      const dotX = lx + l.w / 2 + Math.sin(time * 1.1 + i) * 1.5;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2 + pulse(time, 1.4, i) * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = l.color;
      ctx.fill();

      lx += l.w + 10;
    }

    // Input arrow
    arrow(IMG.x + IMG.w + 12, IMG.y + IMG.h / 2, px - 2, py + 110, C.teal, 1);
    monoLabel('tensor', IMG.x + IMG.w + 14, IMG.y + IMG.h / 2 - 10, C.txtMute, 9);

    const flow = (time * 0.28) % 1;
    const flowX = IMG.x + IMG.w + 12 + (px - 2 - (IMG.x + IMG.w + 12)) * flow;
    const flowY = IMG.y + IMG.h / 2 + (py + 110 - IMG.y - IMG.h / 2) * flow;
    ctx.beginPath();
    ctx.arc(flowX, flowY, 4, 0, Math.PI * 2);
    ctx.fillStyle = C.teal;
    ctx.fill();

    // Feature stream inside the backbone.
    const featureFlow = (time * 0.36) % 1;
    ctx.save();
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < layers.length - 1; i++) {
      const startX = px + i * 28 + 18;
      const startY = py + 110;
      const nextX = startX + 16;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(nextX, startY);
      ctx.strokeStyle = i < 2 ? C.blue : i < 4 ? C.purple : C.teal;
      ctx.lineWidth = 1;
      ctx.stroke();

      const dotX = startX + 16 * featureFlow;
      ctx.beginPath();
      ctx.arc(dotX, startY, 1.8 + pulse(time, 1.6, i) * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPredPanel(time = 0) {
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
      const entry = easeOutCubic((time - i * 0.12) / 0.7);
      const glow = 0.06 + pulse(time, 1.0, i * 0.8) * 0.04;
      ctx.fillStyle = it.color + '14';
      roundRect(ctx, px, iy, 260, 20, 3);
      ctx.fill();
      ctx.strokeStyle = it.color + '44';
      ctx.lineWidth = 0.5; ctx.stroke();
      ctx.save();
      ctx.globalAlpha = 0.15 + entry * 0.7;
      if (i === Math.floor(time * 0.7) % items.length) {
        ctx.globalAlpha *= 1.2;
      }
      if (entry > 0) {
        ctx.fillStyle = it.color;
        ctx.fillRect(px, iy, 260 * entry, 20);
      }
      ctx.restore();
      if (i === Math.floor(time * 0.7) % items.length) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = it.color;
        ctx.strokeRect(px - 1, iy - 1, 262, 22);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(px + 14, iy + 8, 52 + pulse(time, 0.7, i) * 26, 4);
      monoLabel(it.label, px + 10, iy + 10, it.color, 9);
    }

    // Arrow from grid to panel
    arrow(IMG.x + IMG.w + 10, IMG.y + 100, px - 5, py + 80, C.amber, 1);
    monoLabel('49 sel', IMG.x + IMG.w + 12, IMG.y + 90, C.txtMute, 9);

    const pickY = py + 32 + (Math.sin(time * 0.9) > 0 ? 0 : 26);
    ctx.save();
    ctx.strokeStyle = C.amber;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px - 2, pickY - 10, 264, 24);
    ctx.restore();
  }

  function drawCandidateRankPanel(time = 0) {
    const px = 390, py = 36;
    label('Ranking kandidat box', px + 140, py - 14, C.txtMute, 10);

    const ranks = [
      { label: 'Kucing', conf: 0.91, color: C.teal },
      { label: 'Anjing', conf: 0.87, color: C.purple },
      { label: 'Kucing', conf: 0.72, color: C.teal },
      { label: 'Anjing', conf: 0.70, color: C.purple },
      { label: 'Kucing', conf: 0.65, color: C.teal },
    ];

    for (let i = 0; i < ranks.length; i++) {
      const item = ranks[i];
      const ry = py + 18 + i * 42;
      const entry = easeOutCubic((time - i * 0.14) / 0.65);
      const focus = i === (Math.floor(time * 0.9) % 2) ? 1 : 0;
      ctx.save();
      ctx.globalAlpha = 0.15 + entry * 0.85;
      ctx.fillStyle = item.color + (focus ? '20' : '10');
      ctx.strokeStyle = item.color + (focus ? '66' : '38');
      ctx.lineWidth = 0.5;
      roundRect(ctx, px, ry, 270, 30, 6);
      ctx.fill(); ctx.stroke();

      monoLabel(String(i + 1).padStart(2, '0'), px + 10, ry + 15, C.txtMute, 9);
      monoLabel(item.label, px + 38, ry + 15, item.color, 9);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      roundRect(ctx, px + 150, ry + 10, 96, 8, 3);
      ctx.fill();
      ctx.fillStyle = item.color;
      roundRect(ctx, px + 150, ry + 10, 96 * item.conf * entry, 8, 3);
      ctx.fill();
      monoLabel(`${(item.conf * 100).toFixed(0)}%`, px + 252, ry + 15, item.color, 8, 'right');
      ctx.restore();
    }

    arrow(IMG.x + IMG.w + 10, IMG.y + 122, px - 8, py + 48, C.teal, 1);
    monoLabel('semua box kandidat', IMG.x + IMG.w + 14, IMG.y + 112, C.txtMute, 9);
  }

  function drawNMSPanel(time = 0) {
    const px = 390, py = 36;
    label('Non-Maximum Suppression', px + 200, py - 14, C.txtMute, 10);

    // We'll animate the NMS process: pick best, compare sequentially, then suppress

    // Define candidate boxes (same layout as drawAllBoxesSequenced)
    const candidates = [
      { x: 0.14, y: 0.18, w: 0.40, h: 0.64, conf: 0.91, color: C.teal },
      { x: 0.56, y: 0.20, w: 0.34, h: 0.58, conf: 0.87, color: C.purple },
      { x: 0.10, y: 0.22, w: 0.46, h: 0.58, conf: 0.72, color: C.teal },
      { x: 0.52, y: 0.16, w: 0.40, h: 0.64, conf: 0.70, color: C.purple },
      { x: 0.18, y: 0.14, w: 0.37, h: 0.70, conf: 0.65, color: C.teal },
      { x: 0.59, y: 0.24, w: 0.32, h: 0.52, conf: 0.62, color: C.purple },
      { x: 0.16, y: 0.20, w: 0.38, h: 0.60, conf: 0.55, color: C.teal },
      { x: 0.54, y: 0.18, w: 0.36, h: 0.58, conf: 0.53, color: C.purple },
      { x: 0.11, y: 0.12, w: 0.42, h: 0.72, conf: 0.47, color: C.teal },
      { x: 0.50, y: 0.22, w: 0.42, h: 0.60, conf: 0.44, color: C.purple },
    ];

    function toBoxRect(b) {
      const bx = IMG.x + b.x * IMG.w;
      const by = IMG.y + b.y * IMG.h;
      return { x: bx, y: by, w: b.w * IMG.w, h: b.h * IMG.h };
    }

    function rectIoU(a, b) {
      const ix = Math.max(a.x, b.x);
      const iy = Math.max(a.y, b.y);
      const ix2 = Math.min(a.x + a.w, b.x + b.w);
      const iy2 = Math.min(a.y + a.h, b.y + b.h);
      const interW = Math.max(0, ix2 - ix);
      const interH = Math.max(0, iy2 - iy);
      const inter = interW * interH;
      const areaA = a.w * a.h;
      const areaB = b.w * b.h;
      return areaA + areaB - inter <= 0 ? 0 : inter / (areaA + areaB - inter);
    }

    // Order candidates by confidence
    const order = candidates.slice().sort((a, b) => b.conf - a.conf);
    const base = 0.6; // when first pick occurs
    const per = 0.32; // per comparison
    const threshold = 0.5;

    // draw candidate boxes on image with dynamic alpha depending on suppression
    const rects = candidates.map(toBoxRect);

    // compute IoUs between best and others
    const best = toBoxRect(order[0]);

    // Draw sequence: highlight best after base, then for each other box animate IoU bar and suppression
    for (let k = 0; k < order.length; k++) {
      const b = order[k];
      const r = toBoxRect(b);
      const t0 = base + Math.max(0, k - 1) * per; // k=0 is best
      const prog = clamp01((time - t0) / per);

      let alpha = 0.12; // default faint
      let suppressed = false;

      if (k === 0) {
        // best box pulses when picked
        const pickProg = clamp01((time - base) / 0.5);
        alpha = 0.25 + 0.6 * Math.sin(pickProg * Math.PI);
      } else {
        const iouVal = rectIoU(best, r);
        // animate a comparison bar in panel
        const barX = px + 180, barY = py + 58 + k * 12;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        roundRect(ctx, barX, barY, 112, 8, 4); ctx.fill();
        ctx.fillStyle = iouVal > threshold ? C.coral : C.teal;
        roundRect(ctx, barX, barY, 112 * Math.min(1, iouVal), 8, 4); ctx.fill();
        monoLabel(`IoU ${iouVal.toFixed(2)}`, barX + 56, barY + 4, C.txtSec, 8, 'center');
        ctx.restore();

        if (prog > 0.02) {
          // if IoU exceed threshold, fade out (suppress)
          if (iouVal > threshold) {
            suppressed = true;
            alpha = 0.9 * (1 - easeOutCubic(prog));
          } else {
            alpha = 0.18 + 0.7 * easeOutCubic(prog);
          }
        }
      }

      // draw box on image with computed alpha
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = b.color + '16';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = b.color + 'cc'; ctx.lineWidth = 1.2; ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.restore();

      // draw cross if suppressed and late in animation
      if (suppressed && prog > 0.5) {
        ctx.save();
        ctx.strokeStyle = C.coral + 'bb'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + r.w, r.y + r.h);
        ctx.moveTo(r.x + r.w, r.y); ctx.lineTo(r.x, r.y + r.h); ctx.stroke();
        ctx.restore();
      }
    }

    // Box A
    const bA = { x: px + 20, y: py + 20, w: 100, h: 78 };
    const pick = easeOutCubic(time / 0.8);
    ctx.fillStyle = C.tealDim; ctx.strokeStyle = C.teal; ctx.lineWidth = 1;
    roundRect(ctx, bA.x, bA.y, bA.w, bA.h, 4); ctx.fill(); ctx.stroke();
    monoLabel('A  0.91', bA.x + 5, bA.y + 11, C.teal, 9);

    // Box B
    const nmsPulse = pulse(time, 0.7);
    const bB = {
      x: px + 98 - pick * 33 + nmsPulse * 0.6,
      y: py + 58 - pick * 14 + nmsPulse * 0.5,
      w: 100 - pick * 12,
      h: 78 - pick * 9,
    };
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
    monoLabel('∩', ix + (ix2 - ix) / 2 - 4, iy + (iy2 - iy) / 2 + Math.sin(time * 3) * 2, C.amber, 11);

    const iou = 0.42 + pick * 0.24;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, px + 180, py + 58, 112, 10, 5); ctx.fill();
    ctx.fillStyle = iou > 0.5 ? C.coral : C.teal;
    roundRect(ctx, px + 180, py + 58, 112 * Math.min(1, iou), 10, 5); ctx.fill();
    monoLabel(`IoU ${iou.toFixed(2)}`, px + 236, py + 55, iou > 0.5 ? C.coral : C.teal, 9, 'center');

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
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const lift = pulse(time, 0.8, i) * 0.35;
      const active = i === 2 && iou > 0.5;
      monoLabel(s.text, px + 20, sy - lift, active ? C.coral : s.ok ? C.teal : C.txtMute, 9);
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

  function drawOutputPanel(time = 0) {
    const px = 390, py = 36;
    label('Deteksi akhir', px + 200, py - 14, C.txtMute, 10);

    const results = [
      { label: 'Kucing', conf: 0.91, color: C.teal,   box: '[82, 63, 189, 216]' },
      { label: 'Anjing', conf: 0.87, color: C.purple, box: '[243, 78, 335, 231]' },
    ];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const ry = py + 20 + i * 110;
      const entry = easeOutCubic((time - i * 0.18) / 0.7);
      const slide = pulse(time, 0.6, i) * 1.2;

      // Card
      ctx.save();
      ctx.globalAlpha = 0.2 + entry * 0.8;
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
      ctx.fillText(r.label, px + 14 + slide, ry + 22);
      ctx.restore();

      // Conf text
      monoLabel(`Confidence: ${(r.conf * 100).toFixed(0)}%`, px + 14, ry + 42, C.txtSec, 9);

      // Confidence bar track
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      roundRect(ctx, px + 14, ry + 52, 200, 6, 3); ctx.fill();

      // Confidence bar fill
      ctx.fillStyle = r.color;
      roundRect(ctx, px + 14, ry + 52, 200 * r.conf * entry, 6, 3); ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      roundRect(ctx, px + 14 + 200 * r.conf - 5, ry + 50, 10, 10, 5); ctx.fill();

      ctx.save();
      ctx.globalAlpha = 0.22 + entry * 0.22;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 12, ry + 12, 276, 66);
      ctx.restore();

      // BBox
      monoLabel('bbox: ' + r.box, px + 14, ry + 74, C.txtMute, 9);
      ctx.restore();
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
      draw(time = 0) {
        clearCanvas();
        drawImage(1, time);
        drawCNNPanel(time);
        const launch = (time * 0.35) % 1;
        const sx = IMG.x + IMG.w + 12;
        const ex = 400;
        const sy = IMG.y + IMG.h / 2;
        const ey = 150;
        ctx.save();
        ctx.strokeStyle = C.teal;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(sx + (ex - sx) * launch, sy + (ey - sy) * launch, 3 + pulse(time, 1.3) * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = C.teal;
        ctx.fill();
        label('feature map masuk ke backbone', 620, 156, C.txtMute, 10, 'center');
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
      draw(time = 0) {
          clearCanvas();
          const hi = OBJECTS.map(o => ({
            r: Math.floor(o.cy * GRID_ROWS),
            c: Math.floor(o.cx * GRID_COLS),
          }));

          // staged reveal when entering Grid step
        const duration = 0.82; // seconds
          const revealRaw = clamp01(time / duration);
          const reveal = easeOutCubic(revealRaw);

          drawImage(0.65, time);
          drawGrid(1, hi, time, reveal);
          // object centers fade in with grid reveal
          ctx.save(); ctx.globalAlpha = reveal; drawObjectCenters(time); ctx.restore();

          // highlight selected cell after grid is mostly visible
          if (revealRaw > 0.45) {
            const selIndex = Math.floor((time - duration * 0.45) * 1.8);
            const selected = hi[(selIndex % hi.length + hi.length) % hi.length];
            const [sx, sy] = [IMG.x + (selected.c + 0.5) * CELL_W, IMG.y + (selected.r + 0.5) * CELL_H];
            ctx.save();
            ctx.strokeStyle = C.amber;
            ctx.lineWidth = 1.2;
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            ctx.arc(sx, sy, 12 + reveal * 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            for (const o of OBJECTS) {
              const [cx, cy] = toScene(o.cx, o.cy);
              ctx.save();
              ctx.strokeStyle = o.color;
              ctx.lineWidth = 1;
              ctx.setLineDash([3, 4]);
              ctx.beginPath();
              ctx.moveTo(cx, cy);
              ctx.lineTo(sx, sy);
              ctx.stroke();
              ctx.restore();
            }
          }
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
      draw(time = 0) {
        clearCanvas();
        drawImage(0.5, time);
        drawGrid(0.4, [], time);
        drawConfidenceMap(time);
        drawPredPanel(time);

        // Sequential reveal: order cells by confidence and animate vectors one-by-one
        const ordered = CONF_MAP.slice().sort((a, b) => b.conf - a.conf);
        const baseDelay = 0.28; // seconds before first cell starts
        const perCell = 0.06; // stagger per cell
        const cellDur = 0.22; // each cell animation duration
        const panelX = 390, panelY = 36 + 80; // approximate pred panel anchor

        for (let i = 0; i < ordered.length; i++) {
          const c = ordered[i];
          const t0 = baseDelay + i * perCell;
          const t = clamp01((time - t0) / cellDur);
          const progress = easeOutCubic(t);
          if (t <= 0) continue;

          // cell center
          const cx = IMG.x + (c.c + 0.5) * CELL_W;
          const cy = IMG.y + (c.r + 0.5) * CELL_H;

          // highlight cell lightly as it animates
          ctx.save();
          ctx.globalAlpha = 0.12 + 0.6 * progress * Math.min(1, c.conf * 1.6);
          ctx.fillStyle = C.amber;
          ctx.fillRect(IMG.x + c.c * CELL_W + 1, IMG.y + c.r * CELL_H + 1, CELL_W - 2, CELL_H - 2);
          ctx.restore();

          // draw vector dot moving from cell center toward pred panel area
          const targetX = panelX - 18;
          const targetY = panelY + (i % 8) * 10; // spread vertically more to avoid overlap
          const dotX = cx + (targetX - cx) * progress;
          const dotY = cy + (targetY - cy) * progress;

          // alpha peaks mid-flight to reduce clustering near endpoints
          const peakAlpha = 0.9 * progress * (1 - progress) * Math.min(1, c.conf * 1.6);
          if (peakAlpha > 0.02) {
            ctx.save();
            ctx.beginPath(); ctx.arc(dotX, dotY, 1.2 + progress * 1.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${peakAlpha})`;
            ctx.fill();
            ctx.restore();

            // faint trail line
            ctx.save();
            ctx.strokeStyle = `rgba(255,255,255,${0.06 * progress})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(dotX, dotY); ctx.stroke();
            ctx.restore();
          }
        }

        // subtle focus on true objects after sequence finishes a bit
        const seqEnd = baseDelay + ordered.length * perCell + 0.3;
        if (time > seqEnd) {
          for (let j = 0; j < OBJECTS.length; j++) {
            const o = OBJECTS[j];
            const [fx, fy] = toScene(o.cx, o.cy);
            ctx.save();
            ctx.strokeStyle = o.color;
            ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(fx, fy, 14 + pulse(time, 1.1, j) * 2.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            arrow(fx + 18, fy, 390, 100 + j * 26, o.color, 1);
          }
        }
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
      draw(time = 0) {
          clearCanvas();
          drawImage(0.55, time);
          drawGrid(0.2, [], time);
          drawAllBoxesSequenced(time);
          drawCandidateRankPanel(time);
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
      draw(time = 0) {
          clearCanvas();
          drawImage(0.5, time);
          drawGrid(0.12, [], time);
          ctx.save(); ctx.globalAlpha = 0.2; drawAllBoxesSequenced(time); ctx.restore();
          drawNMSPanel(time);
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
      draw(time = 0) {
        clearCanvas();
        drawImage(0.8, time);
        drawFinalBoxes(time);
        drawOutputPanel(time);
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
    stepStartTime = performance.now() / 1000;

    // Draw canvas
    s.draw(0);

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

  function render(now) {
    const time = now / 1000 - stepStartTime;
    STEPS[currentStep].draw(time);
    animationFrameId = requestAnimationFrame(render);
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
  animationFrameId = requestAnimationFrame(render);

})();
