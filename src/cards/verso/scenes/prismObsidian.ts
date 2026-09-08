import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

/**
 * "prism_obsidian" — a faceted obsidian monolith slowly rotating in a deep
 * night-blue studio. The body is a low-poly column built from stacked
 * cross-section rings (slightly asymmetric, with a delicate belly), revealed
 * almost entirely by light: faces brighten as their normal sweeps toward the
 * studio azimuth, edges stay crisp, brightest faces carry a faint chromatic
 * fringe, and a few procedural caustics drift on the background.
 *
 * Light follows the pointer gently (a tasteful consequence of the concept),
 * reduced motion keeps a full static composition, and everything visible on
 * screen restarts from pre-rendered offscreen layers so the frame loop never
 * allocates gradients.
 */
class PrismObsidianScene implements VersoScene {
  readonly id = "prism_obsidian";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private after: HTMLCanvasElement | null = null; // background ("stage")
  private glint: HTMLCanvasElement | null = null; // soft radial sprite
  private shadow: HTMLCanvasElement | null = null; // contact shadow sprite
  private raftId: number | null = null;
  private active = false;
  private reduced = false;
  private t = 0;
  private lastTime = 0;
  private pointer = { x: 0.32, y: 0.5 }; // light azimuth follows host x
  private readonly onPointerMove: (event: PointerEvent) => void;

  private w = 0;
  private h = 0;
  private monoScale = 1;
  private monoH = 1;
  private tilt = 0.11;
  private rings: { readonly u: number; readonly r: readonly number[] }[] = [];

  constructor() {
    this.onPointerMove = (event: PointerEvent) => {
      const host = this.host;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      this.pointer = {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      };
    };
  }

  // ---- geometry (static: radii per vertex, tilt, layout) --------------------

  private buildGeometry(): void {
    const md = Math.min(this.w, this.h);
    this.monoScale = md * 0.3;
    this.monoH = md * 1.02;
    this.tilt = 0.11;

    const rises = [1.0, 1.035, 0.985, 0.87, 0.66, 0.18]; // belly then taper
    const risesU = [0, 0.22, 0.46, 0.68, 0.87, 1];
    const asym = [1.0, 0.93, 1.06, 0.9, 1.01, 0.955, 1.05];
    this.rings = risesU.map((u, i) => ({
      u,
      r: asym.map((a) => a * rises[i]),
    }));
  }

  mount({ host }: VersoSceneContext): void {
    this.host = host;
    const canvas = document.createElement("canvas");
    canvas.className = "verso-canvas";
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }
    host.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = ctx;
    host.addEventListener("pointermove", this.onPointerMove);

    this.resize();
    this.drawStatic(9.2);
  }

  // ---- lifecycle ------------------------------------------------------------

  setActive(active: boolean): void {
    this.active = active;
    if (active && this.raftId === null && !this.reduced) {
      this.lastTime = performance.now();
      this.raftId = requestAnimationFrame(this.frame);
    } else if (!active && this.raftId !== null) {
      cancelAnimationFrame(this.raftId);
      this.raftId = null;
    }
  }

  setReducedMotion(reduced: boolean): void {
    if (this.reduced === reduced) return;
    this.reduced = reduced;
    if (reduced) {
      if (this.raftId !== null) {
        cancelAnimationFrame(this.raftId);
        this.raftId = null;
      }
      this.drawStatic(9.2);
    } else if (this.active && this.raftId === null) {
      this.lastTime = performance.now();
      this.raftId = requestAnimationFrame(this.frame);
    }
  }

  reshape(): void {
    if (!this.ctx || this.w === 0) return;
    this.resize();
  }

  resize(): void {
    const host = this.host;
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!host || !canvas || !ctx) return;
    const rectW = host.clientWidth;
    const rectH = host.clientHeight;
    if (rectW === 0 || rectH === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rectW * dpr);
    const h = Math.round(rectH * dpr);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${rectW}px`;
    canvas.style.height = `${rectH}px`;
    this.w = rectW;
    this.h = rectH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.buildGeometry();
    this.paintStage();
    this.paintGlint();
    this.paintShadow();
    // Repaint immediately: `resize()` clears the canvas (setting canvas.width),
    // so the current state must be redrawn here — not left to the next RAF
    // tick. This also keeps the composition correct in reduced-motion mode,
    // where no loop runs after a resize.
    this.drawStatic(this.t);
  }

  destroy(): void {
    if (this.raftId !== null) {
      cancelAnimationFrame(this.raftId);
      this.raftId = null;
    }
    if (this.host) {
      this.host.removeEventListener("pointermove", this.onPointerMove);
    }
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.after = null;
    this.glint = null;
    this.shadow = null;
    this.rings = [];
    this.host = null;
  }

  // ---- pre-rendered layers (painted once per resize) --------------------------

  private paintStage(): void {
    const w = this.w;
    const h = this.h;
    const off = document.createElement("canvas");
    off.width = this.canvas?.width ?? w;
    off.height = this.canvas?.height ?? h;
    const g = off.getContext("2d");
    if (!g) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#03040a");
    bg.addColorStop(0.46, "#070b16");
    bg.addColorStop(1, "#0a0d1c");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    const glow = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, h * 0.62);
    glow.addColorStop(0, "rgba(58, 84, 140, 0.22)");
    glow.addColorStop(0.55, "rgba(34, 52, 96, 0.08)");
    glow.addColorStop(1, "rgba(20, 28, 52, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);

    const vig = g.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,4,0.55)");
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);

    this.after = off;
  }

  private paintGlint(): void {
    const s = 128;
    const off = document.createElement("canvas");
    off.width = s;
    off.height = s;
    const g = off.getContext("2d");
    if (!g) return;
    const rad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rad.addColorStop(0, "rgba(240, 246, 255, 0.95)");
    rad.addColorStop(0.25, "rgba(205, 224, 255, 0.55)");
    rad.addColorStop(1, "rgba(180, 210, 255, 0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, s, s);
    this.glint = off;
  }

  private paintShadow(): void {
    const off = document.createElement("canvas");
    off.width = this.canvas?.width ?? 1;
    off.height = this.canvas?.height ?? 1;
    const g = off.getContext("2d");
    if (!g || this.w === 0 || this.h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = this.w / 2;
    const cy = this.h * 0.5 + this.monoH * 0.5;
    const rx = this.monoScale * 1.12;
    const ry = this.monoScale * 0.42;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rx);
    grad.addColorStop(0, "rgba(0,0,2,0.42)");
    grad.addColorStop(0.55, "rgba(0,0,2,0.2)");
    grad.addColorStop(1, "rgba(0,0,2,0)");
    g.save();
    g.translate(cx, cy);
    g.scale(1, ry / rx);
    g.translate(-cx, -cy);
    g.beginPath();
    g.arc(cx, cy, rx, 0, Math.PI * 2);
    g.fillStyle = grad;
    g.fill();
    g.restore();
    this.shadow = off;
  }

  // ---- per-frame projection ----------------------------------------------------

  private frame = (now: number): void => {
    if (!this.active || this.reduced) {
      this.raftId = null;
      return;
    }
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.t += dt;
    this.render();
    this.raftId = requestAnimationFrame(this.frame);
  };

  private render(): void {
    const ctx = this.ctx;
    if (!ctx || this.w === 0 || this.h === 0 || this.rings.length === 0) return;
    const w = this.w;
    const h = this.h;
    const cx = w / 2;
    const cy = h / 2;
    const theta = this.t * 0.13 + Math.sin(this.t * 0.07) * 0.02;
    const lambda = 1.05 + (this.pointer.x - 0.5) * 0.42;
    const breathe = 1 + Math.sin(this.t * 0.55) * 0.004;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    if (this.after) ctx.drawImage(this.after, 0, 0, w, h);

    // procedural caustics drifting with the rotation (screen blend, low alpha)
    this.paintCaustics(ctx, w, h, theta);

    // soft contact shadow under the monolith
    if (this.shadow) {
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = 0.95;
      ctx.drawImage(this.shadow, 0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    // subtle breathing of the whole body
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(breathe, breathe);
    ctx.translate(-cx, -cy);

    this.drawBody(ctx, theta, lambda);

    // specular glints on the bright frontier vertices
    this.paintGlints(ctx, theta, lambda);

    ctx.restore();
  }

  private paintCaustics(ctx: CanvasRenderingContext2D, w: number, h: number, theta: number): void {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const baseY = h * 0.5 + this.monoH * 0.42;
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    for (let i = 0; i < 4; i++) {
      const phase = theta * 1.7 + i * 2.1;
      const col = (i % 3) === 0 ? "120,205,255" : i === 1 ? "150,125,255" : "255,202,150";
      const a = 0.045 + 0.02 * Math.sin(phase);
      ctx.strokeStyle = `rgba(${col},${a.toFixed(3)})`;
      const x = cxPoint(w, phase);
      const dx = (Math.sin(phase * 1.3) + 1.2) * w * 0.06;
      const lift = (Math.cos(phase * 0.9) + 1) * h * 0.04;
      ctx.beginPath();
      ctx.moveTo(x, baseY - lift * 0.4);
      ctx.bezierCurveTo(
        x - dx * 0.5, baseY - lift * 0.7,
        x + dx * 0.6, baseY - lift * 0.15,
        x, baseY + this.monoScale * 0.5
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBody(
    ctx: CanvasRenderingContext2D,
    theta: number,
    lambda: number
  ): void {
    const cx = this.w / 2;
    const cy = this.h / 2;
    const R = this.rings.length;
    const M = this.rings[0].r.length;

    // compute all projected vertices once
    const vx: number[] = [];
    const vy: number[] = [];
    const vz: number[] = [];
    for (let i = 0; i < R; i++) {
      for (let k = 0; k < M; k++) {
        const ang = (k / M) * Math.PI * 2 + 0.21;
        const r = this.rings[i].r[k] * this.monoScale;
        const xw = Math.cos(ang) * r;
        const zw = Math.sin(ang) * r;
        const xr = xw * Math.cos(theta) + zw * Math.sin(theta);
        const zr = -xw * Math.sin(theta) + zw * Math.cos(theta);
        vx.push(cx + xr);
        vy.push(cy + (0.5 - this.rings[i].u) * this.monoH + zr * this.tilt);
        vz.push(zr);
      }
    }
    const vid = (i: number, k: number) => i * M + k;

    const drawQuad = (
      i0: number, k0: number,
      i1: number, k1: number,
      i2: number, k2: number,
      i3: number, k3: number,
      fill: string, stroke: string | null
    ) => {
      ctx.beginPath();
      ctx.moveTo(vx[vid(i0, k0)], vy[vid(i0, k0)]);
      ctx.lineTo(vx[vid(i1, k1)], vy[vid(i1, k1)]);
      ctx.lineTo(vx[vid(i2, k2)], vy[vid(i2, k2)]);
      ctx.lineTo(vx[vid(i3, k3)], vy[vid(i3, k3)]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    // side faces, band by band, painter-sorted (far first)
    for (let i = 0; i < R - 1; i++) {
      const uMid = (this.rings[i].u + this.rings[i + 1].u) / 2;
      const order = Array.from({ length: M }, (_, k) => k);
      order.sort((a, b) => {
        const za = (vz[vid(i, a)] + vz[vid(i + 1, a)]) / 2;
        const zb = (vz[vid(i, b)] + vz[vid(i + 1, b)]) / 2;
        return za - zb;
      });
      for (const k of order) {
        const angMid = ((k + 0.5) / M) * Math.PI * 2 + 0.21 + theta;
        const s = clamp01(Math.cos(angMid - lambda));
        const { fill, stroke, hot } = this.faceStyle(s, uMid, i === 0);
        drawQuad(i, k, i + 1, k, i + 1, (k + 1) % M, i, (k + 1) % M, fill, stroke);
        if (hot) {
          // faint chromatic fringe on the brightest faces
          ctx.save();
          ctx.strokeStyle = "rgba(172,232,255,0.22)";
          ctx.lineWidth = 2.2;
          ctx.translate(1.1, 0);
          ctx.stroke();
          ctx.strokeStyle = "rgba(168,128,255,0.20)";
          ctx.translate(-2.2, 0);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // pyramidal cap: top ring → apex
    const apexY = cy + (0.5 - 1.045) * this.monoH;
    const apexX = cx;
    for (let k = 0; k < M; k++) {
      const angMid = ((k + 0.5) / M) * Math.PI * 2 + 0.21 + theta;
      const s = clamp01(Math.cos(angMid - lambda));
      const { fill, stroke } = this.faceStyle(s * 0.9, 0.96, false);
      ctx.beginPath();
      ctx.moveTo(vx[vid(R - 1, k)], vy[vid(R - 1, k)]);
      ctx.lineTo(vx[vid(R - 1, (k + 1) % M)], vy[vid(R - 1, (k + 1) % M)]);
      ctx.lineTo(apexX, apexY);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // soft apex halo: the obelisk tip gathers the passing light
    const halo = this.glint;
    if (halo) {
      const pulse = 0.34 + Math.sin(this.t * 1.7) * 0.12;
      const hs = this.monoScale * 0.42;
      ctx.globalAlpha = pulse;
      ctx.drawImage(halo, apexX - hs, apexY - hs, hs * 2, hs * 2);
      ctx.globalAlpha = 1;
    }
  }

  private faceStyle(
    s: number,
    uMid: number,
    bottomTint: boolean
  ): { fill: string; stroke: string; hot: boolean } {
    const lit = Math.pow(s, 1.35);
    const sheen = s > 0.62 ? (s - 0.62) * 0.5 : 0;
    // dark violet-black body → cool glass blue when lit, then a touch warmer
    const r = 9 + lit * 120 + sheen * 60;
    const g = 11 + lit * 160 + sheen * 80;
    const b = 22 + lit * 234 + sheen * 110;
    // warm studio bounce near the base
    const warm = bottomTint && uMid < 0.3 ? (0.3 - uMid) * 2.4 : 0;
    const wr = Math.min(255, r + warm * 150);
    const wg = Math.min(255, g + warm * 114);
    const wbb = Math.min(255, b + warm * 74);
    // apical occlusion
    const ao = uMid > 0.86 ? 1 - (1 - uMid) * 7 : 0;
    const ar = wr * (1 - ao * 0.6);
    const ag = wg * (1 - ao * 0.6);
    const ab = wbb * (1 - ao * 0.66);
    const fill = `rgb(${Math.round(ar | 0)},${Math.round(ag | 0)},${Math.round(ab | 0)})`;
    const edgeA = 0.09 + s * 0.34;
    const stroke = s > 0.86 ? "rgba(240,248,255,0.95)" : `rgba(152,190,230,${edgeA.toFixed(3)})`;
    const hot = s > 0.82;
    return { fill, stroke, hot };
  }

  private paintGlints(ctx: CanvasRenderingContext2D, theta: number, lambda: number): void {
    const sprite = this.glint;
    if (!sprite) return;
    const M = this.rings[0].r.length;
    let bestK = 0;
    let bestDot = -2;
    for (let k = 0; k < M; k++) {
      const ang = (k / M) * Math.PI * 2 + 0.21 + theta;
      const dot = Math.cos(ang - lambda);
      if (dot > bestDot) {
        bestDot = dot;
        bestK = k;
      }
    }
    // brightest vertex against the sky near the front-most band
    const iProbe = Math.min(2, this.rings.length - 1);
    const r = this.rings[iProbe].r[bestK] * this.monoScale;
    const ang = (bestK / M) * Math.PI * 2 + 0.21;
    const xw = Math.cos(ang) * r;
    const zw = Math.sin(ang) * r;
    const xr = xw * Math.cos(theta) + zw * Math.sin(theta);
    const zr = -xw * Math.sin(theta) + zw * Math.cos(theta);
    const cx = this.w / 2;
    const cy = this.h / 2;
    const sx = cx + xr;
    const sy = cy + (0.5 - this.rings[iProbe].u) * this.monoH + zr * this.tilt;
    const pulse = 0.6 + Math.sin(this.t * 2.6) * 0.18;
    const sz = this.monoScale * 0.5;
    ctx.drawImage(sprite, sx - sz, sy - sz, sz * 2, sz * 2);
    const sz2 = this.monoScale * 0.2;
    ctx.globalAlpha = 0.85 * pulse;
    ctx.drawImage(sprite, sx - sz2, sy - sz2, sz2 * 2, sz2 * 2);
    ctx.globalAlpha = 1;
  }

  private drawStatic(t: number): void {
    this.t = t;
    this.render();
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function cxPoint(w: number, v: number): number {
  return w * 0.5 + (Math.sin(v) + 0.7) * w * 0.2;
}

export const prismObsidianAnimation: VersoAnimationDefinition = {
  id: "prism_obsidian",
  create: () => new PrismObsidianScene(),
};