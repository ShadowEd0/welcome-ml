import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

/**
 * "paper_origami" — three folded-paper sculptures floating in a warm paper
 * room: a paper crane sweeping a wide gliding arc (wings actually folding
 * with each beat), a four-point paper star slowly turning, and a small paper
 * dart skimming low. The light is soft, the facets are a two-tone paper ramp
 * with fine creases, and the pointer is a quiet current of air: the nearest
 * piece drifts away and tilts, then settles back.
 *
 * The background (cream gradient, haze, paper grain) and the soft shadow
 * sprite are pre-rendered once per resize, so the frame loop only plants a
 * few dozen facets. Reduced motion freezes the mobile into a still — but
 * complete — composition.
 */
class PaperOrigamiScene implements VersoScene {
  readonly id = "paper_origami";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private scene: HTMLCanvasElement | null = null; // warm paper background
  private soft: HTMLCanvasElement | null = null; // soft shadow sprite
  private raftId: number | null = null;
  private active = false;
  private reduced = false;
  private t = 8.4;
  private lastTime = 0;
  private pointer = { x: 0.5, y: 0.5 };
  private readonly onPointerMove: (event: PointerEvent) => void;

  private w = 0;
  private h = 0;
  private md = 0;

  // Air-current influences per piece (index 0 crane, 1 star, 2 dart).
  private current = { x: 0, y: 0, yaw: 0 };

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
      this.t = 8.4;
      this.draw(true, false);
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
    this.paintSoft();
    // resize() clears the canvas: repaint the current composition so the
    // reduced-motion still stays correct right after a resize.
    this.draw(false, false);
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
    this.scene = null;
    this.soft = null;
    this.host = null;
  }

  // ---- pre-rendered layers ---------------------------------------------------

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

    const paper = g.createLinearGradient(0, 0, 0, h);
    paper.addColorStop(0, "#efe2c6");
    paper.addColorStop(0.4, "#e3d1ab");
    paper.addColorStop(0.72, "#d6bf8f");
    paper.addColorStop(1, "#c2a477");
    g.fillStyle = paper;
    g.fillRect(0, 0, w, h);

    // warm sun haze, upper-third, giving the paper a soft inner glow
    const haze = g.createRadialGradient(w * 0.5, h * 0.33, 0, w * 0.5, h * 0.33, h * 0.58);
    haze.addColorStop(0, "rgba(255, 228, 172, 0.4)");
    haze.addColorStop(0.5, "rgba(255, 218, 160, 0.14)");
    haze.addColorStop(1, "rgba(255, 208, 150, 0)");
    g.fillStyle = haze;
    g.fillRect(0, 0, w, h);

    // subtle warm vignette to keep the edges quiet
    const vig = g.createRadialGradient(w * 0.5, h * 0.52, 0, w * 0.5, h * 0.52, Math.max(w, h) * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(96, 62, 26, 0.28)");
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);

    // faint paper grain
    for (let i = 0; i < 150; i++) {
      const r1 = Math.sin(i * 127.1 + 1) * 43758.5;
      const r2 = Math.sin(i * 311.7 + 2) * 269.5;
      const r3 = Math.sin(i * 74.2 + 3) * 183.2;
      const px = (Math.abs(r1) % 1) * w;
      const py = (Math.abs(r2) % 1) * h;
      const size = 0.5 + (Math.abs(r3) % 1) * 1.1;
      const down = (Math.abs(r3) % 1) > 0.5;
      g.fillStyle = down
        ? `rgba(150, 112, 62, ${(0.016 + (Math.abs(r2) % 1) * 0.02).toFixed(3)})`
        : `rgba(255, 248, 230, ${(0.04 + (Math.abs(r1) % 1) * 0.05).toFixed(3)})`;
      g.beginPath();
      g.arc(px, py, size, 0, Math.PI * 2);
      g.fill();
    }
    this.scene = off;
  }

  private paintSoft(): void {
    const s = 96;
    const off = document.createElement("canvas");
    off.width = s;
    off.height = s;
    const g = off.getContext("2d");
    if (!g) return;
    const rad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rad.addColorStop(0, "rgba(90, 62, 26, 0.4)");
    rad.addColorStop(0.55, "rgba(100, 70, 32, 0.16)");
    rad.addColorStop(1, "rgba(110, 78, 36, 0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, s, s);
    this.soft = off;
  }

  // ---- frame -------------------------------------------------------------------

  private frame = (now: number): void => {
    if (!this.active || this.reduced) {
      this.raftId = null;
      return;
    }
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.t += dt;
    this.stepCurrent(dt);
    this.draw(false, true);
    this.raftId = requestAnimationFrame(this.frame);
  };

  private stepCurrent(dt: number): void {
    // Pointer = a faint breeze: the piece nearest the pointer is drifted a
    // little and tilted; everything eases back when the hand leaves.
    let target = { x: 0, y: 0, yaw: 0 };
    const cx = this.pointer.x * this.w;
    const cy = this.pointer.y * this.h;
    let best = Infinity;
    const centers = [
      this.craneCenter(),
      this.starCenter(),
      this.dartCenter(),
    ];
    for (let i = 0; i < centers.length; i++) {
      const dx = centers[i].x - cx;
      const dy = centers[i].y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < best) {
        best = d;
        const inRange = d < this.md * 0.62;
        const toward = d > 0.001;
        const g = inRange && toward ? 1 - d / (this.md * 0.62) : 0;
        target = {
          x: toward ? (dx / d) * g * this.md * 0.045 : 0,
          y: toward ? (dy / d) * g * this.md * 0.04 : 0,
          yaw: -g * 0.12,
        };
      }
    }
    const k = Math.min(1, dt * 2.4);
    this.current.x += (target.x - this.current.x) * k;
    this.current.y += (target.y - this.current.y) * k;
    this.current.yaw += (target.yaw - this.current.yaw) * k;
  }

  private craneCenter(): { x: number; y: number } {
    return {
      x: this.w / 2 + Math.cos(this.t * 0.4) * this.w * 0.34,
      y: this.h * 0.44 + Math.sin(this.t * 0.35) * this.h * 0.09,
    };
  }

  private starCenter(): { x: number; y: number } {
    return { x: this.w * 0.32, y: this.h * 0.26 };
  }

  private dartCenter(): { x: number; y: number } {
    return { x: this.w * 0.82, y: this.h * 0.72 };
  }

  private draw(withBreeze: boolean, animated: boolean): void {
    const ctx = this.ctx;
    if (!ctx || this.w === 0 || this.h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (this.scene) ctx.drawImage(this.scene, 0, 0, this.w, this.h);

    const t = this.t;
    const breeze = withBreeze ? this.current : { x: 0, y: 0, yaw: 0 };
    void animated;

    // Contact shadows first (under everything, invisible under the paper at
    // scale, they read as a soft pool of air under each piece).
    if (this.soft) {
      const ss = this.md * 0.2;
      const pieces: { x: number; y: number; alt: number }[] = [
        { ...this.craneCenter(), alt: 0.4 },
        { ...this.starCenter(), alt: 0.55 },
        { ...this.dartCenter(), alt: 0.45 },
      ];
      for (const p of pieces) {
        ctx.globalAlpha = 0.5 + p.alt * 0.3;
        ctx.drawImage(this.soft, p.x - ss * (1 + p.alt), p.y - ss * 0.1, ss * 2 * (1 + p.alt), ss * 1.2);
      }
      ctx.globalAlpha = 1;
    }

    this.drawCrane(ctx, t, breeze);
    this.drawStar(ctx, t, breeze);
    this.drawDart(ctx, t, breeze);
  }

  // -- the crane ---------------------------------------------------------------

  private drawCrane(ctx: CanvasRenderingContext2D, t: number, breezeRead: { x: number; y: number; yaw: number }): void {
    const pos = this.craneCenter();
    const dx = -0.3 * 0.42 * Math.sin(t * 0.42); // d(x)/dt along the arc
    const dy = 0.1 * 0.37 * Math.cos(t * 0.37);
    const yaw = Math.atan2(dy, dx) + breezeRead.yaw;
    const size = this.md * 0.38;
    const cx = pos.x + breezeRead.x;
    const cy = pos.y + breezeRead.y + Math.sin(t * 1.4) * 3;
    const flap = Math.sin(t * 2.1); // wing beats

    const p = (lx: number, ly: number): { x: number; y: number } => {
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      return { x: cx + (lx * c - ly * s) * size, y: cy + (lx * s + ly * c) * size };
    };

    const light = "#fefaf0";
    const shade = "#dcc294";
    const deep = "#c5a276";
    const crease = "rgba(112, 80, 44, 0.42)";
    const edge = "rgba(96, 68, 36, 0.3)";

    const poly = (pts: { x: number; y: number }[], fill: string, stroke?: string): void => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    // Folding wings: the near wing tip lifts with each beat, the far wing
    // dips in counter-phase (a real two-wing beat).
    const wl = -0.06 - flap * 0.2; // far wing settles low
    const wr = 0.12 + flap * 0.3; // near wing lifts

    // far wing (behind the body)
    poly([p(-0.42, -0.06), p(-0.18, -0.5 + wl * 0.8), p(0.1, -0.4 + wl * 1.1), p(0.08, 0.06)], deep);
    poly(
      [p(-0.42, -0.06), p(-0.18, -0.5 + wl * 0.8), p(-0.05, -0.18), p(0.08, 0.06)],
      shade,
      edge
    );

    // folded body (two tones, one crease)
    poly(
      [p(-0.46, 0.1), p(-0.3, -0.12), p(0.02, -0.05), p(0.18, 0.18), p(0.02, 0.32), p(-0.34, 0.28)],
      shade,
      edge
    );
    poly([p(-0.46, 0.1), p(-0.3, -0.12), p(-0.02, 0.06), p(-0.12, 0.34), p(-0.42, 0.3)], light, edge);

    // tail fold
    poly([p(-0.46, 0.1), p(-0.62, -0.06), p(-0.58, 0.18), p(-0.42, 0.3)], light, edge);

    // neck + head
    poly([p(-0.06, -0.08), p(0.16, -0.2), p(0.2, -0.06), p(0.12, 0.04)], shade, edge);
    poly([p(0.19, -0.18), p(0.28, -0.24), p(0.34, -0.12), p(0.24, -0.02)], light, edge);

    // near wing (drawn last, on top) — two triangles joined by a crease
    poly([p(-0.22, 0.02), p(0.06, -0.38 + wr * 0.3), p(0.04, 0.1)], light, edge);
    poly([p(-0.22, 0.02), p(0.06, -0.38 + wr * 0.3), p(-0.3, -0.02)], "#f2e3bf", crease);
  }

  // -- the paper star ------------------------------------------------------------

  private drawStar(ctx: CanvasRenderingContext2D, t: number, breezeRead: { x: number; y: number; yaw: number }): void {
    const pos = this.starCenter();
    const yaw = t * 0.34 + breezeRead.yaw;
    const size = this.md * 0.3;
    const cx = pos.x + breezeRead.x;
    const cy = pos.y + breezeRead.y + Math.sin(t * 0.7) * 3;
    const petals = 4;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const p = (lx: number, ly: number): { x: number; y: number } => ({
      x: cx + (lx * c - ly * s) * size,
      y: cy + (lx * s + ly * c) * size,
    });

    const light = "#fefaf0";
    const shade = "#dcc294";
    const crease = "rgba(112, 80, 44, 0.4)";
    for (let k = 0; k < petals; k++) {
      const a = (k / petals) * Math.PI * 2 + Math.PI / 4;
      const tip = { x: Math.cos(a) * 0.82, y: Math.sin(a) * 0.82 };
      const lift = k % 2 === 0 ? -0.1 : 0.12; // every other petal is lifted a bit
      const led = { x: Math.cos(a - 0.28) * 0.3, y: Math.sin(a - 0.28) * 0.3 + lift };
      const red = { x: Math.cos(a + 0.28) * 0.3, y: Math.sin(a + 0.28) * 0.3 - lift };
      const tip2 = { x: tip.x * 1.06, y: tip.y * 1.06 - 0.05 };
      ctx.beginPath();
      ctx.moveTo(p(0, 0).x, p(0, 0).y);
      ctx.lineTo(p(tip.x, tip.y).x, p(tip.x, tip.y).y);
      ctx.lineTo(p(led.x, led.y).x, p(led.x, led.y).y);
      ctx.closePath();
      ctx.fillStyle = light;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p(0, 0).x, p(0, 0).y);
      ctx.lineTo(p(tip2.x, tip2.y).x, p(tip2.x, tip2.y).y);
      ctx.lineTo(p(red.x, red.y).x, p(red.x, red.y).y);
      ctx.closePath();
      ctx.fillStyle = shade;
      ctx.fill();
      // fold crease (ridge)
      ctx.beginPath();
      ctx.moveTo(p(0, 0).x, p(0, 0).y);
      ctx.lineTo(p(tip.x, tip.y).x, p(tip.x, tip.y).y);
      ctx.strokeStyle = crease;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // center pin
    ctx.beginPath();
    ctx.arc(p(0, 0).x, p(0, 0).y, size * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = "#c9b077";
    ctx.fill();
  }

  // -- the paper dart --------------------------------------------------------------

  private drawDart(ctx: CanvasRenderingContext2D, t: number, breezeRead: { x: number; y: number; yaw: number }): void {
    const pos = this.dartCenter();
    const yaw = -0.35 + Math.sin(t * 0.5) * 0.08 + breezeRead.yaw;
    const size = this.md * 0.24;
    const cx = pos.x + breezeRead.x;
    const cy = pos.y + breezeRead.y + Math.sin(t * 1.1) * 2.4;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const p = (lx: number, ly: number): { x: number; y: number } => ({
      x: cx + (lx * c - ly * s) * size,
      y: cy + (lx * s + ly * c) * size,
    });

    const light = "#fefaf0";
    const shade = "#e0cb97";
    const crease = "rgba(122, 88, 48, 0.4)";
    // right wing
    ctx.beginPath();
    ctx.moveTo(p(0, 0).x, p(0, 0).y);
    ctx.lineTo(p(0.62, 1.0).x, p(0.62, 1.0).y);
    ctx.lineTo(p(0.16, 1.06).x, p(0.16, 1.06).y);
    ctx.closePath();
    ctx.fillStyle = light;
    ctx.fill();
    // left wing
    ctx.beginPath();
    ctx.moveTo(p(0, 0).x, p(0, 0).y);
    ctx.lineTo(p(-0.62, 1.0).x, p(-0.62, 1.0).y);
    ctx.lineTo(p(-0.16, 1.06).x, p(-0.16, 1.06).y);
    ctx.closePath();
    ctx.fillStyle = shade;
    ctx.fill();
    // keel crease
    ctx.beginPath();
    ctx.moveTo(p(0, 0).x, p(0, 0).y);
    ctx.lineTo(p(0, 1.06).x, p(0, 1.06).y);
    ctx.strokeStyle = crease;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export const paperOrigamiAnimation: VersoAnimationDefinition = {
  id: "paper_origami",
  create: () => new PaperOrigamiScene(),
};