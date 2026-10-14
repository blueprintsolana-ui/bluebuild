"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useSpring, useTransform, type MotionValue } from "framer-motion";

const PARALLAX_PX = 8;

/** Pointer position as springs from -1 to 1, or still when motion is reduced. */
function usePointerSprings(enabled: boolean) {
  const x = useSpring(0, { stiffness: 40, damping: 18 });
  const y = useSpring(0, { stiffness: 40, damping: 18 });
  useEffect(() => {
    if (!enabled) return;
    const onMove = (event: PointerEvent) => {
      x.set((event.clientX / window.innerWidth) * 2 - 1);
      y.set((event.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [enabled, x, y]);
  return { x, y };
}

/** Runs a looping WAAPI animation that pauses in hidden tabs. */
function useLoop(
  ref: React.RefObject<HTMLElement | SVGElement | null>,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
  enabled: boolean,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const animation = element.animate(keyframes, options);
    const sync = () => (document.visibilityState === "visible" ? animation.play() : animation.pause());
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      animation.cancel();
    };
    // Keyframes and options are static per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ref]);
}

function ParallaxLayer({ depth, pointer, children, className }: { depth: number; pointer: { x: MotionValue<number>; y: MotionValue<number> }; children: ReactNode; className?: string }) {
  const x = useTransform(pointer.x, (value) => value * -PARALLAX_PX * depth);
  const y = useTransform(pointer.y, (value) => value * -PARALLAX_PX * depth);
  return (
    <motion.div className={className} style={{ x, y, position: "absolute", inset: 0 }}>
      {children}
    </motion.div>
  );
}

/**
 * The drafting grid as a fixed background: drifts a few pixels a second and shifts slightly with
 * the pointer. Pass `fragments` on the landing page for faint floating blueprint pieces.
 */
export function LivingGrid({ fragments = false }: { fragments?: boolean }) {
  const reducedMotion = useReducedMotion();
  const animate = !reducedMotion;
  const pointer = usePointerSprings(animate);
  const plane = useRef<HTMLDivElement>(null);
  // One full grid cell (100 px) every 40 s: 2.5 px a second, and the loop is seamless.
  useLoop(plane, [{ transform: "translate(0, 0)" }, { transform: "translate(-100px, -100px)" }], { duration: 40000, iterations: Infinity }, animate);

  return (
    <div aria-hidden="true" className="craft-living-grid">
      <ParallaxLayer depth={1} pointer={pointer}>
        <div ref={plane} className="craft-living-grid__plane craft-grid-lines" />
      </ParallaxLayer>
      {fragments && <FloatingFragments pointer={pointer} animate={animate} />}
    </div>
  );
}

const FRAGMENTS: { depth: number; left: string; top: string; size: number; opacity: number; drift: number; shape: ReactNode }[] = [
  {
    depth: 0.6, left: "6%", top: "18%", size: 120, opacity: 0.07, drift: 28,
    shape: (
      <>
        <circle cx="60" cy="60" r="40" />
        <path d="M60 8v104M8 60h104" strokeDasharray="6 4" />
        <circle cx="60" cy="60" r="4" />
      </>
    ),
  },
  {
    depth: 1.4, left: "82%", top: "30%", size: 150, opacity: 0.06, drift: 36,
    shape: (
      <>
        <path d="M10 75h130" />
        <path d="M10 65v20M140 65v20" />
        <path d="M10 75l10-5v10zM140 75l-10-5v10z" />
        <text x="62" y="62" fontSize="12" fontFamily="IBM Plex Mono, monospace" stroke="none" fill="currentColor">48.0</text>
      </>
    ),
  },
  {
    depth: 2.2, left: "70%", top: "72%", size: 110, opacity: 0.075, drift: 22,
    shape: (
      <>
        <path d="M30 20h50l20 20v50l-20 20H30L10 90V40z" />
        <circle cx="55" cy="65" r="16" />
      </>
    ),
  },
  {
    depth: 1, left: "14%", top: "74%", size: 130, opacity: 0.05, drift: 32,
    shape: (
      <>
        <circle cx="65" cy="65" r="44" strokeDasharray="10 6" />
        <circle cx="65" cy="65" r="26" />
        <path d="M65 21v12M65 97v12M21 65h12M97 65h12" />
      </>
    ),
  },
];

function Fragment({ fragment, animate }: { fragment: (typeof FRAGMENTS)[number]; animate: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useLoop(
    ref,
    [{ transform: "translateY(0px)" }, { transform: `translateY(-${fragment.drift}px)` }],
    { duration: 14000 + fragment.drift * 400, iterations: Infinity, direction: "alternate", easing: "ease-in-out" },
    animate,
  );
  return (
    <svg
      ref={ref}
      className="craft-fragment"
      style={{ left: fragment.left, top: fragment.top, width: fragment.size, height: fragment.size, opacity: fragment.opacity }}
      viewBox={`0 0 ${fragment.size} ${fragment.size}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {fragment.shape}
    </svg>
  );
}

function FloatingFragments({ pointer, animate }: { pointer: { x: MotionValue<number>; y: MotionValue<number> }; animate: boolean }) {
  return (
    <>
      {[0.6, 1, 1.4, 2.2].map((depth) => (
        <ParallaxLayer key={depth} depth={depth} pointer={pointer}>
          {FRAGMENTS.filter((fragment) => fragment.depth === depth).map((fragment) => (
            <Fragment key={`${fragment.left}-${fragment.top}`} fragment={fragment} animate={animate} />
          ))}
        </ParallaxLayer>
      ))}
    </>
  );
}

/** Drafting-software style X/Y readout that follows the pointer (fine pointers only). */
export function CrosshairReadout() {
  const label = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    let latest = { x: 0, y: 0 };
    const render = () => {
      frame = 0;
      if (label.current) {
        label.current.textContent = `X ${String(latest.x).padStart(4, "0")}  Y ${String(latest.y).padStart(4, "0")}`;
      }
    };
    const onMove = (event: PointerEvent) => {
      latest = { x: Math.round(event.pageX), y: Math.round(event.pageY) };
      if (!frame) frame = window.requestAnimationFrame(render);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div ref={label} aria-hidden="true" className="craft-crosshair-readout">
      X 0000  Y 0000
    </div>
  );
}
