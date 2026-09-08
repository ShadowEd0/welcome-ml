// ARCHIVÉ (Mission #18) : prototype retiré du registry actif — conservé ici
// pour référence. Non importé par scenes/index.ts, donc absent du bundle.
import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../../types";

/**
 * "vaporwave_sun" — a retro-synthwave dawn frozen under a sunset gradient:
 * a striped sun with an offset scanline grid sinking slowly behind a
 * perspective grid of pink neon. The sun is a two-tone banded disc with a
 * soft Chromatic edge; the horizon grid rows breathe and slide toward the
 * viewer like light on water; a faint bloom and a few drifting stars
 * complete the 80s dream.
 *
 * The gradient sky, sun bands and the neon bloom are pre-rendered once per
 * resize; the frame loop only redraws the perspective grid (a dozen rows)
 * and the drifting stars, so the scene stays light. Reduced motion freezes
 * the grid to a crisp still.
 */
class VaporwaveSunScene implements VersoScene {
  readonly id = "vaporwave_sun";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private sky: HTMLCanvasElement | null = null; // gradient + nebula
  private sun: HTMLCanvasElement | null = null; // banded sun sprite
  private bloom: HTMLCanvasElement | null = null; // neon glow sprite
  private streak: HTMLCanvasElement | null = null; // thin scanline sprite
  private raftId: number | null = null;
  private active = false;
  private reduced = false;
  private t = 3.2;
  private lastTime = 0;

  private w = 0;
  private h = 0;
  private md = 0;
  private horizon = 0.62; // grid / sky boundary (fraction of height)

  // drifting star field (deterministic)
  private readonly starR = Array.from({ length: 26 }, (_, i) => Math.abs(Math.sin(i * 12.9 + 1) * 43758) % 1);

  constructor() {}

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
    this.resize();
  }

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
      this.drawGrid(true);
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
    this.md = Math.min(rectW, rectH);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.paintSky();
    this.paintSun();
    this.paintBloom();
    this.paintStreak();
    // resize() clears the canvas; repaint the current state so the grid is
    // present right after a resize (and stays correct in reduced motion).
    this.drawGrid(true);
  }

  destroy(): void {
    if (this.raftId !== null) {
      cancelAnimationFrame(this.raftId);
      this.raftId = null;
    }
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.sky = null;
    this.sun = null;
    this.bloom = null;
    this.streak = null;
    this.host = null;
  }

  // ---- pre-rendered ---------------------------------------------------------

  private paintSky(): void {
    const w = this.w;
    const h = this.h;
    const off = document.createElement("canvas");
    off.width = this.canvas?.width ?? w;
    off.height = this.canvas?.height ?? h;
    const g = off.getContext("2d");
    if (!g) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // synthwave sunset: deep purple → pink → hot orange near the horizon
    const sky = g.createLinearGradient(0, 0, 0, h * this.horizon);
    sky.addColorStop(0, "#1a0b2e");
    sky.addColorStop(0.34, "#36124e");
    sky.addColorStop(0.62, "#6d1f6e");
    sky.addColorStop(0.84, "#c2287c");
    sky.addColorStop(1, "#ff5f3c");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h * this.horizon);

    // horizontal banding typical of the genre (very subtle)
    for (let i = 0; i < 6; i++) {
      const y = (i / 6) * h * this.horizon;
      g.fillStyle = `rgba(255, 255, 255, ${(0.015 + (i % 2) * 0.02).toFixed(3)})`;
      g.fillRect(0, y, w, 1);
    }

    // nebula wash
    const neb1 = g.createRadialGradient(w * 0.5, h * 0.24, 0, w * 0.5, h * 0.24, h * 0.4);
    neb1.addColorStop(0, "rgba(150, 90, 220, 0.18)");
    neb1.addColorStop(1, "rgba(150, 90, 220, 0)");
    g.fillStyle = neb1;
    g.fillRect(0, 0, w, h * this.horizon);

    // dark ground below horizon (pre-baked)
    const ground = g.createLinearGradient(0, h * this.horizon, 0, h);
    ground.addColorStop(0, "#2b1040");
    ground.addColorStop(1, "#16081f");
    g.fillStyle = ground;
    g.fillRect(0, h * this.horizon, w, h - h * this.horizon);
    this.sky = off;
  }

  private paintSun(): void {
    // a disc built from horizontal rounded bands, in a loop for "scanlines"
    const s = 160;
    const off = document.createElement("canvas");
    off.width = s;
    off.height = s;
    const g = off.getContext("2d");
    if (!g) return;
    const cx = s / 2;
    const cy = s / 2;
    const r = s * 0.42;
    const bands = 14;
    const warm = ["rgba(255, 96, 60, 1)", "rgba(255, 120, 70, 1)"];
    for (let i = 0; i < bands; i++) {
      const y0 = cy - r + (r * 2 / bands) * i;
      const y1 = cy - r + (r * 2 / bands) * (i + 1);
      const xAt = (y: number) =>
        Math.sqrt(Math.max(0, 1 - ((y - cy) / r) * ((y - cy) / r))) * r;
      const edge0 = xAt(y0);
      const edge1 = xAt(y1);
      const xL = cx - Math.max(edge0, edge1) - 1;
      const xR = cx + Math.max(edge0, edge1) + 1;
      // clip to the disc with a rounded band
      g.beginPath();
      g.moveTo(xL, y0);
      g.lineTo(xR, y0);
      g.lineTo(xR, y1);
      g.lineTo(xL, y1);
      g.closePath();
      g.save();
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = warm[i % 2];
      g.fillRect(0, y0, s, y1 - y0);
      g.restore();

      // dark scanline between bands
      if (i < bands - 1) {
        g.fillStyle = "rgba(60, 12, 40, 0.5)";
        g.fillRect(0, y1 - 0.5, s, 1);
      }
    }
    // rim glow
    const rim = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.18);
    rim.addColorStop(0, "rgba(255, 120, 70, 0)");
    rim.addColorStop(1, "rgba(255, 100, 70, 0.35)");
    g.fillStyle = rim;
    g.fillRect(0, 0, s, s);
    this.sun = off;
  }

  private paintBloom(): void {
    const s = 128;
    const off = document.createElement("canvas");
    off.width = s;
    off.height = s;
    const g = off.getContext("2d");
    if (!g) return;
    const rad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rad.addColorStop(0, "rgba(255, 232, 200, 0.9)");
    rad.addColorStop(0.3, "rgba(255, 150, 110, 0.38)");
    rad.addColorStop(0.65, "rgba(214, 70, 150, 0.14)");
    rad.addColorStop(1, "rgba(190, 60, 160, 0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, s, s);
    this.bloom = off;
  }

  private paintStreak(): void {
    const w = 12;
    const s = 96;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = s;
    const g = off.getContext("2d");
    if (!g) return;
    const grad = g.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, "rgba(255, 120, 170, 0.35)");
    grad.addColorStop(0.5, "rgba(255, 140, 190, 0.8)");
    grad.addColorStop(1, "rgba(255, 120, 170, 0.35)");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, s);
    this.streak = off;
  }

  // ---- grid -------------------------------------------------------------------

  private drawGrid(noAdvance: boolean): void {
    const ctx = this.ctx;
    if (!ctx || this.w === 0 || this.h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (this.sky) ctx.drawImage(this.sky, 0, 0, this.w, this.h);

    const horizonY = this.h * this.horizon;
    const t = this.t;

    // sun + bloom (partially below horizon)
    const sunSize = this.md * 0.6;
    const sunCx = this.w / 2;
    const sunCy = horizonY - this.md * 0.05 + Math.sin(t * 0.4) * 3;
    if (this.bloom) {
      const bs = sunSize * 2.2;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(this.bloom, sunCx - bs / 2, sunCy - bs / 2, bs, bs);
      ctx.globalAlpha = 1;
    }
    if (this.sun) ctx.drawImage(this.sun, sunCx - sunSize / 2, sunCy - sunSize / 2, sunSize, sunSize);

    // retro scanline streaks sliding up (a few, faint)
    if (this.streak) {
      for (let i = 0; i < 3; i++) {
        const ph = ((t * 0.14 + i * 0.33) % 1);
        const sx = this.w * (0.18 + 0.28 * i + Math.sin(t * 0.2 + i) * 0.06);
        const sy = horizonY - ph * horizonY;
        const sh = this.md * 0.3;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(this.streak, sx, sy - sh, this.md * 0.012, sh * 2);
      }
      ctx.globalAlpha = 1;
    }

    // perspective grid (a few rows with sliding offsets)
    const rows = 9;
    const step = (this.h - horizonY) / rows;
    const peak = this.md * 0.03;
    for (let r = 1; r <= rows; r++) {
      const y = horizonY + step * r;
      const width = r / rows;
      const wob = noAdvance ? 0 : Math.sin(t * 0.9 + r) * peak;
      const left = this.w / 2 - width * (this.w / 2 + this.md * 0.1);
      const right = this.w / 2 + width * (this.w / 2 + this.md * 0.1);
      ctx.strokeStyle = `rgba(255, 90, 170, ${(0.24 + 0.5 * (1 - r / rows)).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(left, y + wob);
      ctx.lineTo(right, y + wob);
      ctx.stroke();
    }

    // vanishing lines converging at the vanishing point under the sun
    const vanishX = this.w / 2 + Math.sin(t * 0.2) * 4;
    const vanishY = horizonY;
    const spokes = 7;
    for (let k = 0; k < spokes; k++) {
      const f = (k / (spokes - 1)) - 0.5;
      const baseX = this.w / 2 + f * this.w * 1.2;
      ctx.strokeStyle = `rgba(255, 90, 170, ${(0.16 + 0.34 * (1 - Math.abs(f))).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(vanishX, vanishY + (noAdvance ? 0.5 : 0));
      ctx.lineTo(baseX, this.h);
      ctx.stroke();
    }

    // drifting stars (upper sky)
    for (let i = 0; i < this.starR.length; i++) {
      const sx = ((this.starR[i] * 7.3 + t * 0.011 * (i % 5 + 1)) % 1) * this.w;
      const sy = (this.starR[i] * 3.1) % 1 * horizonY * 0.85;
      const twinkle = noAdvance ? 0.6 : 0.4 + 0.25 * Math.sin(t * 1.6 + i * 2.2);
      ctx.fillStyle = `rgba(255, 232, 226, ${(twinkle * 0.5).toFixed(3)})`;
      ctx.fillRect(sx, sy, 1.4, 1.4);
    }
  }

  private frame = (now: number): void => {
    if (!this.active || this.reduced) {
      this.raftId = null;
      return;
    }
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.t += dt;
    this.drawGrid(false);
    this.raftId = requestAnimationFrame(this.frame);
  };
}

export const vaporwaveSunAnimation: VersoAnimationDefinition = {
  id: "vaporwave_sun",
  create: () => new VaporwaveSunScene(),
};