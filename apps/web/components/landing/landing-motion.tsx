"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** Smoothstep of v between a and b. */
export const ss = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const pad4 = (n: number) => String(Math.max(0, Math.round(n))).padStart(4, "0");

/** Pointer position (x, y) and its smoothed follower (sx, sy), in viewport pixels. */
export type Pointer = { x: number; y: number; sx: number; sy: number };

export type FrameInfo = {
  now: number;
  vw: number;
  vh: number;
  pointer: Pointer;
  reduced: boolean;
  touch: boolean;
};

type FrameCallback = (frame: FrameInfo) => void;

const FrameContext = createContext<((cb: FrameCallback) => () => void) | null>(null);

/**
 * Every scroll and pointer animation on the landing page runs from one requestAnimationFrame loop,
 * like the design prototype's frame(): sections register a callback and read their own scroll progress.
 */
export function LandingMotion({ children }: { children: ReactNode }) {
  const callbacks = useRef(new Set<FrameCallback>());
  const register = useRef((cb: FrameCallback) => {
    callbacks.current.add(cb);
    return () => {
      callbacks.current.delete(cb);
    };
  });

  useEffect(() => {
    const pointer: Pointer = { x: innerWidth * 0.6, y: innerHeight * 0.5, sx: innerWidth * 0.6, sy: innerHeight * 0.5 };
    const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const touch = matchMedia("(pointer: coarse)").matches;
    const onMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };
    addEventListener("pointermove", onMove, { passive: true });
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      pointer.sx += (pointer.x - pointer.sx) * 0.14;
      pointer.sy += (pointer.y - pointer.sy) * 0.14;
      const frame: FrameInfo = { now, vw: innerWidth, vh: innerHeight, pointer, reduced: reducedQuery.matches, touch };
      callbacks.current.forEach((cb) => {
        try {
          cb(frame);
        } catch (error) {
          console.error(error);
          callbacks.current.delete(cb);
        }
      });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", onMove);
    };
  }, []);

  return <FrameContext.Provider value={register.current}>{children}</FrameContext.Provider>;
}

/** Run `cb` on every animation frame of the landing page (always the latest version of it). */
export function useLandingFrame(cb: FrameCallback) {
  const register = useContext(FrameContext);
  const latest = useRef(cb);
  useEffect(() => {
    latest.current = cb;
  });
  useEffect(() => {
    if (!register) return undefined;
    return register((frame) => latest.current(frame));
  }, [register]);
}

/** Scroll progress through a tall sticky section: 0 when its top reaches the viewport top, 1 at its end. */
export function stickyProgress(el: HTMLElement, vh: number) {
  const rect = el.getBoundingClientRect();
  return { rect, p: clamp(-rect.top / Math.max(1, rect.height - vh)) };
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
