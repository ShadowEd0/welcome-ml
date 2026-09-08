import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

class GeometricMorphingScene implements VersoScene {
  readonly id = "geometric_morphing";

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

  private readonly K = 72;
  private heartR: Float32Array | null = null;
  private diamondR: Float32Array | null = null;
  private squareR: Float32Array | null = null;
  private shades: string[] = [];

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
    this.buildShades();
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
    if (this.t === 0) this.t = 1.4;
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

    this.scale = Math.min(rectW, rectH) * 0.3;
    this.cx = rectW / 2;
    this.cy = rectH * 0.5;
    this.buildRadii();
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
    this.heartR = null;
    this.diamondR = null;
    this.squareR = null;
  }

  private static inHeart(x: number, y: number): boolean {
    const a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y <= 0;
  }

  private superR(th: number, k: number, a: number, b: number): number {
    const c = Math.abs(Math.cos(th));
    const s = Math.abs(Math.sin(th));
    if (k === 1) return 1 / (c / a + s / b);
    const den = Math.pow(c, k) / Math.pow(a, k) + Math.pow(s, k) / Math.pow(b, k);
    return Math.pow(den, -1 / k);
  }

  private buildRadii(): void {
    const K = this.K;
    const hr = new Float32Array(K);
    const dr = new Float32Array(K);
    const sr = new Float32Array(K);
    let hMax = 0;
    for (let i = 0; i < K; i++) {
      const th = (i / K) * Math.PI * 2;
      const dx = Math.cos(th);
      const dy = Math.sin(th);
      let tMax = 0;
      for (let u = 0; u <= 340; u++) {
        const tt = (u / 340) * 1.8;
        if (GeometricMorphingScene.inHeart(dx * tt, dy * tt)) tMax = tt;
        else if (u > 8) break;
      }
      hr[i] = tMax;
      if (tMax > hMax) hMax = tMax;
      dr[i] = this.superR(th, 1.1, 0.95, 1.12);
      sr[i] = this.superR(th, 4, 0.92, 0.96);
    }
    const scale = 1.08 / hMax;
    for (let i = 0; i < K; i++) {
      hr[i] *= scale;
      dr[i] *= 1.05;
      sr[i] *= 1.05;
    }
    this.heartR = hr;
    this.diamondR = dr;
    this.squareR = sr;
  }

  private buildShades(): void {
    this.shades = [];
    const from = [71, 52, 118];
    const to = [166, 128, 216];
    for (let i = 0; i <= 24; i++) {
      const k = i / 24;
      const r = Math.round(from[0] + (to[0] - from[0]) * k);
      const g = Math.round(from[1] + (to[1] - from[1]) * k);
      const b = Math.round(from[2] + (to[2] - from[2]) * k);
      this.shades.push(`rgb(${r},${g},${b})`);
    }
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
    const hr = this.heartR;
    const dr = this.diamondR;
    const sr = this.squareR;
    if (!ctx || w === 0 || h === 0 || !hr || !dr || !sr) return;
    const K = this.K;
    const t = this.reduced ? 1.4 : this.t;

    const shiftX = this.pointer.x >= 0 ? (this.pointer.x - 0.5) * 24 : 0;
    const shiftY = this.pointer.y >= 0 ? (this.pointer.y - 0.5) * 18 : 0;
    const cx = this.cx + shiftX;
    const cy = this.cy + shiftY;
    const s = this.scale * (this.reduced ? 1 : 1 + 0.02 * Math.sin(t * 0.9));

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    const bg = ctx.createRadialGradient(cx, cy, 4, cx, cy, h * 0.72);
    bg.addColorStop(0, "#150e28");
    bg.addColorStop(0.55, "#0d0918");
    bg.addColorStop(1, "#06040c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // blueprint guide rings
    ctx.strokeStyle = "rgba(150,140,210,0.12)";
    ctx.lineWidth = 1;
    for (const rk of [2.18, 1.62, 1.22]) {
      ctx.beginPath();
      ctx.arc(cx, cy, s * rk, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(180,170,235,0.16)";
    ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.arc(cx, cy, s * 1.44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // morph phase: 0 heart, 1 diamond, 2 square (looping)
    const phaseRaw = this.reduced ? 2.4 : (t * 0.16) % 3;
    const seg = Math.floor(phaseRaw) % 3;
    const frac = phaseRaw - Math.floor(phaseRaw);
    const e = frac * frac * (3 - 2 * frac); // smoothstep
    const rUnits = [hr, dr, sr];
    const rA = rUnits[seg];
    const rB = rUnits[(seg + 1) % 3];

    // radius per vertex with a faint crystalline tremble
    const R = new Float32Array(K);
    for (let i = 0; i < K; i++) {
      let r = rA[i] + (rB[i] - rA[i]) * e;
      if (!this.reduced) r *= 1 + 0.012 * Math.sin(i * 2.3 + t * 0.6);
      R[i] = r * s;
    }

    const vertsX = new Float32Array(K);
    const vertsY = new Float32Array(K);
    for (let i = 0; i < K; i++) {
      const th = (i / K) * Math.PI * 2;
      const rr = R[i];
      vertsX[i] = cx + rr * Math.cos(th);
      vertsY[i] = cy + rr * Math.sin(th);
    }

    // crystal facets: fan of triangles from the center
    for (let i = 0; i < K; i++) {
      const j = (i + 1) % K;
      const ri = vertsX[i];
      const rj = vertsY[i];
      const ni = vertsX[j];
      const nj = vertsY[j];
      const bright = this.reduced
        ? 0.55 + 0.2 * Math.abs(Math.sin(i * 1.7))
        : 0.42 + 0.3 * (0.5 + 0.5 * Math.sin(i * 2.7 + t * 0.55));
      const cidx = Math.min(24, Math.max(0, Math.round(bright * 24)));
      ctx.fillStyle = this.shades[cidx];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ri, rj);
      ctx.lineTo(ni, nj);
      ctx.closePath();
      ctx.fill();
    }

    // rim glow + crisp outline (single pass each for a clean edge)
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "rgba(150,120,255,0.14)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i <= K; i++) {
      const jj = i % K;
      if (i === 0) ctx.moveTo(vertsX[jj], vertsY[jj]);
      else ctx.lineTo(vertsX[jj], vertsY[jj]);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";

    ctx.strokeStyle = "rgba(214,186,255,0.6)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= K; i++) {
      const jj = i % K;
      if (i === 0) ctx.moveTo(vertsX[jj], vertsY[jj]);
      else ctx.lineTo(vertsX[jj], vertsY[jj]);
    }
    ctx.closePath();
    ctx.stroke();

    // orbiting data dots
    const dots = 8;
    const spin = this.reduced ? 0 : t * 0.32;
    ctx.globalCompositeOperation = "lighter";
    for (let d = 0; d < dots; d++) {
      const th = (d / dots) * Math.PI * 2 + spin;
      const rr = s * 1.5;
      const adx = cx + rr * Math.cos(th);
      const ady = cy + rr * Math.sin(th);
      const fade = this.reduced ? 0.6 : 0.35 + 0.4 * Math.abs(Math.sin(th * 2 + t * 0.8));
      ctx.fillStyle = `rgba(255,170,190,${fade.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(adx, ady, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";

    // vertex accents
    ctx.fillStyle = "rgba(226,205,255,0.8)";
    for (let i = 0; i < K; i += 12) {
      ctx.beginPath();
      ctx.arc(vertsX[i], vertsY[i], 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // central core
    const coreP = this.reduced ? 0.85 : 0.85 + 0.15 * Math.sin(t * 2.2);
    ctx.fillStyle = `rgba(255,214,240,${(coreP * 0.9).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const geometricMorphingAnimation: VersoAnimationDefinition = {
  id: "geometric_morphing",
  create: () => new GeometricMorphingScene(),
};