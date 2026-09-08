/**
 * "gabor_ripple" — Gabor wavelet ripple, parametric family.
 *
 * A ring from the Gabor wavelet G(φ)=exp(−(φ−φ0)²/(2σ²))·cos(ω·φ) laid on
 * a polar radius r=R0+A·G(φ): one direction carries the wave, the other
 * falls quietly away, like ripples meeting the shore. Two offset ripples
 * cross calmly on a calm_hour tide.
 */

import type { MathVersoEntry } from "../../catalog";
import type { CurveSpec } from "../../types";
import { MathScene } from "../../scene";
import { createGoldenHour } from "../../universes";
import { createCometSpark } from "../../tracers/cometSpark";
import { createFadingLine } from "../../trails/fadingLine";
import { createVanishingGlow } from "../../trails/vanishingGlow";
import { makeLayer, compose } from "./helpers";

const GOLD = "#ffd28f";
const PEACH = "#ffb37f";

function gaborRing(R0: number, A: number, phi0: number, sigma: number, omega: number): CurveSpec {
  return {
    id: "gabor_ripple",
    fn: (t) => {
      const d = Math.min(Math.abs(t - phi0), 2 * Math.PI - Math.abs(t - phi0));
      const w = Math.exp(-(d * d) / (2 * sigma * sigma));
      const r = Math.max(0.02, R0 + A * w * Math.cos(omega * t));
      return {
        x: r * Math.cos(t),
        y: r * Math.sin(t),
      };
    },
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: "Onde de Gabor en anneau.",
  };
}

export function createGaborRipple(): MathScene {
  return new MathScene({
    id: "gabor_ripple",
    composition: compose([
      makeLayer(gaborRing(0.34, 0.5, Math.PI, 2.1, 14), GOLD, {
        lineWidth: 1.5,
        glow: 1.3,
        count: 900,
        tracer: createCometSpark(0, { x: 0.3, y: 0 }, { size: 0.05 }),
        trail: createFadingLine(GOLD, { capacity: 100, baseOpacity: 0.4, width: 1.3 }),
      }),
      makeLayer(gaborRing(0.34, 0.44, 0, 2.6, 10), PEACH, {
        transform: { rotation: Math.PI / 2 },
        lineWidth: 1,
        glow: 0.8,
        count: 900,
        trail: createVanishingGlow(PEACH, { capacity: 70, baseOpacity: 0.35, widthWorld: 0.12 }),
      }),
    ]),
    universe: createGoldenHour(),
    tracerSpeed: 0.32,
    tracerLoops: true,
  });
}

export const gaborRipple: MathVersoEntry = {
  id: "gabor_ripple",
  name: "Ondulation de Gabor",
  family: "parametric",
  description: "Ondelette de Gabor en anneaux croisés sur golden_hour.",
  create: createGaborRipple,
};