import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

// ---------------------------------------------------------------------------
// "Respiration" (breath_text) — a text verso where the message has a calm,
// living presence: a luminous breathing, almost imperceptible.
//
// Technology: DOM + CSS (no RAF). The text appears softly (blur → sharp,
// gentle settle), then breathes: a very slow, subtle scale + glow cycle.
// Inactive → CSS animation paused. Reduced-motion → animations killed, the
// final static composition is shown (fully readable, warm glow). destroy
// removes every node it created (style + text), zero listeners.
// ---------------------------------------------------------------------------

// ---- palette (deep violet twilight, warm ivory text) ----
const BG_TOP = "#1a1330";
const BG_MID = "#120b20";
const BG_DEEP = "#08060f";
const TEXT_COLOR = "#f4e6c8";
const GLOW_A = "255, 214, 150";
const GLOW_B = "214, 150, 90";

const FONT_FAMILY = "\"Cormorant Garamond\", Georgia, serif";
const LINE_HEIGHT = 1.28;
const AVAIL_W = 0.84;
const AVAIL_H = 0.6;

const STYLE_CSS = `
.bt-root{position:absolute; left:0; top:0; width:100%; height:100%; display:flex;
  align-items:center; justify-content:center; overflow:hidden;
  background:linear-gradient(180deg, ${BG_TOP} 0%, ${BG_MID} 55%, ${BG_DEEP} 100%);}
.bt-root::after{content:""; position:absolute; inset:0;
  background:radial-gradient(ellipse at center, rgba(20,15,40,0)
    0%, rgba(16,11,32,0.10) 55%, rgba(8,6,16,0.38) 100%);}
.bt-stage{display:flex; align-items:center; justify-content:center;
  animation: bt-breathe 7.5s ease-in-out 1.6s infinite,
             bt-glow 7.5s ease-in-out 1.6s infinite;}
.bt-text{color:${TEXT_COLOR}; font-family:${FONT_FAMILY}; text-align:center;
  line-height:${LINE_HEIGHT}; overflow-wrap:anywhere;
  animation: bt-in 2.1s ease-out both;}
@keyframes bt-in{0%{opacity:0; filter:blur(4px); transform:translateY(8px) scale(0.96);}
  55%{opacity:1; filter:blur(0); transform:translateY(0) scale(1.012);}
  100%{opacity:1; filter:blur(0); transform:none;}}
@keyframes bt-breathe{0%,100%{transform:none;}
  18%{transform:scale(1.012);} 34%{transform:scale(1.003);}
  54%{transform:scale(1.009);} 72%{transform:scale(1);}}
@keyframes bt-glow{0%,100%{text-shadow:0 0 0 rgba(${GLOW_A},0);}
  20%{text-shadow:0 0 7px rgba(${GLOW_A},0.28), 0 0 14px rgba(${GLOW_B},0.12);}
  40%{text-shadow:0 0 2px rgba(${GLOW_A},0.10);}
  60%{text-shadow:0 0 6px rgba(${GLOW_A},0.22), 0 0 12px rgba(${GLOW_B},0.10);}
  80%{text-shadow:0 0 1px rgba(${GLOW_A},0.06);}}
.bt-root.bt-paused .bt-stage, .bt-root.bt-paused .bt-text{animation-play-state:paused;}
.bt-root.bt-reduced .bt-stage, .bt-root.bt-reduced .bt-text{animation:none;}
@media (prefers-reduced-motion: reduce){
  .bt-root .bt-stage, .bt-root .bt-text{animation:none;}
  .bt-root .bt-text{filter:none; transform:none; opacity:1;}}
`;
class BreathTextScene implements VersoScene {
  readonly id = "breath_text";

  private host: HTMLElement | null = null;
  private root: HTMLDivElement | null = null;
  private textEl: HTMLDivElement | null = null;

  private reduced = false;
  private message = "";

  // ---- mount / resize -----------------------------------------------------

  mount({ host, message }: VersoSceneContext): void {
    this.host = host;
    this.message = (message ?? "").trim() || "…";

    const root = document.createElement("div");
    root.className = "bt-root";
    const styleEl = document.createElement("style");
    styleEl.textContent = STYLE_CSS;
    const stage = document.createElement("div");
    stage.className = "bt-stage";
    const text = document.createElement("div");
    text.className = "bt-text";
    text.textContent = this.message;
    text.setAttribute("aria-hidden", "true");

    stage.appendChild(text);
    root.appendChild(styleEl);
    root.appendChild(stage);
    host.appendChild(root);

    this.root = root;
    this.textEl = text;

    this.resize();
    if (this.reduced) this.renderStatic();
  }

  resize(): void {
    const host = this.host;
    const text = this.textEl;
    if (!host || !text) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;
    this.fitText(w, h);
  }

  /** Pure CSS fit: shrink the font until the wrapped block fits the area. */
  private fitText(w: number, h: number): void {
    const text = this.textEl;
    if (!text) return;
    const availW = Math.max(24, w * AVAIL_W);
    const availH = Math.max(24, h * AVAIL_H);
    let fs = Math.min(88, availH * 0.4, availW * 0.2);
    text.style.width = `${availW}px`;
    text.style.fontSize = `${fs}px`;
    for (let i = 0; i < 28 && text.scrollHeight > availH; i++) {
      fs *= 0.86;
      text.style.fontSize = `${Math.max(12, fs)}px`;
    }
  }
// ---- lifecycle ----------------------------------------------------------

  setActive(active: boolean): void {
    const root = this.root;
    if (!root) return;
    if (active) {
      root.classList.remove("bt-paused");
      this.restartEntrance();
      if (this.reduced) this.renderStatic();
    } else {
      root.classList.add("bt-paused");
    }
  }

  setReducedMotion(reduced: boolean): void {
    if (this.reduced === reduced) return;
    this.reduced = reduced;
    if (this.reduced) this.renderStatic();
  }

  destroy(): void {
    this.root?.remove();
    this.root = null;
    this.textEl = null;
    this.host = null;
  }

  // ---- internals ----------------------------------------------------------

  /** Re-triggers the entrance animation (idempotent, cheap). */
  private restartEntrance(): void {
    const text = this.textEl;
    if (!text) return;
    // clear any static (reduced) inline styles so CSS animations resume
    text.style.animation = "none";
    text.style.filter = "";
    text.style.transform = "";
    text.style.opacity = "";
    void text.offsetWidth; // force reflow so the animation restarts
    text.style.animation = "";
  }

  /** Reduced-motion/first static frame: the settled composition, no loop. */
  private renderStatic(): void {
    const text = this.textEl;
    if (text) {
      text.style.animation = "none";
      text.style.filter = "none";
      text.style.transform = "none";
      text.style.opacity = "1";
    }
  }
}

export const breathTextAnimation: VersoAnimationDefinition = {
  id: "breath_text",
  create: () => new BreathTextScene(),
};