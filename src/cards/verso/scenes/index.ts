import { registerVersoAnimation } from "../registry";
import { MATH_VERSO_CATALOGUE } from "../math/catalog";
import { toDefinition } from "../math/catalog";
import { inkTextAnimation } from "./inkText";
import { lightTextAnimation } from "./lightText";
import { breathTextAnimation } from "./breathText";
import { floatTextAnimation } from "./floatText";
import { revealTextAnimation } from "./revealText";
import { liquidTextAnimation } from "./liquidText";
import { morphTextAnimation } from "./morphText";

// Registration happens at module load, before any renderer resolves ids.

// 1) The 7 text animations (universe text side of the cards) stay active.
registerVersoAnimation(inkTextAnimation);
registerVersoAnimation(lightTextAnimation);
registerVersoAnimation(breathTextAnimation);
registerVersoAnimation(floatTextAnimation);
registerVersoAnimation(revealTextAnimation);
registerVersoAnimation(liquidTextAnimation);
registerVersoAnimation(morphTextAnimation);

// 2) The mathematical verso catalogue (M25) — one registration per entry.
//    The catalogue is the source of truth for ids used by cards.json and
//    add_card.py; demos from earlier missions are intentionally NOT here.
for (const entry of MATH_VERSO_CATALOGUE) {
  registerVersoAnimation(toDefinition(entry));
}
