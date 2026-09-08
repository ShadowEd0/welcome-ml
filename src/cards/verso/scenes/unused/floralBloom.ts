import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../../types";

interface Petal {
  x: number;
  y: number;
  size: number;
  phase: number;
  color: number;
  depth: number;
}

interface Faller {
  x: number;
  y: number;
  vy: number;
  sway: number;
  spin: number;
  size: number;
  color: number;
  a: number;
}

class FloralBloomScene implements VersoScene {
  readonly id = "floral_bloom";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private raftId: number | null = null;
  private active = false;
  private reduced = false;
  private t = 0;
  private lastTime = 0;
  private pointer = { x: -1, y: -1 };
  private readonly onPointerMove: (event: PointerEvent) => void;
  private readonly onPointerLeave: (event: PointerEvent) => void;

  private w = 0;
  private h = 0;
  private dpr = 1;
  private scale = 1;
  private cx = 0;
  private cy = 0;

  private petals: Petal[] = [];
  private fallers: Faller[] = [];
  private readonly palette: string[] = [
    "#ffe3ec",
    "#ffb9cd",
    "#ff8fb2",
    "#ef6a9a",
    "#c64c86",
    "#ffcd99",
  ];
  private readonly veins: string[] = [
    "rgba(196,64,110,0.35)",
    "rgba(196,64,110,0.45)",
    "rgba(180,50,120,0.5)",
    "rgba(160,40,130,0.55)",
    "rgba(140,40,120,0.6)",
    "rgba(190,90,60,0.4)",
  ];

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
    this.onPointerLeave = () => {
      this.pointer = { x: -1, y: -1 };
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
    host.addEventListener("pointermove", this.onPointerMove, { passive: true });
    host.addEventListener("pointerleave", this.onPointerLeave, { passive: true });

    this.resize();
    if (this.t === 0) this.t = 1.8;
    this.render();
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
      this.render();
    } else if (this.active && this.raftId === null) {
      this.lastTime = performance.now();
      this.raftId = requestAnimationFrame(this.frame);
    }
  }

  resize(): void {
    const host = this.host;
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!host || !canvas || !ctx) return;
    const rectW = host.clientWidth;
    const rectH = host.clientHeight;
    if (rectW === 0 || rectH === 0) return;
    this.w = rectW;
    this.h = rectH;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rectW * this.dpr);
    const h = Math.round(rectH * this.dpr);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${rectW}px`;
    canvas.style.height = `${rectH}px`;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.scale = Math.min(rectW, rectH) * 0.35;
    this.cx = rectW / 2;
    this.cy = rectH * 0.48;
    this.buildBoundary();
    this.scatter();
    this.seedFallers();
    this.render();
  }

  destroy(): void {
    if (this.raftId !== null) {
      cancelAnimationFrame(this.raftId);
      this.raftId = null;
    }
    if (this.host) {
      this.host.removeEventListener("pointermove", this.onPointerMove);
      this.host.removeEventListener("pointerleave", this.onPointerLeave);
    }
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.petals = [];
    this.fallers = [];
  }

  private static rand(seed: number): number {
    const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  private boundaryR: Float32Array | null = null;

  private buildBoundary(): void {
    const S = 36;
    const r = new Float32Array(S);
    for (let i = 0; i < S; i++) {
      const th = (i / S) * Math.PI * 2;
      const dx = Math.cos(th);
      const dy = Math.sin(th);
      let tMax = 0;
      for (let u = 0; u <= 300; u++) {
        const tt = (u / 300) * 1.7;
        const px = dx * tt;
        const py = dy * tt;
        const a = px * px + py * py - 1;
        if (a * a * a - px * px * py * py * py <= 0) tMax = tt;
        else if (u > 8) break;
      }
      r[i] = Math.max(tMax, 0.05);
    }
    this.boundaryR = r;
  }

  private scatter(): void {
    const S = this.boundaryR ? this.boundaryR.length : 48;
    const petals: Petal[] = [];
    for (let i = 0; i < S; i++) {
      const th = (i / S) * Math.PI * 2;
      const r = this.boundaryR ? this.boundaryR[i] : 1;
      // place 1-2 petals per boundary point, slightly inside the shell
      for (let k = 0; k < 1; k++) {
        const jitterR = 0.85 + FloralBloomScene.rand(i * 7 + k) * 0.1;
        const hx = Math.cos(th) * r * jitterR;
        const hy = Math.sin(th) * r * jitterR + 0.05; // heart center y=0.05
        const depthBias = (jitterR - 0.85) * 2;
        petals.push({
          x: hx,
          y: hy,
          size: 0.55 + FloralBloomScene.rand(i * 9 + k) * 0.35,
          phase: FloralBloomScene.rand(i * 17 + k) * Math.PI * 2,
          color: Math.floor(FloralBloomScene.rand(i * 23 + k) * this.palette.length),
          depth: depthBias + FloralBloomScene.rand(i * 29 + k) * 0.3,
        });
      }
    }
    petals.sort((a, b) => a.depth - b.depth);
    this.petals = petals;
  }

  private seedFallers(): void {
    const fallers: Faller[] = [];
    for (let i = 0; i < 8; i++) {
      fallers.push(this.makeFaller(i * 1.3));
    }
    this.fallers = fallers;
  }

  private makeFaller(seed: number): Faller {
    return {
      x: FloralBloomScene.rand(seed * 3 + 1),
      y: FloralBloomScene.rand(seed * 3 + 2) * 1.4 - 0.3,
      vy: 0.006 + FloralBloomScene.rand(seed * 3 + 3) * 0.012,
      sway: FloralBloomScene.rand(seed * 3 + 4) * 40 + 14,
      spin: FloralBloomScene.rand(seed * 3 + 5) * 0.02 + 0.006,
      size: 0.24 + FloralBloomScene.rand(seed * 3 + 6) * 0.22,
      color: Math.floor(FloralBloomScene.rand(seed * 3 + 7) * this.palette.length),
      a: 0.5 + FloralBloomScene.rand(seed) * 0.35,
    };
  }

  private frame = (now: number): void => {
    if (this.raftId === null) return;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.t += dt;
    this.render();
    if (this.raftId !== null && !this.reduced) {
      this.raftId = requestAnimationFrame(this.frame);
    }
  };

  private render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.w;
    const h = this.h;
    if (!ctx || w === 0 || h === 0) return;
    const t = this.reduced ? 1.8 : this.t;

    const shiftX = this.pointer.x >= 0 ? (this.pointer.x - 0.5) * 20 : 0;
    const shiftY = this.pointer.y >= 0 ? (this.pointer.y - 0.5) * 16 : 0;
    const cx = this.cx + shiftX;
    const cy = this.cy + shiftY;
    const s = this.scale;

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    const bg = ctx.createRadialGradient(cx, cy, 4, cx, cy, h * 0.72);
    bg.addColorStop(0, "#14201a");
    bg.addColorStop(0.55, "#0c1410");
    bg.addColorStop(1, "#060a08");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const halo = ctx.createRadialGradient(cx, cy, 4, cx, cy, s * 1.5);
    halo.addColorStop(0, "rgba(255,170,190,0.16)");
    halo.addColorStop(0.6, "rgba(216,90,140,0.05)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(cx - s * 1.5, cy - s * 1.5, s * 3, s * 3);

    // subtle heart outline glow to anchor the silhouette
    const bR = this.boundaryR;
    if (bR) {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(255,170,190,0.16)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const S = bR.length;
      for (let i = 0; i <= S; i++) {
        const ii = i % S;
        const th = (ii / S) * Math.PI * 2;
        const rr = bR[ii] * s;
        const px = cx + rr * Math.cos(th);
        const py = cy + rr * Math.sin(th) + 0.05 * s;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }

    const breath = this.reduced ? 1 : 1 + 0.025 * Math.sin(t * 1.15);

    // petals, painted back-to-front (already sorted by depth)
    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i];
      const rad = Math.hypot(p.x, p.y - 0.05) || 0.001;
      const orient = Math.atan2(p.y - 0.05, p.x);
      const openness = 0.5 + 0.5 * Math.sin(t * 0.62 + p.phase);
      const rot = orient + (1 - openness) * 0.9 * Math.sign(rad);
      const size = p.size * s * breath;
      const px = cx + p.x * s * breath;
      const py = cy + (p.y - 0.05) * s * breath + 0.05 * s;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.scale(size, size * (0.86 + 0.1 * openness));

      const base = this.palette[p.color];
      ctx.fillStyle = base;
      this.tracePetal(ctx);
      ctx.fill();

      // dark base + pale highlight for depth
      ctx.fillStyle = "rgba(40,10,30,0.18)";
      ctx.beginPath();
      ctx.ellipse(0.28, 0, 0.34, 0.16, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = this.veins[p.color];
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(0.14, 0);
      ctx.quadraticCurveTo(0.42, 0.02, 0.84, 0);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,240,0.22)";
      ctx.beginPath();
      ctx.ellipse(0.78, -0.06, 0.14, 0.06, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // falling petals
    ctx.globalCompositeOperation = "source-over";
    const swayT = this.reduced ? 0 : t;
    for (let i = 0; i < this.fallers.length; i++) {
      const f = this.fallers[i];
      let fy = f.y;
      if (!this.reduced) {
        fy += t * f.vy;
        if (fy > 1.15) {
          this.fallers[i] = this.makeFaller(i + t * 1.7);
          continue;
        }
      }
      const fx = f.x * w + Math.sin(swayT * 1.3 + i) * f.sway;
      const fsy = (fy - 0.1) * h;
      const alpha = this.reduced ? 0.3 : f.a * (1 - Math.max(0, (fy - 0.75) / 0.4));
      if (alpha <= 0.02) continue;
      const prx = this.reduced ? 0 : Math.sin(swayT * 0.9 + i * 2) * 0.16;
      ctx.save();
      ctx.translate(fx, fsy);
      ctx.rotate(prx + (this.reduced ? 0.3 : f.spin * t * 20) * Math.sign(fx - cx));
      ctx.scale(f.size * s, f.size * s);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.palette[f.color];
      this.tracePetal(ctx);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // pollen motes
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 26; i++) {
      const ux = (FloralBloomScene.rand(i) - 0.5) * 1.9;
      const uy = (FloralBloomScene.rand(i + 50) - 0.5) * 1.7;
      const wob = this.reduced ? 0 : Math.sin(t * 1.4 + i * 1.9) * 4;
      const al = this.reduced
        ? 0.18
        : 0.12 + 0.2 * Math.abs(Math.sin(t * 1.9 + i * 2.7));
      ctx.fillStyle = `rgba(255,236,200,${al.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(cx + ux * s, cy + uy * s + wob, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private tracePetal(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(0.46, -0.52, 0.92, -0.5, 1.02, 0);
    ctx.bezierCurveTo(0.92, 0.5, 0.46, 0.52, 0, 0);
    ctx.closePath();
  }
}
export const floralBloomAnimation: VersoAnimationDefinition = {
  id: "floral_bloom",
  create: () => new FloralBloomScene(),
};