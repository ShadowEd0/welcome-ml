/**
 * "cardioid_echo" — a heart and its rotated echo, geometric family.
 *
 * A cardioid drawn in crisp red is echoed by a dimmer, rotated copy and a
 * fine ring, on the black-mirror base. A hot tracer and a vanishing glow
 * keep it elegant and focused.
 */

import type { MathVersoEntry } from "../../catalog";
import { cardioid, circle } from "../../functions";
import { MathScene } from "../../scene";
import { createBlackMirror } from "../../universes";
import { createVioletFlame } from "../../tracers/violetFlame";
import { createFadingLine } from "../../trails/fadingLine";
import { createVanishingGlow } from "../../trails/vanishingGlow";
import { makeLayer, compose } from "./helpers";

export function createCardioidEcho(): MathScene {
  return new MathScene({
    id: "cardioid_echo",
    composition: compose([
      makeLayer(cardioid(), "#ff6b6b", {
        lineWidth: 1.8,
        glow: 1.6,
        tracer: createVioletFlame(0, { x: 0, y: 0 }, { size: 0.06 }),
        trail: createVanishingGlow("#ff6b6b", { capacity: 40, baseOpacity: 0.5 }),
      }),
      makeLayer(cardioid(), "#ff9d9d", {
        transform: { rotation: Math.PI },
        lineWidth: 1.1,
        glow: 0.8,
        trail: createFadingLine("#ff9d9d", { capacity: 40, baseOpacity: 0.35, width: 1 }),
      }),
      makeLayer(circle(1.5), "#d8c8ff", {
        lineWidth: 1.1,
        glow: 0.6,
      }),
    ]),
    universe: createBlackMirror(),
    tracerSpeed: 0.3,
    tracerLoops: true,
  });
}

export const cardioidEcho: MathVersoEntry = {
  id: "cardioid_echo",
  name: "Écho de cardioïde",
  family: "geometric",
  description: "Cardioïde et son reflet tourné sur black_mirror.",
  create: createCardioidEcho,
};
