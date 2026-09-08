/**
 * Math Verso Engine — public barrel.
 *
 * Consumers import from here. The barrel re-exports the types and the
 * building blocks needed to compose new mathematical versos.
 */

export * from "./types";
export { createCoordinateSystem, drawFrame } from "./coordinates";
export type { CoordinateSystem } from "./coordinates";
export { sample, sampleCurve, estimateClosed } from "./sampling";
export type { CurveSpec, MathFunction, TDomain } from "./types";
export { rose, lissajous, cardioid, lemniscate, spiral, circle } from "./functions";
export {
  sineWave,
  cosineWave,
  dampedWave,
  gaussian,
  clover,
  petal,
  limacon,
  ellipse,
  heart,
  hypotrochoid,
  epitrochoid,
  butterfly,
  infinity,
} from "./functions";
export { CurveTracer, wrapT, clampT } from "./tracer";
export { FadingPolylineTrail, NoTrail } from "./trail";
export { GradientUniverse, TransparentUniverse } from "./universe";
export {
  createMidnightObservatory,
  createVioletDream,
  createDeepOcean,
  createEmeraldGarden,
  createMoonlitPaper,
  createCosmicPlum,
  createGoldenHour,
  createArcticSilence,
  createRoseCosmos,
  createBlackMirror,
} from "./universes";
export {
  createLuminousPointTracer,
  createGoldenSeedTracer,
  createCometSpark,
  createCrystalDrop,
  createFirefly,
  createMoonPearl,
  createVioletFlame,
  createOrbitingMote,
  createPrismShard,
  createRoseSpark,
  createTracer,
  TRACER_FACTORIES,
} from "./tracers";
export type { TracerKind } from "./tracers";
export {
  createFadingLine,
  createGoldenDust,
  createSilkRibbon,
  createInkTrace,
  createLightEcho,
  createSparkFragment,
  createMistTrail,
  createCrystalTrace,
  createOrbitTrace,
  createVanishingGlow,
  createTrail,
  TRAIL_FACTORIES,
  listTrailIds,
} from "./trails";
export type { TrailKind } from "./trails";
export { MathEngine } from "./engine";
export { MathScene } from "./scene";
export { roseGardenAnimation } from "./scenes/roseGarden";
export {
  m24RoseRotationAnimation,
  m24RoseCircleAnimation,
  m24LissajousEllipseAnimation,
  m24HeartOrbitAnimation,
  m24SpiralCircleWaveAnimation,
  createRoseRotationDemo,
} from "./scenes/m24CompositionDemo";
