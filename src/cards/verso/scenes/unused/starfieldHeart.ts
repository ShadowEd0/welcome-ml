import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../../types";

/**
 * "starfield_heart" — a slow-breathing heart made of golden stardust.
 *
 * A volume of small luminous particles is scattered inside a parametric
 * heart volume (the classic heart curve extruded into a shell). The whole
 * field breathes (slow scale pulse), drifts in an orbital circulation
 * around the core, and gathers an extra brightness near the centre where a
 * dense nucleus glows. The pointer can part the dust locally (a tiny
 * repulsion wave); the motes then ease back to their resting places.
 *
 * Reduced motion keeps a full static composition (lit core + settled
 * heart-shaped field). Resize repaints the current state immediately so no
 * blank canvas ever appears.
 */
class StarfieldHeartScene implements VersoScene {
  readonly id = "starfield_heart";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private coreSprite: HTMLCanvasElement | null = null; // pre-rendered nucleus glow
  private raftId: number | null = null;
  private active = false;
  private reduced = false;
  private t = 0;
  private lastTime = 0;
  private pointer = { x: -1, y: -1 }; // in host fractions, -1 = absent
  private readonly onPointerMove: (event: PointerEvent) => void;
  private readonly onPointerLeave: (event: PointerEvent) => void;

  private w = 0;
  private h = 0;
  private dpr = 1;
  private particles: {
    baseX: number; baseY: number; // resting heart-shape position
    orbit: number; orbitSpeed: number; phase: number;
    size: number; alpha: number; depth: number; // -1..1 shell bias
  }[] = [];
  private nucleus = { x: 0, y: 0, r: 0 };

  // Cached interior heart polygon (y-fill), rebuilt per resize.
  private heartPath: Path2D | null = null;

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
    if (this.t === 0) this.t = 2.4;
    this.render();
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

    this.paintCoreSprite();
    this.buildHeartPath();
    this.scatter();
    // resize() cleared the canvas: repaint the settled composition now.
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
    this.coreSprite = null;
    this.heartPath = null;
    this.particles = [];
    this.host = null;
  }

  // ---- geometry -------------------------------------------------------------

  private rand(seed: number): number {
    const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  /**
   * Signed test of the classic heart implicit surface
   * (x² + y² − 1)³ − x²·y³ ≤ 0 inside. x ∈ [-1.2, 1.2], y ∈ [-1.15, 1.15],
   * apex (lobes) at top (y ≈ +1), point at bottom (y ≈ −1). Smooth 3D shell is
   * obtained by accepting points near a sampled surface, not a solid fill,
   * which keeps the heart outline crisp.
   */
  private inHeart(x: number, y: number): boolean {
    const a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y <= 0;
  }

  /** A point on the heart surface with unit-ish normal direction noise. */
  private heartShell(sx: number, sy: number): [number, number] {
    // sample inside the solid then push outward along the gradient to land
    // on the surface, giving dense coverage of the 3D shell.
    const x = (this.rand(sx) * 2 - 1) * 1.22;
    const y = (this.rand(sy) * 2 - 1) * 1.18;
    // gradient of f = (x²+y²-1)³ - x²y³
    const gx = 6 * x * (x * x + y * y - 1) ** 2 - 2 * x * y * y * y;
    const gy = 6 * y * (x * x + y * y - 1) ** 2 - 3 * x * x * y * y;
    let nx = x;
    let ny = y;
    for (let k = 0; k < 6; k++) {
      const f = heartF(nx, ny);
      const len = Math.hypot(gx, gy) || 1;
      nx -= (gx / len) * f * 0.5;
      ny -= (gy / len) * f * 0.5;
    }
    return [nx, ny];
  }

  private buildHeartPath(): void {
    if (this.w === 0 || this.h === 0) return;
    const cx = this.w / 2;
    const cy = this.h * 0.52;
    const s = this.coreScale();
    const path = new Path2D();
    let started = false;
    // sample the implicit surface boundary on a fine grid of vertical slices
    const grid = 220;
    for (let iy = 0; iy <= grid; iy++) {
      const y = ((iy / grid) * 2 - 1.18);
      const inB = [];
      for (let ix = 0; ix <= grid; ix++) {
        const x = ((ix / grid) * 2 - 1.22);
        if (this.inHeart(x, y)) inB.push(x);
      }
      if (inB.length < 2) continue;
      const x0 = Math.min(...inB);
      const x1 = Math.max(...inB);
      const px0 = cx + x0 * s;
      const px1 = cx + x1 * s;
      const py = cy + y * s;
      if (!started) {
        path.moveTo(px0, py);
        started = true;
      } else {
        path.lineTo(px1, py);
      }
      path.moveTo(px1, py);
      path.lineTo(px0, py);
    }
    path.closePath();
    this.heartPath = path;
  }

  private coreScale(): number {
    return Math.min(this.w, this.h) * 0.5;
  }

  private scatter(): void {
    const w = this.w;
    const h = this.h;
    if (w === 0 || h === 0) return;
    const cx = w / 2;
    const cy = h * 0.54;
    const s = this.coreScale();
    const count = Math.round((w * h * 42) / (318 * 478)); // ~4200 on host
    this.particles = [];
    let made = 0;
    let guard = 0;
    const shellDepth = this.reduced ? 0.34 : 0.72;
    while (made < count && guard < count * 40) {
      guard++;
      const seedX = this.rand(guard * 3 + 1);
      const seedY = this.rand(guard * 3 + 2);
      const [hx, hy] = this.heartShell(seedX, seedY);
      // depth bias: favour the shell (surface) with a little interior bleed
      const depth = (this.rand(guard + 7) > shellDepth)
        ? (this.rand(guard + 9) - 0.5) * 0.55
        : (this.rand(guard + 11) - 0.5) * 2.1;
      const bulge = 1 + depth * (0.05 + this.rand(guard + 3) * 0.1);
      const baseX = cx + hx * s * bulge;
      const baseY = cy + hy * s * bulge * 0.96;
      this.particles.push({
        baseX,
        baseY,
        orbit: this.rand(guard + 5) * Math.PI * 2,
        orbitSpeed: 0.004 + this.rand(guard + 17) * 0.014,
        phase: this.rand(guard + 23) * Math.PI * 2,
        size: (0.5 + this.rand(guard + 11) * 1.15) * this.dpr,
        alpha: 0.28 + 0.2 * (1 - Math.abs(depth)) + this.rand(guard + 13) * 0.22,
        depth,
      });
      made++;
    }
    this.nucleus = { x: cx, y: cy - s * 0.1, r: s * 0.22 };
  }

  private paintCoreSprite(): void {
    const s = 64;
    const off = document.createElement("canvas");
    off.width = s;
    off.height = s;
    const g = off.getContext("2d");
    if (!g) return;
    const rad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rad.addColorStop(0, "rgba(255, 236, 180, 0.95)");
    rad.addColorStop(0.22, "rgba(255, 196, 110, 0.5)");
    rad.addColorStop(0.55, "rgba(255, 160, 80, 0.16)");
    rad.addColorStop(1, "rgba(255, 150, 60, 0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, s, s);
    this.coreSprite = off;
  }

  // ---- per-frame ------------------------------------------------------------

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
    if (!ctx || this.w === 0 || this.h === 0 || this.particles.length === 0) {
      return;
    }
    const w = this.w;
    const h = this.h;
    const cx = this.nucleus.x;
    const cy = this.nucleus.y;
    const breathe = 1 + Math.sin(this.t * 0.45) * 0.028;
    const drift = this.reduced ? 0 : this.t;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // deep background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#04030a");
    bg.addColorStop(0.5, "#080516");
    bg.addColorStop(1, "#05040c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // soft nebula wash behind the heart
    const neb = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
    neb.addColorStop(0, "rgba(90, 62, 150, 0.10)");
    neb.addColorStop(0.5, "rgba(60, 40, 110, 0.05)");
    neb.addColorStop(1, "rgba(20, 12, 50, 0)");
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, w, h);

    // faint heart silhouette (very subtle, gives the shape body)
    if (this.heartPath) {
      ctx.save();
      ctx.translate(cx - w / 2, cy - h * 0.52);
      ctx.scale(breathe, breathe);
      ctx.fillStyle = "rgba(120, 90, 40, 0.06)";
      ctx.fill(this.heartPath);
      ctx.restore();
    }

    // pointer repulsion wave (local, fades out)
    const px = this.pointer.x >= 0 ? this.pointer.x * w : -1e4;
    const py = this.pointer.y >= 0 ? this.pointer.y * h : -1e4;
    const repelR = Math.min(w, h) * 0.16;

    // particles
    const sprite = this.coreSprite;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      // orbit circulation around the core + slow drift
      const orbit = p.orbit + drift * p.orbitSpeed;
      const ox = Math.cos(orbit) * p.depth * p.depth * p.depth * Math.min(w, h) * 0.1;
      const oy = Math.sin(orbit) * p.depth * Math.min(w, h) * 0.05;
      let x = p.baseX + ox;
      let y = p.baseY + oy;
      const depthFade = 0.72 + (1 - Math.abs(p.depth)) * 0.28;
      // glue strong near the heart silhouette (breathing morphs the outline)
      const pulse = 1 + Math.sin(this.t * 0.45 + p.phase) * 0.05;
      x = p.baseX + (x - p.baseX) * pulse + ox;
      y = p.baseY + (y - p.baseY) * pulse + oy;
      // pointer repulsions
      if (this.pointer.x >= 0) {
        const dx = x - px;
        const dy = y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < repelR * repelR) {
          const d = Math.sqrt(d2) || 0.001;
          const f = (1 - d / repelR);
          const f2 = f * f;
          const wav = Math.sin(this.t * 3.2 + d * 0.03) * 0.5 + 0.5;
          x += (dx / d) * repelR * f2 * 0.5 * (0.4 + wav * 0.6);
          y += (dy / d) * repelR * f2 * 0.5 * (0.4 + wav * 0.6);
        }
      }
      // center weighting: motes nearest the nucleus get a golden sheen
      const dcx = x - cx;
      const dcy = y - cy;
      const dCore = Math.sqrt(dcx * dcx + dcy * dcy);
      const coreGlow = Math.max(0, 1 - dCore / (Math.min(w, h) * 0.34));
      const twinkle = this.reduced ? 0.55 : 0.45 + 0.4 * Math.sin(this.t * 1.9 + p.phase);

      const a = Math.max(0.05, p.alpha * twinkle * (0.55 + coreGlow * 0.65) * depthFade);
      // warm gold with a cool edge for depth
      const warm = Math.min(1, 0.62 + coreGlow * 0.55);
      const r = 255;
      const g = Math.round(205 - (1 - warm) * 70 + coreGlow * 40);
      const b = Math.round(120 + (1 - warm) * 30 + coreGlow * 60);
      ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
      const sz = p.size * (0.8 + coreGlow * 0.5);
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }

    // nucleus glow + bright centre
    if (sprite) {
      const pulse = this.reduced ? 1 : 1 + Math.sin(this.t * 1.1) * 0.07;
      const nr = this.nucleus.r * 3.4 * pulse;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(sprite, cx - nr, cy - nr, nr * 2, nr * 2);
      ctx.globalAlpha = 0.95;
      ctx.drawImage(sprite, cx - nr * 0.5, cy - nr * 0.5, nr, nr);
      // hot centre dot
      ctx.fillStyle = `rgba(255, 246, 220, ${(0.9 * pulse).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) * 0.016, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Signed value of the heart implicit function (0 on the surface). */
function heartF(x: number, y: number): number {
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y;
}

export const starfieldHeartAnimation: VersoAnimationDefinition = {
  id: "starfield_heart",
  create: () => new StarfieldHeartScene(),
};