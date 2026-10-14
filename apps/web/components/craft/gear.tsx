"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";

import { gearPath, placeGears, round, type GearMode, type GearSpec, type PlacedGear } from "../../lib/gear-math";

export { gearPath, placeGears, type GearMode, type GearSpec } from "../../lib/gear-math";

/** Line-art gears that mesh for real; the geometry lives in lib/gear-math.ts. */

export type GearTrainHandle = {
  /** Speed every gear up by `rate` for `ms`, keeping them meshed. */
  spin: (rate?: number, ms?: number) => void;
  /** Click the whole train forward by one tooth, with a small settle bounce. */
  advance: () => void;
};

type GearTrainProps = {
  gears: GearSpec[];
  /** Pitch-circle size of one tooth in SVG units (pitch radius = module * teeth / 2). */
  module?: number;
  /** Seconds for the first gear to turn once in "spin" mode. */
  period?: number;
  /** 1 = first gear turns clockwise, -1 = anticlockwise. */
  direction?: 1 | -1;
  mode?: GearMode;
  color?: string;
  strokeWidth?: number;
  /** Degrees of rotation per pixel scrolled, for the first gear, in "scroll" mode. */
  scrollRatio?: number;
  className?: string;
  title?: string;
};

function GearShape({ gear, color, strokeWidth }: { gear: PlacedGear; color: string; strokeWidth: number }) {
  const stroke = gear.color || color;
  const holes = gear.teeth >= 18 ? 5 : gear.teeth >= 12 ? 3 : 0;
  return (
    <>
      <path d={gearPath(gear.teeth, gear.pitchRadius)} fill={gear.fill || "none"} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <circle r={gear.pitchRadius * 0.3} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
      <circle r={Math.max(gear.pitchRadius * 0.1, 2)} fill="none" stroke={stroke} strokeWidth={strokeWidth} />
      {Array.from({ length: holes }, (_, hole) => {
        const angle = (hole / holes) * Math.PI * 2;
        const distance = gear.pitchRadius * 0.6;
        return (
          <circle
            key={hole}
            cx={round(distance * Math.cos(angle))}
            cy={round(distance * Math.sin(angle))}
            r={round(gear.pitchRadius * (holes === 5 ? 0.14 : 0.12))}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );
      })}
    </>
  );
}

export const GearTrain = forwardRef<GearTrainHandle, GearTrainProps>(function GearTrain(
  {
    gears,
    module: toothModule = 6,
    period = 40,
    direction = 1,
    mode = "spin",
    color = "var(--craft-ink)",
    strokeWidth = 1.5,
    scrollRatio = 0.12,
    className,
    title,
  },
  ref,
) {
  const reducedMotion = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const gearRefs = useRef<(SVGGElement | null)[]>([]);
  const animations = useRef<Animation[]>([]);
  const angles = useRef<number[]>([]);
  const spinTimer = useRef<number | null>(null);

  const layout = useMemo(() => {
    const placed = placeGears(gears, toothModule, direction);
    const pad = strokeWidth * 2 + 2;
    const minX = Math.min(...placed.map((gear) => gear.cx - gear.outerRadius)) - pad;
    const minY = Math.min(...placed.map((gear) => gear.cy - gear.outerRadius)) - pad;
    const maxX = Math.max(...placed.map((gear) => gear.cx + gear.outerRadius)) + pad;
    const maxY = Math.max(...placed.map((gear) => gear.cy + gear.outerRadius)) + pad;
    // Shift into positive space so transform origins can be given in viewBox pixels.
    const shifted = placed.map((gear) => ({ ...gear, cx: round(gear.cx - minX), cy: round(gear.cy - minY) }));
    return { gears: shifted, width: round(maxX - minX), height: round(maxY - minY) };
  }, [direction, gears, toothModule, strokeWidth]);

  const rotationAt = (gear: PlacedGear, firstGearDegrees: number) =>
    gear.phase + gear.direction * firstGearDegrees * gear.speedRatio;

  useEffect(() => {
    const elements = gearRefs.current;
    angles.current = layout.gears.map(() => 0);
    elements.forEach((element, index) => {
      if (element) element.style.transform = `rotate(${layout.gears[index].phase}deg)`;
    });
    if (reducedMotion || mode === "still" || mode === "step") return;

    let cleanup: () => void = () => undefined;
    if (mode === "scroll") {
      let frame = 0;
      const update = () => {
        frame = 0;
        const degrees = window.scrollY * scrollRatio;
        elements.forEach((element, index) => {
          if (element) element.style.transform = `rotate(${rotationAt(layout.gears[index], degrees)}deg)`;
        });
      };
      const onScroll = () => {
        if (!frame) frame = window.requestAnimationFrame(update);
      };
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanup = () => {
        window.removeEventListener("scroll", onScroll);
        if (frame) window.cancelAnimationFrame(frame);
      };
    } else {
      animations.current = elements.flatMap((element, index) => {
        if (!element) return [];
        const gear = layout.gears[index];
        if (mode === "wobble") {
          return [element.animate(
            [
              { transform: `rotate(${gear.phase - 6}deg)` },
              { transform: `rotate(${gear.phase + 6}deg)` },
            ],
            { duration: 2400, iterations: Infinity, direction: "alternate", easing: "ease-in-out" },
          )];
        }
        return [element.animate(
          [
            { transform: `rotate(${gear.phase}deg)` },
            { transform: `rotate(${gear.phase + gear.direction * 360}deg)` },
          ],
          // Same start time for every gear, durations in tooth ratio: they stay meshed forever.
          { duration: (period * 1000) / gear.speedRatio, iterations: Infinity, easing: "linear" },
        )];
      });
      const svg = svgRef.current;
      let onScreen = true;
      const sync = () => {
        const run = onScreen && document.visibilityState === "visible";
        animations.current.forEach((animation) => (run ? animation.play() : animation.pause()));
      };
      const observer = svg
        ? new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            sync();
          })
        : null;
      if (svg && observer) observer.observe(svg);
      document.addEventListener("visibilitychange", sync);
      cleanup = () => {
        observer?.disconnect();
        document.removeEventListener("visibilitychange", sync);
        animations.current.forEach((animation) => animation.cancel());
        animations.current = [];
      };
    }
    return () => {
      cleanup();
      if (spinTimer.current) window.clearTimeout(spinTimer.current);
    };
  }, [layout, mode, period, reducedMotion, scrollRatio]);

  useImperativeHandle(ref, () => ({
    spin(rate = 5, ms = 900) {
      if (reducedMotion || mode !== "spin") return;
      animations.current.forEach((animation) => animation.updatePlaybackRate(rate));
      if (spinTimer.current) window.clearTimeout(spinTimer.current);
      spinTimer.current = window.setTimeout(() => {
        animations.current.forEach((animation) => animation.updatePlaybackRate(1));
      }, ms);
    },
    advance() {
      const firstGearTooth = 360 / layout.gears[0].teeth;
      gearRefs.current.forEach((element, index) => {
        if (!element) return;
        const gear = layout.gears[index];
        const from = rotationAt(gear, angles.current[index]);
        angles.current[index] += firstGearTooth;
        const to = rotationAt(gear, angles.current[index]);
        element.style.transform = `rotate(${to}deg)`;
        if (reducedMotion) return;
        element.animate([{ transform: `rotate(${from}deg)` }, { transform: `rotate(${to}deg)` }], {
          duration: 320,
          easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        });
      });
    },
  }));

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {layout.gears.map((gear, index) => (
        <g
          key={index}
          ref={(element) => {
            gearRefs.current[index] = element;
          }}
          style={{ transformBox: "view-box", transformOrigin: `${gear.cx}px ${gear.cy}px`, transform: `rotate(${gear.phase}deg)` }}
        >
          <g transform={`translate(${gear.cx} ${gear.cy})`}>
            <GearShape gear={gear} color={color} strokeWidth={strokeWidth} />
          </g>
        </g>
      ))}
    </svg>
  );
});

type GearProps = {
  teeth?: number;
  /** Pitch radius in SVG units. */
  radius?: number;
  /** Seconds per turn. */
  speed?: number;
  direction?: 1 | -1;
  color?: string;
  mode?: GearMode;
  strokeWidth?: number;
  className?: string;
  title?: string;
};

/** A single gear: decorative spinner, scroll-linked dial, or an idle wobble for empty states. */
export const Gear = forwardRef<GearTrainHandle, GearProps>(function Gear(
  { teeth = 16, radius = 24, speed = 30, direction = 1, color, mode = "spin", strokeWidth, className, title },
  ref,
) {
  const gears = useMemo(() => [{ teeth }], [teeth]);
  return (
    <GearTrain
      ref={ref}
      gears={gears}
      module={(radius * 2) / teeth}
      period={speed}
      direction={direction}
      color={color}
      mode={mode}
      strokeWidth={strokeWidth}
      className={className}
      title={title}
    />
  );
});
