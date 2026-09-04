import React, { useState } from "react";
import { FALLBACK_CARD_IMAGE } from "./validateCard";

interface ImageWithFallbackProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> {
  src: string;
  alt: string;
  /** "eager" for the small number of cards that must appear instantly (e.g. the open viewer). */
  loading?: "lazy" | "eager";
}

/**
 * Wraps <img> with native lazy-loading and a graceful placeholder fallback.
 * Never throws; a broken/missing image simply swaps to the placeholder.
 */
export function ImageWithFallback({
  src,
  alt,
  loading = "lazy",
  className,
  ...rest
}: ImageWithFallbackProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [failed, setFailed] = useState(false);

  return (
    <img
      {...rest}
      src={currentSrc}
      alt={alt}
      loading={loading}
      decoding="async"
      className={[className, failed ? "card-image--fallback" : undefined]
        .filter(Boolean)
        .join(" ")}
      onError={() => {
        if (!failed) {
          setFailed(true);
          setCurrentSrc(FALLBACK_CARD_IMAGE);
        }
      }}
    />
  );
}
