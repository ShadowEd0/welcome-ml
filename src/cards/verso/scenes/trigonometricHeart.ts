import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

class TrigonometricHeartScene implements VersoScene {
  readonly id = "trigonometric_heart";

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

  private readonly N = 520;
  private ptsX: Float32Array | null = null;
  private ptsY: Float32Array | null = null;
  private trailColors: string[] = [];
  private glow: HTMLCanvasElement | null = null;
  private readonly SPARK = 26;
  private sparkSeed: number[] = [];

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
    for (let i = 0; i < this.SPARK; i++) this.sparkSeed.push(i * 0.732 + 0.37);
    this.buildColors();
    this.buildGlow();
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
    if (this.t === 0) this.t = 1.2;
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

    this.scale = Math.min(rectW, rectH) * 0.019;
    this.cx = rectW / 2;
    this.cy = rectH * 0.5;
    this.buildCurve();
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
    this.ptsX = null;
    this.ptsY = null;
  }

  private buildCurve(): void {
    const N = this.N;
    const px = new Float32Array(N);
    const py = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const tt = (i / N) * Math.PI * 2;
      const s3 = Math.sin(tt);
      const x = 16 * s3 * s3 * s3;
      const y = 13 * Math.cos(tt) - 5 * Math.cos(2 * tt) - 2 * Math.cos(3 * tt) - Math.cos(4 * tt);
      px[i] = x * this.scale;
      py[i] = -y * this.scale;
    }
    this.ptsX = px;
    this.ptsY = py;
  }

  private buildColors(): void {
    const stops: [string, number][] = [
      ["#3d1f54", 0],
      ["#6d2f7f", 0.28],
      ["#c4458c", 0.55],
      ["#ff7a6e", 0.8],
      ["#ffd8ae", 1],
    ];
    this.trailColors = [];
    const L = 180;
    for (let i = 0; i < L; i++) {
      const k = i / (L - 1);
      let a = stops[0];
      let b = stops[stops.length - 1];
      for (let sI = 0; sI < stops.length - 1; sI++) {
        if (k >= stops[sI][1] && k <= stops[sI + 1][1]) {
          a = stops[sI];
          b = stops[sI + 1];
          break;
        }
      }
      const span = b[1] - a[1];
      const lk = span === 0 ? 1 : (k - a[1]) / span;
      const ia = parseInt(a[0].slice(1, 3), 16);
      const ig = parseInt(a[0].slice(3, 5), 16);
      const ib = parseInt(a[0].slice(5, 7), 16);
      const ja = parseInt(b[0].slice(1, 3), 16);
      const jg = parseInt(b[0].slice(3, 5), 16);
      const jb = parseInt(b[0].slice(5, 7), 16);
      const r = Math.round(ia + (ja - ia) * lk);
      const g = Math.round(ig + (jg - ig) * lk);
      const bl = Math.round(ib + (jb - ib) * lk);
      this.trailColors.push(`rgb(${r},${g},${bl})`);
    }
  }

  private buildGlow(): void {
    const s = 96;
    const off = document.createElement("canvas");
    off.width = s;
    off.height = s;
    const g = off.getContext("2d");
    if (!g) return;
    const rad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rad.addColorStop(0, "rgba(255,236,214,0.95)");
    rad.addColorStop(0.25, "rgba(255,170,140,0.4)");
    rad.addColorStop(0.6, "rgba(232,90,150,0.12)");
    rad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, s, s);
    this.glow = off;
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
    const px = this.ptsX;
    const py = this.ptsY;
    if (!ctx || w === 0 || h === 0 || !px || !py) return;
    const N = this.N;
    const t = this.reduced ? 1.2 : this.t;

    const shiftX = this.pointer.x >= 0 ? (this.pointer.x - 0.5) * 26 : 0;
    const shiftY = this.pointer.y >= 0 ? (this.pointer.y - 0.5) * 20 : 0;
    const cx = this.cx + shiftX;
    const cy = this.cy + shiftY;

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    const bg = ctx.createRadialGradient(cx, cy, 4, cx, cy, h * 0.72);
    bg.addColorStop(0, "#1c0d22");
    bg.addColorStop(0.55, "#110818");
    bg.addColorStop(1, "#07040b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const pulse = this.reduced ? 1 : 1 + 0.05 * Math.sin(t * 1.1);

    // the full heart outline is always present: a soft glow pass plus a
    // clear gradient stroke, keeping the silhouette readable at any moment
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(255,120,180,0.16)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      if (i === 0) ctx.moveTo(px[i], py[i]);
      else ctx.lineTo(px[i], py[i]);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";

    const topGrad = ctx.createLinearGradient(0, cy - py[0] - 90, 0, cy - py[0] + 90);
    topGrad.addColorStop(0, "#ffcfae");
    topGrad.addColorStop(0.5, "#ff7a6e");
    topGrad.addColorStop(1, "#a34bc0");
    ctx.strokeStyle = topGrad;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      if (i === 0) ctx.moveTo(px[i], py[i]);
      else ctx.lineTo(px[i], py[i]);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    const speed = this.reduced ? 0 : 7.6;
    const headF = this.reduced ? 0.27 : (t * speed) % 1;
    const head = Math.floor(headF * N);
    const M = this.reduced ? 120 : 120;

    // trail: draw from the head backwards (glow at head)
    for (let k = M - 1; k >= 1; k--) {
      const i0 = (head - (k - 1) + N * 8) % N;
      const i1 = (head - k + N * 8) % N;
      const idx = Math.round((k / (M - 1)) * (this.trailColors.length - 1));
      ctx.strokeStyle = this.trailColors[idx];
      ctx.lineWidth = 1 + 3 * (k / M);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px[i0], py[i0]);
      ctx.lineTo(px[i1], py[i1]);
      ctx.stroke();
    }

    // blue echo dot running a half period behind the head (heartbeat)
    if (!this.reduced) {
      const bf = (headF + 0.5) % 1;
      const bi = Math.floor(bf * N);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(150,200,255,0.9)";
      ctx.beginPath();
      ctx.arc(px[bi] + cx, py[bi] + cy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    // orbiting sparkles
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < this.SPARK; i++) {
      const u = this.reduced
        ? this.sparkSeed[i]
        : (this.sparkSeed[i] + t * 0.05) % 1;
      const idx = Math.max(0, Math.min(N - 1, Math.floor(u * N)));
      const wob = Math.sin(t * 2.4 + this.sparkSeed[i] * 40) * 3;
      const sxp = px[idx] * pulse + Math.cos(this.sparkSeed[i] * 9) * wob;
      const syp = py[idx] * pulse + Math.sin(this.sparkSeed[i] * 7) * wob;
      const al = this.reduced ? 0.25 : 0.2 + 0.35 * Math.abs(Math.sin(t * 1.7 + this.sparkSeed[i] * 30));
      ctx.fillStyle = `rgba(255,210,190,${al.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(cx + sxp, cy + syp, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // head glow
    const headGlow = this.glow;
    if (headGlow) {
      const gs = (14 + Math.sin(t * 2.6) * 2) * pulse;
      ctx.drawImage(
        headGlow,
        cx + px[head] - gs,
        cy + py[head] - gs,
        gs * 2,
        gs * 2,
      );
    }
    ctx.globalCompositeOperation = "source-over";

    // bright head core
    ctx.fillStyle = "rgba(255,244,228,0.95)";
    ctx.beginPath();
    ctx.arc(cx + px[head], cy + py[head], 2.1 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const trigonometricHeartAnimation: VersoAnimationDefinition = {
  id: "trigonometric_heart",
  create: () => new TrigonometricHeartScene(),
};