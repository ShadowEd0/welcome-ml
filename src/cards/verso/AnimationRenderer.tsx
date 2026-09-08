import { useEffect, useRef } from "react";
import type { VersoAnimationId, VersoScene } from "./types";
import { createVersoScene } from "./registry";

interface VersoAnimationRendererProps {
  /** Back-face animation id (CardConfig.verso). Resolved from the registry. */
  animationId: VersoAnimationId | undefined;
  /** True while the back face is shown: the scene runs; otherwise it pauses. */
  active: boolean;
  /** Optional message text for text-based verso animations. */
  message?: string;
}

/**
 * Resolves a verso animation from the registry and mounts it in its own DOM
 * host. Owns the scene lifecycle:
 *
 *   mount  → create the scene, fill the host, hook prefers-reduced-motion
 *   active → scene.setActive(flip state)
 *   resize → ResizeObserver → scene.resize()
 *   end    → disconnect observer, unlisten media query, scene.destroy()
 *
 * The component itself knows nothing about Canvas, SVG or DOM inside the
 * scene: it only guarantees the host element and the lifecycle calls.
 */
export function VersoAnimationRenderer({ animationId, active, message }: VersoAnimationRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<VersoScene | null>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = createVersoScene(animationId);
    if (!scene) return;

    sceneRef.current = scene;
    scene.mount({ host, message });

    // Deliver resize() only when the host actually has a measurable size.
    // The verso becomes measurable after mount in the viewer flow, but when
    // the host measures 0x0 here (layout pending / initially hidden), we
    // retry once after the next frame instead of pushing a useless resize.
    const applyResize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width > 0 && height > 0) scene.resize();
    };
    applyResize();
    const firstSizeRetry =
      host.clientWidth === 0 || host.clientHeight === 0
        ? requestAnimationFrame(applyResize)
        : -1;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const applyReduced = (value: boolean) => scene.setReducedMotion(value);
    applyReduced(reduced);

    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const handleMediaChange = (event: MediaQueryListEvent) => applyReduced(event.matches);
    media?.addEventListener("change", handleMediaChange);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => applyResize());
      resizeObserver.observe(host);
    }

    if (activeRef.current) scene.setActive(true);

    return () => {
      if (firstSizeRetry !== -1) cancelAnimationFrame(firstSizeRetry);
      media?.removeEventListener("change", handleMediaChange);
      resizeObserver?.disconnect();
      scene.destroy();
      sceneRef.current = null;
    };
  }, [animationId]);

  useEffect(() => {
    activeRef.current = active;
    sceneRef.current?.setActive(active);
  }, [active]);

  if (!animationId) return null;

  return <div ref={hostRef} className="verso-scene-host" aria-hidden="true" />;
}