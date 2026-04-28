'use client';

/**
 * Pixel-mosaic backdrop — multi-mode mouse interaction.
 * Ported from the Claude-Design handoff (page/project/scripts/bg-mosaic.js).
 *
 * Modes (cycle with the FX button at bottom-right):
 *   flip    — 3D card-flip per tile as cursor passes (front / back faces)
 *   glitch  — RGB-split + jitter shimmer
 *   ripple  — radial wave displaces & recolors tiles
 *   magnet  — tiles drift toward the cursor (hold mouse to repel)
 *   shatter — tiles "fall" off where the cursor sweeps, then heal
 *   reveal  — cursor exposes a hidden under-layer
 *   paint   — cursor leaves a painted trail (fades over ~4s)
 */
import { useEffect, useRef, useState } from 'react';

const PALETTES: Record<string, string[]> = {
  olive: ['#6a7840', '#5b6a35', '#7a8a4e', '#8a9a5b', '#4f5a30', '#a89a5e', '#bdb07a', '#c9b682', '#d4c28a', '#e0d3a0', '#3d4424', '#2a2f18', '#5a4f32', '#8a8470', '#f3ead0'],
  cream: ['#e8dcb8', '#d8c898', '#c9b682', '#b8a05a', '#a08a48', '#f5edc8', '#faf3df', '#8a7a40', '#5a4f32', '#3a3424', '#a88a4a', '#d4b86a', '#8a6a30', '#6a4f20', '#1b1609'],
  dark:  ['#1a1c17', '#0f1010', '#252825', '#3a3a32', '#4a4a3a', '#5a5a48', '#1f2520', '#0a0c08', '#2a2e25', '#15170f', '#3a4030', '#5a6248', '#7a8260', '#0f1208', '#d9cfae'],
};
const BACK_PALETTE = ['#f3ead0', '#e0d3a0', '#bdb07a', '#c9b682', '#d4c28a', '#a89a5e'];

const MODES = ['flip', 'glitch', 'ripple', 'magnet', 'shatter', 'reveal', 'paint'] as const;
export type BgMode = (typeof MODES)[number];

interface Cell {
  baseIdx: number;
  backIdx: number;
  seed: number;
  flip: number;
  flipped: boolean;
  offX: number;
  offY: number;
  fallY: number;
  fallVy: number;
  falling: boolean;
  revealed: number;
  last: number;
}

export function BgMosaic() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<BgMode>('flip');
  const modeRef = useRef<BgMode>(mode);
  modeRef.current = mode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    let cellSize = 30, cols = 0, rows = 0;
    let cells: Cell[] = [];
    let trail: { x: number; y: number; t: number }[] = [];
    let palette = PALETTES.olive;

    const mouse = { x: -9999, y: -9999, lx: 0, ly: 0, vx: 0, vy: 0, down: false };

    function hash(i: number, j: number, s = 0): number {
      let x = (i * 374761393 + j * 668265263 + s * 1442695040888963407) | 0;
      x = (x ^ (x >> 13)) * 1274126177;
      x = (x ^ (x >> 16)) >>> 0;
      return x / 4294967295;
    }

    function pickPalette() {
      const bg = document.body.dataset.bg || 'olive';
      palette = PALETTES[bg] || PALETTES.olive;
    }

    function rebuild() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas!.width = Math.floor(W * dpr);
      canvas!.height = Math.floor(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cellSize = Math.max(22, Math.min(36, Math.floor(W / 64)));
      cols = Math.ceil(W / cellSize) + 1;
      rows = Math.ceil(H / cellSize) + 1;
      cells = new Array(cols * rows);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const r1 = hash(i, j, 1), r2 = hash(i, j, 2), r3 = hash(i, j, 3);
          cells[j * cols + i] = {
            baseIdx: Math.floor(r1 * palette.length),
            backIdx: Math.floor(r2 * BACK_PALETTE.length),
            seed: r3,
            flip: 0,
            flipped: false,
            offX: 0, offY: 0,
            fallY: 0, fallVy: 0, falling: false,
            revealed: 0,
            last: 0,
          };
        }
      }
    }

    // ---------- modes ----------
    function drawFlip(t: number) {
      const cs = cellSize, mx = mouse.x, my = mouse.y;
      const radius = 110, r2 = radius * radius;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const c = cells[j * cols + i];
          const cx = i * cs, cy = j * cs;
          const midX = cx + cs / 2, midY = cy + cs / 2;
          const dx = midX - mx, dy = midY - my;
          if (dx * dx + dy * dy < r2 && !c.flipped) {
            c.flipped = true;
            c.last = t;
          }
          if (c.flipped && c.flip < 1) c.flip = Math.min(1, c.flip + 0.08);
          if (c.flipped && t - c.last > 2.2) {
            c.flip = Math.max(0, c.flip - 0.04);
            if (c.flip <= 0) c.flipped = false;
          }
          const angle = c.flip * Math.PI;
          const sx = Math.cos(angle);
          const showBack = sx < 0;
          const w = Math.abs(sx) * (cs - 2);
          ctx!.fillStyle = showBack ? BACK_PALETTE[c.backIdx] : palette[c.baseIdx];
          ctx!.fillRect(cx + 1 + (cs - 2 - w) / 2, cy + 1, w, cs - 2);
        }
      }
    }

    function drawGlitch() {
      const cs = cellSize, mx = mouse.x, my = mouse.y;
      const speed = Math.min(1, Math.hypot(mouse.vx, mouse.vy) / 30);
      mouse.vx *= 0.85; mouse.vy *= 0.85;
      const radius = 220, r2 = radius * radius;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const c = cells[j * cols + i];
        const cx = i * cs, cy = j * cs;
        const midX = cx + cs / 2, midY = cy + cs / 2;
        const dx = midX - mx, dy = midY - my;
        const d2 = dx * dx + dy * dy;
        const prox = d2 < r2 ? 1 - Math.sqrt(d2) / radius : 0;
        ctx!.globalAlpha = 0.85;
        ctx!.fillStyle = palette[c.baseIdx];
        ctx!.fillRect(cx + 1, cy + 1, cs - 2, cs - 2);
        if (prox > 0.05) {
          const angle = Math.atan2(dy, dx);
          const shift = prox * (12 + speed * 14);
          const ox = Math.cos(angle) * shift, oy = Math.sin(angle) * shift;
          ctx!.globalCompositeOperation = 'screen';
          ctx!.globalAlpha = 0.5 * prox;
          ctx!.fillStyle = '#ff1e3c'; ctx!.fillRect(cx + 1 + ox * 0.6, cy + 1 + oy * 0.2, cs - 2, cs - 2);
          ctx!.fillStyle = '#28ff78'; ctx!.fillRect(cx + 1 - ox * 0.4, cy + 1 - oy * 0.3, cs - 2, cs - 2);
          ctx!.fillStyle = '#3c8cff'; ctx!.fillRect(cx + 1 + ox * 0.2, cy + 1 + oy * 0.7, cs - 2, cs - 2);
          ctx!.globalCompositeOperation = 'source-over';
        }
        ctx!.globalAlpha = 1;
      }
    }

    function drawRipple(t: number) {
      const cs = cellSize, mx = mouse.x, my = mouse.y;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const c = cells[j * cols + i];
        const cx = i * cs, cy = j * cs;
        const midX = cx + cs / 2, midY = cy + cs / 2;
        const d = Math.hypot(midX - mx, midY - my);
        const wave = Math.sin(d * 0.05 - t * 4) * Math.exp(-d / 280);
        const lift = wave * 8;
        const colorShift = Math.floor(
          (c.seed * palette.length + wave * 3 + palette.length) % palette.length,
        );
        ctx!.fillStyle = palette[colorShift];
        ctx!.fillRect(cx + 1, cy + 1 + lift, cs - 2, cs - 2);
      }
    }

    function drawMagnet() {
      const cs = cellSize, mx = mouse.x, my = mouse.y;
      const radius = 200, r2 = radius * radius;
      const repel = mouse.down;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const c = cells[j * cols + i];
        const cx = i * cs, cy = j * cs;
        const midX = cx + cs / 2, midY = cy + cs / 2;
        const dx = midX - mx, dy = midY - my;
        const d2 = dx * dx + dy * dy;
        const prox = d2 < r2 ? 1 - Math.sqrt(d2) / radius : 0;
        const dir = repel ? 1 : -1;
        const tx = (dir * dx) / Math.max(20, Math.sqrt(d2)) * prox * 18;
        const ty = (dir * dy) / Math.max(20, Math.sqrt(d2)) * prox * 18;
        c.offX += (tx - c.offX) * 0.2;
        c.offY += (ty - c.offY) * 0.2;
        ctx!.fillStyle = palette[c.baseIdx];
        ctx!.fillRect(cx + 1 + c.offX, cy + 1 + c.offY, cs - 2, cs - 2);
      }
    }

    function drawShatter() {
      const cs = cellSize, mx = mouse.x, my = mouse.y;
      const radius = 90, r2 = radius * radius;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const c = cells[j * cols + i];
        const cx = i * cs, cy = j * cs;
        const midX = cx + cs / 2, midY = cy + cs / 2;
        const dx = midX - mx, dy = midY - my;
        if (dx * dx + dy * dy < r2 && !c.falling) {
          c.falling = true;
          c.fallVy = (hash(i, j, 9) - 0.5) * 2;
          c.fallY = 0;
        }
        if (c.falling) {
          c.fallVy += 0.45;
          c.fallY += c.fallVy;
          if (cy + c.fallY > H + cs * 2) {
            c.falling = false;
            c.fallY = 0;
            c.fallVy = 0;
          }
        }
        ctx!.globalAlpha = c.falling ? Math.max(0, 1 - c.fallY / H) : 1;
        ctx!.fillStyle = palette[c.baseIdx];
        ctx!.fillRect(cx + 1, cy + 1 + c.fallY, cs - 2, cs - 2);
      }
      ctx!.globalAlpha = 1;
    }

    function drawReveal() {
      const cs = cellSize, mx = mouse.x, my = mouse.y;
      const radius = 130;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const c = cells[j * cols + i];
        const cx = i * cs, cy = j * cs;
        const midX = cx + cs / 2, midY = cy + cs / 2;
        const d = Math.hypot(midX - mx, midY - my);
        const target = d < radius ? 1 - d / radius : 0;
        c.revealed += (target - c.revealed) * 0.18;
        ctx!.fillStyle = palette[c.baseIdx];
        ctx!.fillRect(cx + 1, cy + 1, cs - 2, cs - 2);
        if (c.revealed > 0.02) {
          const inner = BACK_PALETTE[(i + j + c.backIdx) % BACK_PALETTE.length];
          ctx!.globalAlpha = c.revealed;
          ctx!.fillStyle = inner;
          const inset = (1 - c.revealed) * (cs / 2);
          ctx!.fillRect(cx + 1 + inset, cy + 1 + inset, cs - 2 - inset * 2, cs - 2 - inset * 2);
          ctx!.globalAlpha = 1;
        }
      }
    }

    function drawPaint() {
      const cs = cellSize;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const c = cells[j * cols + i];
        ctx!.fillStyle = palette[c.baseIdx];
        ctx!.fillRect(i * cs + 1, j * cs + 1, cs - 2, cs - 2);
      }
      const now = performance.now();
      trail = trail.filter((p) => now - p.t < 4000);
      for (const p of trail) {
        const age = (now - p.t) / 4000;
        const i = Math.floor(p.x / cs), j = Math.floor(p.y / cs);
        if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
        const c = cells[j * cols + i];
        ctx!.globalAlpha = (1 - age) * 0.9;
        ctx!.fillStyle = BACK_PALETTE[(i + j + c.backIdx) % BACK_PALETTE.length];
        ctx!.fillRect(i * cs + 1, j * cs + 1, cs - 2, cs - 2);
      }
      ctx!.globalAlpha = 1;
    }

    // ---------- frame ----------
    const t0 = performance.now();
    let raf = 0;
    let alive = true;
    function frame() {
      if (!alive) return;
      const t = (performance.now() - t0) / 1000;
      ctx!.clearRect(0, 0, W, H);
      const m = modeRef.current;
      if      (m === 'flip')    drawFlip(t);
      else if (m === 'glitch')  drawGlitch();
      else if (m === 'ripple')  drawRipple(t);
      else if (m === 'magnet')  drawMagnet();
      else if (m === 'shatter') drawShatter();
      else if (m === 'reveal')  drawReveal();
      else if (m === 'paint')   drawPaint();
      // grout
      ctx!.globalCompositeOperation = 'multiply';
      ctx!.fillStyle = 'rgba(0,0,0,0.16)';
      for (let i = 0; i <= cols; i++) ctx!.fillRect(i * cellSize, 0, 1, H);
      for (let j = 0; j <= rows; j++) ctx!.fillRect(0, j * cellSize, W, 1);
      ctx!.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(frame);
    }

    // ---------- listeners ----------
    const onMouseMove = (e: MouseEvent) => {
      mouse.vx = e.clientX - mouse.lx;
      mouse.vy = e.clientY - mouse.ly;
      mouse.lx = e.clientX;
      mouse.ly = e.clientY;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (modeRef.current === 'paint') {
        trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      }
    };
    const onMouseDown = () => { mouse.down = true; };
    const onMouseUp = () => { mouse.down = false; };
    const onMouseLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    const onResize = () => rebuild();

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('resize', onResize);

    const obs = new MutationObserver(() => {
      pickPalette();
      rebuild();
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-bg'] });

    pickPalette();
    rebuild();
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', onResize);
      obs.disconnect();
    };
  }, []);

  const cycleMode = () => {
    const i = MODES.indexOf(mode);
    setMode(MODES[(i + 1) % MODES.length]);
  };

  return (
    <>
      <canvas ref={canvasRef} className="bg-mosaic" aria-hidden="true" />
      <button
        type="button"
        className="bg-fx-btn"
        onClick={cycleMode}
        title="Cycle background effect"
      >
        FX · {mode.toUpperCase()} ▸
      </button>
    </>
  );
}
