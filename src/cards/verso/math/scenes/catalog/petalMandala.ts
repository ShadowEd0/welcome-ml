/**
 * "petal_mandala" — a rotating crown of petals, floral family.
 *
 * The same petal curve (k=7) is composed in four angular positions to build
 * a soft, radial mandala. Warm rose/magenta on a rose-cosmos backdrop, with
 * a single luminous tracer and a mirroring silk trail on each layer.
 */

import type { MathVersoEntry } from "../../catalog";
import { petal } from "../../functions";
import { MathScene } from "../../scene";
import { createRoseCosmos } from "../../universes";
import { createLuminousPointTracer } from "../../tracers/luminousPoint";
import { createRoseSpark } from "../../tracers/roseSpark";
import { createSilkRibbon } from "../../trails/silkRibbon";
import { createFadingLine } from "../../trails/fadingLine";
import { makeLayer, compose } from "./helpers";

const ROSE = "#ffb3c8";
const MAGENTA = "#e085c4";

export function createPetalMandala(): MathScene {
  const base = petal(7, 0.95);
  const layers = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].map((rot, i) => {
    const warm = i % 2 === 0;
    const color = warm ? ROSE : MAGENTA;
    return makeLayer(base, color, {
      transform: { rotation: rot },
      lineWidth: i === 0 ? 1.6 : 1.1,
      glow: 1.2,
      tracer: warm
        ? createLuminousPointTracer(0, { x: 0, y: 0 }, { size: 0.05, color })
        : createRoseSpark(0, { x: 0, y: 0 }, { size: 0.05 }),
      trail: warm
        ? createSilkRibbon(color, { capacity: 55, baseOpacity: 0.45 })
        : createFadingLine(color, { capacity: 50, baseOpacity: 0.4, width: 1.1 }),
    });
  });

  return new MathScene({
    id: "petal_mandala",
    composition: compose(layers),
    universe: createRoseCosmos(),
    tracerSpeed: 0.22,
    tracerLoops: true,
  });
}

export const petalMandala: MathVersoEntry = {
  id: "petal_mandala",
  name: "Pétale mandala",
  family: "floral",
  description: "Couronne radiale de pétales tournés, roses et magenta sur rose_cosmos.",
  create: createPetalMandala,
};
