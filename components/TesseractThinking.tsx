"use client";
import React, { useEffect, useRef } from "react";

/* A tesseract (4D hypercube) rotating in four dimensions and projected down to your screen.
   This is the real geometry, not a CSS imitation: 16 vertices at (±1, ±1, ±1, ±1), 32 edges between
   vertices that differ in exactly one coordinate. Each frame we rotate in the XW, ZW and YZ planes,
   perspective-project 4D to 3D, then 3D to 2D. A bright comet travels a Hamiltonian cycle through all
   16 vertices (a Gray code, so every step is a real edge). No glow, no blur: thin lines, depth by opacity.

   Used by the chat while Zelrex is working (app/chat/ChatPageClient.tsx). */

const ACCENT = [74, 144, 255];    /* #4A90FF, far edges */
const BRIGHT = [196, 220, 255];   /* near edges and the comet */

export type Vec4 = [number, number, number, number];
export type Edge = [number, number];

/** 16 vertices and 32 edges of the unit tesseract. */
export function buildTesseract(): { vertices: Vec4[]; edges: Edge[] } {
  const vertices: Vec4[] = [];
  for (let i = 0; i < 16; i++) vertices.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
  const edges: Edge[] = [];
  for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) { const j = i ^ (1 << b); if (j > i) edges.push([i, j]); }
  return { vertices, edges };
}

/** A cyclic Gray code over 4 bits: 16 vertices where each consecutive pair (including last to first) is an edge. */
export const GRAY_CYCLE: number[] = Array.from({ length: 16 }, (_, i) => i ^ (i >> 1));

/** Rotate a 4D point by angle `a` in the plane of axes `i` and `j`. */
export function rotate4(v: Vec4, i: number, j: number, a: number): Vec4 {
  const c = Math.cos(a), s = Math.sin(a);
  const out: Vec4 = [v[0], v[1], v[2], v[3]];
  out[i] = v[i] * c - v[j] * s;
  out[j] = v[i] * s + v[j] * c;
  return out;
}

const { vertices: V, edges: E } = buildTesseract();

const D4 = 3.4;  /* viewer distance along W; must exceed the max |w| (2) so nothing flips through the camera */
const D3 = 7.5;  /* viewer distance along Z for the 3D to 2D step */

/** Project every vertex at time t (seconds). Returns screen coords in [-1, 1]-ish plus a 0..1 depth (1 = nearest). */
export function projectAt(t: number): { x: number; y: number; depth: number }[] {
  const pts = V.map((v0) => {
    let v = rotate4(v0, 0, 3, t * 0.55);   /* XW: the "inside-out" motion that makes it a tesseract and not a cube */
    v = rotate4(v, 2, 3, t * 0.37);        /* ZW */
    v = rotate4(v, 1, 2, t * 0.23);        /* YZ: slow tumble so the silhouette never settles */
    const k4 = D4 / (D4 - v[3]);
    let p: [number, number, number] = [v[0] * k4, v[1] * k4, v[2] * k4];
    /* fixed 3D tilt so it never reads edge-on */
    const cx = Math.cos(0.5), sx = Math.sin(0.5);
    p = [p[0], p[1] * cx - p[2] * sx, p[1] * sx + p[2] * cx];
    const cy = Math.cos(0.6), sy = Math.sin(0.6);
    p = [p[0] * cy + p[2] * sy, p[1], -p[0] * sy + p[2] * cy];
    const k3 = D3 / (D3 - p[2]);
    return { x: p[0] * k3, y: p[1] * k3, z: p[2] };
  });
  const zs = pts.map((p) => p.z);
  const zMin = Math.min(...zs), zMax = Math.max(...zs);
  return pts.map((p) => ({ x: p.x, y: p.y, depth: zMax === zMin ? 0.5 : (p.z - zMin) / (zMax - zMin) }));
}

const mix = (a: number[], b: number[], t: number) => a.map((c, i) => Math.round(c + (b[i] - c) * t));
const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

/** Draw one frame at time t (seconds) into a context already scaled to CSS pixels. */
export function drawTesseract(ctx: CanvasRenderingContext2D, size: number, t: number) {
  ctx.clearRect(0, 0, size, size);
  const pts = projectAt(t);
  /* Fit: scale so the largest excursion lands at ~44% of the box, smoothed so the size doesn't pump. */
  let r = 0; for (const p of pts) r = Math.max(r, Math.hypot(p.x, p.y));
  const scale = (size * 0.44) / Math.max(r, 1.6);
  const cx = size / 2, cy = size / 2;
  const X = (i: number) => cx + pts[i].x * scale;
  const Y = (i: number) => cy + pts[i].y * scale;
  const lw = Math.min(1.5, Math.max(0.8, size / 110));  /* hairlines at every size */

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  /* Edges: depth sets both colour and opacity, so the far side recedes. */
  for (const [a, b] of E) {
    const d = (pts[a].depth + pts[b].depth) / 2;
    ctx.strokeStyle = rgba(mix(ACCENT, BRIGHT, d * 0.7), 0.24 + 0.5 * d);
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke();
  }

  /* Vertices: tiny dots, nearer ones slightly larger. */
  for (let i = 0; i < 16; i++) {
    const d = pts[i].depth;
    ctx.fillStyle = rgba(mix(ACCENT, BRIGHT, d), 0.35 + 0.55 * d);
    ctx.beginPath(); ctx.arc(X(i), Y(i), lw * (0.8 + 0.5 * d), 0, Math.PI * 2); ctx.fill();
  }

  /* Comet: head runs the Gray-code cycle, tail fades over ~3.5 edges. One lap takes about 7.5 s. */
  const pos = ((t * 2.1) % 16 + 16) % 16;
  const head = Math.floor(pos), f = pos - head;
  const at = (k: number, frac: number) => {
    const a = GRAY_CYCLE[((k % 16) + 16) % 16], b = GRAY_CYCLE[(((k + 1) % 16) + 16) % 16];
    return { x: X(a) + (X(b) - X(a)) * frac, y: Y(a) + (Y(b) - Y(a)) * frac, d: pts[a].depth + (pts[b].depth - pts[a].depth) * frac };
  };
  const STEPS = 48, TAIL = 3.5;
  ctx.lineCap = "butt";  /* round caps would overlap at the joins and bead the tail */
  let prev = at(head, f);
  for (let s = 1; s <= STEPS; s++) {
    const back = (s / STEPS) * TAIL;            /* edges behind the head */
    const q = pos - back;
    const k = Math.floor(q);
    const cur = at(k, q - k);
    const fade = 1 - s / STEPS;
    ctx.strokeStyle = rgba(BRIGHT, 0.95 * fade * fade);
    ctx.lineWidth = lw * (1 + 0.6 * fade);
    ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(cur.x, cur.y); ctx.stroke();
    prev = cur;
  }
  const h = at(head, f);
  ctx.fillStyle = rgba([255, 255, 255], 1);
  ctx.beginPath(); ctx.arc(h.x, h.y, lw * 1.6, 0, Math.PI * 2); ctx.fill();
}

export function TesseractThinking({ stage, size = 44, frozenTime }: {
  stage?: string;
  size?: number;
  /** Draw a single still frame at this time (seconds) instead of animating. Used for tests and reduced motion. */
  frozenTime?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 3);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reduce = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (frozenTime !== undefined || reduce) { drawTesseract(ctx, size, frozenTime ?? 1.2); return; }

    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => { drawTesseract(ctx, size, (now - t0) / 1000 + 1.2); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [size, frozenTime]);

  return (
    <div role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0", minHeight: size }}>
      <canvas ref={ref} aria-hidden style={{ width: size, height: size, flexShrink: 0, display: "block" }} />
      <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.01em", color: "rgba(255,255,255,0.50)", animation: "tt-label 2.4s cubic-bezier(0.4,0,0.2,1) infinite" }}>{stage || "Thinking"}</span>
      <style>{`@keyframes tt-label{0%,100%{opacity:0.55}45%{opacity:1}}@media (prefers-reduced-motion:reduce){[role=status] span{animation:none!important}}`}</style>
    </div>
  );
}
