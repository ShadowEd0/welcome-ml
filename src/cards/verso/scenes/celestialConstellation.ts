import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

/**
 * "celestial_constellation" — a slowly weaving constellation over an indigo
 * night field. Two asterisms ("Petit Oiseau" and the "Berceau") are drawn as
 * soft lines between twinkling stars; the whole figure breathes, rotates by
 * a hair, drops an occasional shooting star, and answers softly to the
 * pointer: the nearest stars catch fire and their filaments brighten.
 *
 * The background and the three star tints are pre-rendered once per resize;
 * the frame loop only projects 26 nodes and strokes ~30 filaments, so the
 * scene stays light. Reduced motion keeps the full constellation still.
 */
class CelestialConstellationScene implements VersoScene {
  readonly id = "celestial_constellation";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private sky: HTMLCanvasElement | null = null; // gradient + faint dust
  private tints: (HTMLCanvasElement | null)[] = []; // violet, cyan, amber sprites
  private raftId: number | null = null;
  private active = false;
  private reduced = false;
  private t = 7.3;
  private lastTime = 0;
  private pointer = { x: 0.5, y: 0.5 };
  private readonly onPointerMove: (event: PointerEvent) => void;

  private w = 0;
  private h = 0;
  private scale = 1;

  // Constellation data (virtual 0..1 coordinates, origin at upper-left).
  private static readonly NODES: {
    readonly x: number;
    readonly y: number;
    readonly tint: number; // 0 violet, 1 cyan, 2 amber
    readonly r: number; // base radius factor
  }[] = [
    // Petit Oiseau
    { x: 0.36, y: 0.2, tint: 0, r: 1.0 },
    { x: 0.42, y: 0.3, tint: 1, r: 1.15 },
    { x: 0.48, y: 0.38, tint: 0, r: 1.3 },
    { x: 0.55, y: 0.34, tint: 1, r: 1.05 },
    { x: 0.6, y: 0.42, tint: 0, r: 1.2 },
    { x: 0.66, y: 0.48, tint: 2, r: 1.4 },
    { x: 0.52, y: 0.5, tint: 0, r: 1.0 },
    { x: 0.7, y: 0.55, tint: 1, r: 1.1 },
    // Berceau
    { x: 0.72, y: 0.3, tint: 0, r: 1.15 },
    { x: 0.8, y: 0.34, tint: 1, r: 1.25 },
    { x: 0.78, y: 0.44, tint: 2, r: 1.5 },
    { x: 0.88, y: 0.4, tint: 0, r: 1.0 },
    { x: 0.74, y: 0.54, tint: 1, r: 1.1 },
    { x: 0.92, y: 0.52, tint: 0, r: 1.05 },
    { x: 0.84, y: 0.62, tint: 0, r: 1.25 },
  ];

  private static readonly EDGES: ReadonlyArray<
    readonly [number, number]
  > = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [6, 2], [6, 3], [6, 4], [5, 7],
    [8, 9], [9, 10], [8, 10], [10, 11], [10, 12], [12, 13], [12, 14],
  ];

  private readonly phase: number[] = [];
  private readonly speed: number[] = [];
  private nextShot = 10;

  constructor() {
    const n = CelestialConstellationScene.NODES.length;
    for (let i = 0; i < n; i++) {
      this.phase.push(Math.sin(i * 12.9898 + 78.233) * 43758.5453 % 1 * 6.283);
      this.speed.push(0.7 + Math.abs(Math.cos(i * 47.31)) * 1.1);
    }
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
      this.drawConstellation(9.6, false);
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
    this.scale = Math.min(rectW, rectH) * 0.74;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.paintSky();
    this.paintTints();
    // resize() clears the canvas; repaint the full state right away (also
    // keeps reduced-motion correct after a resize).
    this.drawConstellation(this.t, false);
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
    this.sky = null;
    this.tints = [];
    this.host = null;
  }

  // ---- pre-rendered layers ---------------------------------------------------

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

    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#060418");
    grad.addColorStop(0.42, "#0a0722");
    grad.addColorStop(0.78, "#0d0a2a");
    grad.addColorStop(1, "#0b061f");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    // soft violet nebular wash (upper third)
    const neb = g.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, h * 0.55);
    neb.addColorStop(0, "rgba(92, 74, 168, 0.14)");
    neb.addColorStop(0.55, "rgba(60, 60, 130, 0.06)");
    neb.addColorStop(1, "rgba(40, 30, 80, 0)");
    g.fillStyle = neb;
    g.fillRect(0, 0, w, h);

    // faint static dust
    const stars = 64;
    for (let i = 0; i < stars; i++) {
      const x = (Math.sin(i * 127.1) * 43758.545) % 1;
      const y = (Math.sin(i * 311.7) * 269.5) % 1;
      const px = Math.abs(x) * w ;
      const py = Math.abs(y) * h;
      const a = 0.04 + Math.abs((Math.sin(i * 91.7) * 17.3) % 1) * 0.1;
      const r = 0.4 + ((Math.abs(Math.sin(i * 29.3)) * 3.1) % 1) * 0.7;
      g.fillStyle = `rgba(196, 200, 244, ${a.toFixed(3)})`;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    }
    this.sky = off;
  }

  private paintTints(): void {
    const tints: string[][] = [
      ["148,152,255", "104,118,232"],
      ["122,214,255", "84,168,224"],
      ["255,196,148", "240,150,102"],
    ];
    this.tints = tints.map(([hot, cool]) => {
      const s = 48;
      const off = document.createElement("canvas");
      off.width = s;
      off.height = s;
      const g = off.getContext("2d");
      if (!g) return null;
      const rad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      rad.addColorStop(0, `rgba(${hot},1)`);
      rad.addColorStop(0.25, `rgba(${hot},0.55)`);
      rad.addColorStop(0.55, `rgba(${cool},0.18)`);
      rad.addColorStop(1, `rgba(${cool},0)`);
      g.fillStyle = rad;
      g.fillRect(0, 0, s, s);
      return off;
    });
  }

  // ---- per-frame --------------------------------------------------------------

  private frame = (now: number): void => {
    if (!this.active || this.reduced) {
      this.raftId = null;
      return;
    }
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.t += dt;
    this.drawConstellation(this.t, true);
    this.raftId = requestAnimationFrame(this.frame);
  };

  private projectNode(
    n: { readonly x: number; readonly y: number },
    t: number,
    out: { x: number; y: number }
  ): void {
    const cx = this.w / 2;
    const cy = this.h * 0.52;
    const rotate = Math.sin(t * 0.05) * 0.05 + t * 0.014;
    const cosA = Math.cos(rotate);
    const sinA = Math.sin(rotate);
    const breathe = 1 + Math.sin(t * 0.3) * 0.014;
    const vx = (n.x - 0.5) * this.scale * breathe;
    const vy = (n.y - 0.55) * this.scale * breathe + Math.sin(t * 0.22) * 3.2;
    out.x = cx + vx * cosA - vy * sinA;
    out.y = cy + vx * sinA + vy * cosA;
  }

  private drawConstellation(t: number, animated: boolean): void {
    const ctx = this.ctx;
    if (!ctx || this.w === 0 || this.h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (this.sky) ctx.drawImage(this.sky, 0, 0, this.w, this.h);

    const nodes = CelestialConstellationScene.NODES;
    const n = nodes.length;
    const pts: { x: number; y: number }[] = new Array(n);
    const alpha: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      pts[i] = { x: 0, y: 0 };
      this.projectNode(nodes[i], t, pts[i]);
    }

    // Pointer pull: boost the 3 nearest stars (tasteful, quiet).
    const boosted: boolean[] = new Array(n).fill(false);
    if (animated) {
      const px = this.pointer.x * this.w;
      const py = this.pointer.y * this.h;
      const dists = pts.map((p, i) => {
        const dx = p.x - px;
        const dy = p.y - py;
        return Math.sqrt(dx * dx + dy * dy) + i * 0.001;
      });
      const order = dists
        .map((d, i) => ({ d, i }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      for (const { d, i } of order) {
        if (d < this.scale * 0.32) boosted[i] = true;
      }
    }

    for (let i = 0; i < n; i++) {
      const tw = 0.55 + 0.3 * Math.sin(this.phase[i] + t * this.speed[i]);
      const b = boosted[i] ? 1 : 0;
      alpha[i] = Math.min(1, tw * (1 + b * 0.45));
    }

    const edges = CelestialConstellationScene.EDGES;
    ctx.lineCap = "round";
    for (const [a, b] of edges) {
      const pull = (alpha[a] + alpha[b]) / 2;
      const pa = pts[a];
      const pb = pts[b];
      ctx.strokeStyle = `rgba(148,162,238,${(0.2 + pull * 0.2).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.quadraticCurveTo(
        (pa.x + pb.x) / 2 + Math.sin(t * 0.4 + a) * 6,
        (pa.y + pb.y) / 2 + Math.cos(t * 0.4 + b) * 6,
        pb.x,
        pb.y
      );
      ctx.stroke();
      // brighter core on the most awake filaments
      if (pull > 0.72) {
        ctx.strokeStyle = `rgba(214,228,255,${((pull - 0.7) * 0.9).toFixed(3)})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    for (let i = 0; i < n; i++) {
      const sprite = this.tints[nodes[i].tint];
      if (!sprite) continue;
      const size = this.scale * 0.024 * nodes[i].r * (1 + (boosted[i] ? 0.8 : 0));
      ctx.globalAlpha = alpha[i];
      ctx.drawImage(sprite, pts[i].x - size * 2, pts[i].y - size * 2, size * 4, size * 4);
      if (boosted[i]) {
        ctx.globalAlpha = 0.5;
        ctx.drawImage(sprite, pts[i].x - size * 4, pts[i].y - size * 4, size * 8, size * 8);
      }
    }
    ctx.globalAlpha = 1;

    if (animated) this.drawShootingStar(ctx, t);
  }

  private drawShootingStar(ctx: CanvasRenderingContext2D, t: number): void {
    if (t > this.nextShot) {
      this.nextShot = t + 9 + Math.random() * 8;
    }
    const age = this.nextShot - t;
    if (age <= 0 || age > 1.15) return;
    const fade = Math.sin((age / 1.15) * Math.PI);
    const x0 = this.w * (0.15 + (0.7 - age) * 0.55);
    const y0 = this.h * (0.3 + (0.5 - age) * 0.55) + this.h * 0.06;
    const x1 = x0 + 34;
    const y1 = y0 + 15;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, "rgba(150,170,255,0)");
    grad.addColorStop(1, `rgba(220,232,255,${(0.85 * fade).toFixed(3)})`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

export const celestialConstellationAnimation: VersoAnimationDefinition = {
  id: "celestial_constellation",
  create: () => new CelestialConstellationScene(),
};