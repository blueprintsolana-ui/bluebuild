"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type LightboxImage = { src: string; label: string };

type ImageLightboxProps = {
  images: LightboxImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

/** Full-screen image viewer with arrow buttons, arrow keys, swipe and Escape to close. */
export default function ImageLightbox({ images, index, onIndexChange, onClose }: ImageLightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);
  const count = images.length;
  const image = images[index];

  const step = useCallback(
    (delta: number) => {
      if (count > 1) onIndexChange((index + delta + count) % count);
    },
    [count, index, onIndexChange],
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  if (!image || typeof document === "undefined") return null;

  const navButton =
    "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${image.label} (${index + 1} of ${count})`}
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        const end = event.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start != null && end != null && Math.abs(end - start) > 50) step(end < start ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white" onClick={(event) => event.stopPropagation()}>
        <div className="min-w-0 truncate text-sm font-medium">
          {image.label}
          {count > 1 && <span className="ml-2 text-white/60">{index + 1} / {count}</span>}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-16">
        {/* eslint-disable-next-line @next/next/no-img-element -- full-size data URLs and signed storage URLs */}
        <img
          src={image.src}
          alt={image.label}
          onClick={(event) => event.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={(event) => {
                event.stopPropagation();
                step(-1);
              }}
              className={`${navButton} left-2 sm:left-4`}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={(event) => {
                event.stopPropagation();
                step(1);
              }}
              className={`${navButton} right-2 sm:right-4`}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
