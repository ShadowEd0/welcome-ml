import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

/**
 * "liquid_gold" — a slow, luxurious pool of liquid gold. A dark, warm-gold
 * field with a molten core; concentric ripples spread from a centre that
 * itself drifts gently, the crests catching light and breaking into soft
 * highlights and a faint iridescent sheen. A few slow metallic streaks drift
 * on the surface. The pointer draws the ripples toward it (a drop falling in
 * that spot), easing back when the hand leaves.
 *
 * The background, the retina-shimmer sprite and the streak preroll are all
 * pre-rendered once per resize; the frame loop only draws ring crests and a
 * handful of streaks, so the scene stays smooth. Reduced motion freezes the
 * pool into a calm, fully-lit still.
 */
class LiquidGoldScene implements VersoScene {
  readonly id = "liquid_gold";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private bg: HTMLCanvasElement | null = null; // warm-gold field
  private shine: HTMLCanvasElement | null = null; // soft highlight sprite
  private raftId: number | null = null;
  private active = false;
  private reduced = false;
  private t = 5.6;
  private lastTime = 0;
  private pointer = { x: 0.5, y: 0.5 };
  private readonly onPointerMove: (event: PointerEvent) => void;

  private w = 0;
  private h = 0;
  private md = 0;

  // Ripple wave sources; rings fade via a simple deterministic generator.
  private waves: { cx: number; cy: number; born: number }[] = [];

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
    this.waves = [{ cx: 0.5, cy: 0.5, born: 0 }];
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
      this.drawPool(true);
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
    this.paintBackground();
    this.paintShine();
    // resize() clears the canvas; repaint the current state so reduced-motion
    // keeps a full still right after a resize.
    this.drawPoolNoAdvance();
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
    this.bg = null;
    this.shine = null;
    this.waves = [];
    this.host = null;
  }

  // ---- pre-rendered ------------------------------------------------------------

  private paintBackground(): void {
    const w = this.w;
    const h = this.h;
    const off = document.createElement("canvas");
    off.width = this.canvas?.width ?? w;
    off.height = this.canvas?.height ?? h;
    const g = off.getContext("2d");
    if (!g) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const m = g.createLinearGradient(0, 0, 0, h);
    m.addColorStop(0, "#1a0900");
    m.addColorStop(0.3, "#241000");
    m.addColorStop(0.55, "#120800");
    m.addColorStop(1, "#0e0600");
    g.fillStyle = m;
    g.fillRect(0, 0, w, h);

    // molten core glow
    const core = g.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, this.md * 0.9);
    core.addColorStop(0, "rgba(255, 172, 64, 0.5)");
    core.addColorStop(0.3, "rgba(236, 138, 44, 0.26)");
    core.addColorStop(0.62, "rgba(180, 96, 30, 0.1)");
    core.addColorStop(1, "rgba(120, 60, 20, 0)");
    g.fillStyle = core;
    g.fillRect(0, 0, w, h);

    // golden sheen sweeping from upper-left
    const sheen = g.createRadialGradient(w * 0.3, h * 0.3, 0, w * 0.3, h * 0.3, this.md * 0.75);
    sheen.addColorStop(0, "rgba(255, 214, 128, 0.16)");
    sheen.addColorStop(1, "rgba(255, 190, 90, 0)");
    g.fillStyle = sheen;
    g.fillRect(0, 0, w, h);

    // dark vignette keeps the pool deep
    const vig = g.createRadialGradient(w * 0.5, h * 0.5, this.md * 0.35, w * 0.5, h * 0.5, Math.max(w, h) * 0.74);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);

    // fine grain to give the liquid body
    for (let i = 0; i < 220; i++) {
      const r1 = Math.sin(i * 127.1) * 43758.5;
      const r2 = Math.sin(i * 311.7) * 269.5;
      const r3 = Math.sin(i * 74.2) * 183.2;
      const px = (Math.abs(r1) % 1) * w;
      const py = (Math.abs(r2) % 1) * h;
      const sz = 0.4 + (Math.abs(r3) % 1) * 0.9;
      const lite = (Math.abs(r3) % 1) > 0.5;
      g.fillStyle = lite
        ? `rgba(255, 190, 96, ${(0.03 + (Math.abs(r1) % 1) * 0.05).toFixed(3)})`
        : `rgba(60, 28, 8, ${(0.03 + (Math.abs(r2) % 1) * 0.05).toFixed(3)})`;
      g.beginPath();
      g.arc(px, py, sz, 0, Math.PI * 2);
      g.fill();
    }
    this.bg = off;
  }

  private paintShine(): void {
    const s = 96;
    const off = document.createElement("canvas");
    off.width = s;
    off.height = s;
    const g = off.getContext("2d");
    if (!g) return;
    const rad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rad.addColorStop(0, "rgba(255, 250, 220, 0.9)");
    rad.addColorStop(0.18, "rgba(255, 236, 170, 0.42)");
    rad.addColorStop(0.45, "rgba(255, 210, 120, 0.12)");
    rad.addColorStop(1, "rgba(255, 200, 110, 0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, s, s);
    this.shine = off;
  }

  // ---- waves -------------------------------------------------------------------

  private spawnWave(): void {
    // a slow, breathing point also circulates its own rings
    const cx = 0.5 + Math.sin(this.t * 0.21) * 0.16;
    const cy = 0.5 + Math.cos(this.t * 0.17) * 0.12;
    this.waves.push({ cx, cy, born: this.t });
  }

  private drawPool(noAdvance: boolean): void {
    const ctx = this.ctx;
    if (!ctx || this.w === 0 || this.h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (this.bg) ctx.drawImage(this.bg, 0, 0, this.w, this.h);

    const t = this.t;

    // Pointer drop: the moving rings nearest the pointer pull toward it.
    let px = 0.5;
    let py = 0.5;
    if (!noAdvance) {
      px = this.pointer.x;
      py = this.pointer.y;
    }
    const sources = [...this.waves, { cx: px, cy: py, born: t >= 60 ? t - 60 : t - 80 }];

    // crest rings (under the glow)
    for (const src of sources) {
      const age = t - src.born;
      const maxAge = 120;
      if (age < 0 || age >= maxAge) continue;
      const cx = src.cx * this.w;
      const cy = src.cy * this.h;
      const maxR = Math.max(this.w, this.h) * (0.42 + ((src.born * 7) % 1) * 0.1);
      const ringCount = 3;
      for (let k = 0; k < ringCount; k++) {
        const offset = (age + k * 26) % 120;
        const r = (offset / 120) * maxR;
        if (r <= 2) continue;
        const fade = Math.max(0, 1 - offset / 120);
        const width = 1.6 + (1 - offset / 120) * 2.4;
        ctx.strokeStyle = `rgba(255, 206, 120, ${(fade * 0.6).toFixed(3)})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // inner molten glow at the active centre
    if (this.shine) {
      const gc = this.md * 0.42;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(this.shine, px * this.w - gc, py * this.h - gc, gc * 2, gc * 2);
      ctx.globalAlpha = 1;
    }

    // drifting metallic streaks (few, slow)
    for (let i = 0; i < 4; i++) {
      const phase = t * (0.25 + i * 0.03) + i * 2.4;
      const sx = ((phase * 0.045 + 0.15) % 1.3) - 0.15;
      const sy = 0.3 + 0.28 * Math.sin(phase * 0.9 + i * 1.7);
      const len = this.md * (0.1 + 0.05 * ((i % 3) + 1) * 0.5);
      const a = 0.05 + ((i % 2) * 0.04);
      const yaw = -0.06;
      const x0 = sx * this.w;
      const y0 = sy * this.h;
      const x1 = x0 + Math.cos(yaw) * len;
      const y1 = y0 + Math.sin(yaw) * len;
      const g2 = ctx.createLinearGradient(x0, y0, x1, y1);
      g2.addColorStop(0, "rgba(255, 222, 150, 0)");
      g2.addColorStop(0.5, `rgba(255, 226, 150, ${a.toFixed(3)})`);
      g2.addColorStop(1, "rgba(255, 222, 150, 0)");
      ctx.strokeStyle = g2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // re-tint the very edge (keeps the pool from touching the viewer frame)
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(120, 70, 24, 0.16)";
    ctx.fillRect(0, 0, this.w, 6);
    ctx.fillRect(0, this.h - 6, this.w, 6);
    ctx.fillRect(0, 0, 6, this.h);
    ctx.fillRect(this.w - 6, 0, 6, this.h);
    ctx.globalCompositeOperation = "source-over";
  }

  private drawPoolNoAdvance(): void {
    this.drawPool(true);
  }

  private frame = (now: number): void => {
    if (!this.active || this.reduced) {
      this.raftId = null;
      return;
    }
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.t += dt;
    if (this.t > 2000000000) this.t = 0;
    if ((this.t % 12) < 0.04) this.spawnWave();
    this.drawPool(false);
    this.raftId = requestAnimationFrame(this.frame);
  };
}

export const liquidGoldAnimation: VersoAnimationDefinition = {
  id: "liquid_gold",
  create: () => new LiquidGoldScene(),
};