import type { ReactNode } from "react";

/**
 * Maker icons in the lucide line style (24 px grid, round caps). Every stroke has pathLength 1
 * so `.craft-icon` can redraw it on hover of a `.craft-draw-host` parent.
 */
export type MakerIconName =
  | "gear"
  | "caliper"
  | "bolt"
  | "chip"
  | "battery"
  | "screen"
  | "solder"
  | "rocket"
  | "pencil"
  | "sheet"
  | "shield"
  | "search"
  | "wire"
  | "cube"
  | "box"
  | "camera";

const SHAPES: Record<MakerIconName, ReactNode> = {
  gear: (
    <>
      <path pathLength={1} d="M12 2.5l1.4 2.4 2.7-.6.5 2.7 2.6 1-1 2.6 1.9 2-2.1 1.8.7 2.7-2.7.5-.8 2.6-2.6-.9L12 21.5l-1.9-2.2-2.6.9-.8-2.6-2.7-.5.7-2.7-2.1-1.8 1.9-2-1-2.6 2.6-1 .5-2.7 2.7.6z" />
      <circle pathLength={1} cx="12" cy="12" r="3.5" />
    </>
  ),
  caliper: (
    <>
      <path pathLength={1} d="M3 5h18v4H3z" />
      <path pathLength={1} d="M5 9v10l3-4V9" />
      <path pathLength={1} d="M14 9v6l3 4V9" />
      <path pathLength={1} d="M8 7h1M11 7h1M14 7h1M17 7h1" />
    </>
  ),
  bolt: (
    <>
      <path pathLength={1} d="M8 3h8l2 3.5-2 3.5H8L6 6.5z" />
      <path pathLength={1} d="M10 10v11h4V10" />
      <path pathLength={1} d="M10 13l4-1M10 16l4-1M10 19l4-1" />
    </>
  ),
  chip: (
    <>
      <rect pathLength={1} x="6" y="6" width="12" height="12" rx="1.5" />
      <rect pathLength={1} x="9.5" y="9.5" width="5" height="5" />
      <path pathLength={1} d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>
  ),
  battery: (
    <>
      <rect pathLength={1} x="2.5" y="7" width="17" height="10" rx="2" />
      <path pathLength={1} d="M19.5 10.5h2v3h-2" />
      <path pathLength={1} d="M7 12h4M9 10v4" />
    </>
  ),
  screen: (
    <>
      <rect pathLength={1} x="3" y="4" width="18" height="13" rx="1.5" />
      <path pathLength={1} d="M9 21h6M12 17v4" />
      <path pathLength={1} d="M7 13l3-3 2 2 4-4" />
    </>
  ),
  rocket: (
    <>
      <path pathLength={1} d="M12 2.5c3 2 4.5 5.5 4.5 9.5l-2 4h-5l-2-4c0-4 1.5-7.5 4.5-9.5z" />
      <circle pathLength={1} cx="12" cy="9.5" r="1.8" />
      <path pathLength={1} d="M7.5 12l-3 3 1 3.5 3-2M16.5 12l3 3-1 3.5-3-2M10.5 18.5l1.5 3 1.5-3" />
    </>
  ),
  pencil: (
    <>
      <path pathLength={1} d="M4 20l1.2-4.6L16 4.6a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" />
      <path pathLength={1} d="M14 6.5l3.5 3.5M5.2 15.4l3.4 3.4" />
    </>
  ),
  sheet: (
    <>
      <path pathLength={1} d="M6 2.5h8.5l4 4v15H6z" />
      <path pathLength={1} d="M14.5 2.5v4h4M9 11h6M9 14.5h6M9 18h4" />
    </>
  ),
  solder: (
    <>
      <path pathLength={1} d="M3 21l5-5" />
      <path pathLength={1} d="M8 16l2-2 6 .5L21.5 9 15 2.5 9.5 8l.5 6" />
      <path pathLength={1} d="M14 6l4 4" />
    </>
  ),
  shield: (
    <>
      <path pathLength={1} d="M12 2.5l7.5 3v6c0 4.6-3.2 8.3-7.5 10-4.3-1.7-7.5-5.4-7.5-10v-6z" />
      <path pathLength={1} d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  search: (
    <>
      <circle pathLength={1} cx="10.5" cy="10.5" r="6.5" />
      <path pathLength={1} d="M15.3 15.3l5.2 5.2" />
    </>
  ),
  wire: (
    <>
      <circle pathLength={1} cx="4.5" cy="6" r="2" />
      <circle pathLength={1} cx="19.5" cy="18" r="2" />
      <path pathLength={1} d="M6.5 6h5v12h6" />
      <path pathLength={1} d="M11.5 10h4" />
    </>
  ),
  cube: (
    <>
      <path pathLength={1} d="M12 2.5l8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5z" />
      <path pathLength={1} d="M3.5 7.25L12 12l8.5-4.75M12 12v9.5" />
    </>
  ),
  box: (
    <>
      <path pathLength={1} d="M3.5 8h17v12.5h-17z" />
      <path pathLength={1} d="M2.5 4h19v4h-19z" />
      <path pathLength={1} d="M10 12h4" />
    </>
  ),
  camera: (
    <>
      <path pathLength={1} d="M3 7.5h4l1.8-2.5h6.4L17 7.5h4v12H3z" />
      <circle pathLength={1} cx="12" cy="13.2" r="3.6" />
    </>
  ),
};

export function MakerIcon({ name, size = 24, className = "" }: { name: MakerIconName; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`craft-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SHAPES[name]}
    </svg>
  );
}
