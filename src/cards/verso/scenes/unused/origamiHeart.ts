import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../../types";

class OrigamiHeartScene implements VersoScene {
  readonly id = "origami_heart";

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
  private sx = 0;
  private sy = 0;

  private readonly SEG = 72;
  private readonly LAYERS = 15;
  private radii: Float32Array | null = null;
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
    if (this.t === 0) this.t = 1.6;
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

    this.scale = Math.min(rectW, rectH) * 0.34;
    this.sx = rectW / 2;
    this.sy = rectH * 0.46;
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
    this.radii = null;
  }

  private static inHeart(x: number, y: number): boolean {
    const a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y <= 0;
  }

  private buildRadii(): void {
    const S = this.SEG;
    const r = new Float32Array(S);
    for (let j = 0; j < S; j++) {
      const th = (j / S) * Math.PI * 2;
      const dx = Math.cos(th);
      const dy = Math.sin(th);
      let tMax = 0;
      for (let u = 0; u <= 340; u++) {
        const tt = (u / 340) * 1.75;
        if (OrigamiHeartScene.inHeart(dx * tt, dy * tt)) tMax = tt;
        else if (u > 8) break;
      }
      r[j] = Math.max(tMax, 0.05);
    }
    this.radii = r;
  }

  private buildShades(): void {
    this.shades = [];
    const from = [247, 236, 214];
    const to = [112, 66, 86];
    for (let i = 0; i <= 32; i++) {
      const k = i / 32;
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
    if (w === 0 || h === 0) return;
    const S = this.SEG;
    const K = this.LAYERS;
    const radii = this.radii;
    if (!radii) return;

    const t = this.reduced ? 1.6 : this.t;
    const ry = this.reduced
      ? 0.34
      : 0.34 * Math.sin(t * 0.4) +
        (this.pointer.x >= 0 ? (this.pointer.x - 0.5) * 0.5 : 0);
    const rx = this.reduced
      ? 0.08
      : 0.08 + (this.pointer.y >= 0 ? (this.pointer.y - 0.5) * 0.22 : 0);
    const cosRy = Math.cos(ry);
    const sinRy = Math.sin(ry);
    const cosRx = Math.cos(rx);
    const sinRx = Math.sin(rx);

    const cx = this.sx;
    const cy = this.sy;
    let s = this.scale;
    if (!this.reduced) s *= 1 + 0.03 * Math.sin(t * 1.2);

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    const bg = ctx.createRadialGradient(cx, cy - h * 0.08, 6, cx, cy, h * 0.74);
    bg.addColorStop(0, "#271019");
    bg.addColorStop(0.55, "#170c12");
    bg.addColorStop(1, "#0b070b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const halo = ctx.createRadialGradient(cx, cy, 4, cx, cy, s * 1.85);
    halo.addColorStop(0, "rgba(255,166,118,0.22)");
    halo.addColorStop(0.5, "rgba(226,120,112,0.09)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(cx - s * 1.85, cy - s * 1.85, s * 3.7, s * 3.7);

    ctx.save();
    ctx.translate(cx, cy + s * 1.05);
    ctx.scale(1, 0.3);
    const sh = ctx.createRadialGradient(0, 0, 2, 0, 0, s * 1.1);
    sh.addColorStop(0, "rgba(0,0,0,0.4)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(0, 0, s * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const totalVerts = (K + 1) * S;
    const px = new Float32Array(totalVerts);
    const py = new Float32Array(totalVerts);
    const pz = new Float32Array(totalVerts);

    const Z_BACK = -0.14;
    for (let k = 0; k < K; k++) {
      const fold = Z_BACK + k * 0.1 + 0.062 * Math.sin(k * 2.3 + t * 0.42);
      const sk = 1 - k / (K + 0.6);
      const base = k * S;
      for (let j = 0; j < S; j++) {
        const rad = radii[j] * sk;
        const th = (j / S) * Math.PI * 2;
        const x = rad * Math.cos(th) * s;
        const y = rad * Math.sin(th) * s;
        const z = fold * s;
        const xr = x * cosRy + z * sinRy;
        const zr = -x * sinRy + z * cosRy;
        const yr = y * cosRx - zr * sinRx;
        px[base + j] = xr;
        py[base + j] = yr;
        pz[base + j] = y * sinRx + zr * cosRx;
      }
    }
    {
      const base = K * S;
      const lz = -0.02 * s;
      const y0 = 0;
      for (let j = 0; j < S; j++) {
        px[base + j] = lz * sinRy;
        py[base + j] = y0 * cosRx - (lz * cosRy * sinRx);
        pz[base + j] = lz * cosRy * cosRx;
      }
    }

    const tris: number[] = [];
    for (let k = 0; k < K - 1; k++) {
      const b0 = k * S;
      const b1 = (k + 1) * S;
      for (let j = 0; j < S; j++) {
        const j2 = (j + 1) % S;
        tris.push(b0 + j, b1 + j, b0 + j2);
        tris.push(b1 + j, b1 + j2, b0 + j2);
      }
    }
    {
      const b0 = (K - 1) * S;
      const b1 = K * S;
      for (let j = 0; j < S; j++) {
        const j2 = (j + 1) % S;
        tris.push(b1 + j, b0 + j, b0 + j2);
      }
    }

    const order: number[] = tris.map((_, i) => i);
    order.sort((a, b) => {
      const aa = a * 3;
      const bb = b * 3;
      const za = pz[tris[aa]] + pz[tris[aa + 1]] + pz[tris[aa + 2]];
      const zb = pz[tris[bb]] + pz[tris[bb + 1]] + pz[tris[bb + 2]];
      return za - zb;
    });

    const lx = 0.5;
    const ly = -0.65;
    const lz = 0.6;
    const le = Math.hypot(lx, ly, lz);

    for (let i = 0; i < order.length; i++) {
      const idx = order[i] * 3;
      const i0 = tris[idx];
      const i1 = tris[idx + 1];
      const i2 = tris[idx + 2];
      const x0 = px[i0];
      const y0 = py[i0];
      const z0 = pz[i0];
      const x1 = px[i1];
      const y1 = py[i1];
      const z1 = pz[i1];
      const x2 = px[i2];
      const y2 = py[i2];
      const z2 = pz[i2];
      const ux = x1 - x0;
      const uy = y1 - y0;
      const uz = z1 - z0;
      const vx = x2 - x0;
      const vy = y2 - y0;
      const vz = z2 - z0;
      const crx = uy * vz - uz * vy;
      const cry = uz * vx - ux * vz;
      const crz = ux * vy - uy * vx;
      const nl = Math.hypot(crx, cry, crz) || 1;
      const facing = crx * lx + cry * ly + crz * lz;
      const nd = Math.abs(facing) / (nl * le);
      const vd = Math.abs(crz) / nl;
      const brt = 0.24 + 0.88 * nd - 0.24 * vd;
      const cidx = Math.min(32, Math.max(0, Math.round(brt * 32)));
      ctx.fillStyle = this.shades[cidx];
      ctx.beginPath();
      ctx.moveTo(x0 + cx, y0 + cy);
      ctx.lineTo(x1 + cx, y1 + cy);
      ctx.lineTo(x2 + cx, y2 + cy);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(72,44,62,0.44)";
    ctx.lineWidth = 1;
    for (let k = 0; k < K; k++) {
      const base = k * S;
      ctx.beginPath();
      for (let j = 0; j <= S; j++) {
        const jj = j % S;
        const idx = base + jj;
        if (j === 0) ctx.moveTo(px[idx] + cx, py[idx] + cy);
        else ctx.lineTo(px[idx] + cx, py[idx] + cy);
      }
      ctx.stroke();
    }
  }
}

export const origamiHeartAnimation: VersoAnimationDefinition = {
  id: "origami_heart",
  create: () => new OrigamiHeartScene(),
};