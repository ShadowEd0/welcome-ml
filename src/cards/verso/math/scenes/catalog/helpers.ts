/**
 * Math Verso Engine — catalogue authoring helpers.
 *
 * Small, dependency-light helpers so each verso stays declarative and
 * readable instead of repeating sampling/import boilerplate.
 */

import type { CurveLayer, MathComposition, Tracer, Trail, Transform2D } from "../../types";
import type { CurveSpec } from "../../types";
import { sampleCurve } from "../../sampling";

/**
 * Sample a CurveSpec into a CurveLayer, optionally transformed and styled.
 * `count` defaults to a value that keeps precomputation cheap while staying
 * visually smooth for closed curves.
 */
export function makeLayer(
  spec: CurveSpec,
  color: string,
  opts: {
    transform?: Transform2D;
    lineWidth?: number;
    glow?: number;
    tracer?: Tracer;
    trail?: Trail;
    count?: number;
  } = {}
): CurveLayer {
  const curve = sampleCurve(
    spec.fn,
    { domain: spec.domain, count: opts.count ?? 360 },
    spec.closed
  );
  return {
    id: spec.id,
    curve,
    color,
    lineWidth: opts.lineWidth ?? 1.3,
    glow: opts.glow ?? 1,
    transform: opts.transform,
    tracer: opts.tracer,
    trail: opts.trail,
  };
}

/** Build a composition from a list of layers. */
export function compose(layers: CurveLayer[]): MathComposition {
  return { layers };
}
