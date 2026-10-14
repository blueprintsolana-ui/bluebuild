import type { CSSProperties, ReactNode } from "react";

/** Small deterministic random generator so deckled edges and tape angles are stable between renders. */
function seeded(seed: number) {
  let value = seed % 2147483647 || 1;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

/** clip-path polygon with slightly uneven ("deckled") edges, jitter in pixels. */
export function deckledClipPath(seed = 7, jitter = 2.5, steps = 26): string {
  const random = seeded(seed);
  const wobble = () => (random() * jitter).toFixed(2);
  const points: string[] = [];
  for (let i = 0; i <= steps; i += 1) points.push(`${((i / steps) * 100).toFixed(2)}% ${wobble()}px`);
  for (let i = 1; i <= steps; i += 1) points.push(`calc(100% - ${wobble()}px) ${((i / steps) * 100).toFixed(2)}%`);
  for (let i = steps - 1; i >= 0; i -= 1) points.push(`${((i / steps) * 100).toFixed(2)}% calc(100% - ${wobble()}px)`);
  for (let i = steps - 1; i >= 1; i -= 1) points.push(`${wobble()}px ${((i / steps) * 100).toFixed(2)}%`);
  return `polygon(${points.join(", ")})`;
}

type TapeProps = {
  /** CSS position of the strip within its card, e.g. { top: -10, left: "12%" }. */
  style?: CSSProperties;
  rotate?: number;
  width?: number | string;
};

/** A strip of kraft washi tape. Put it inside a positioned card. */
export function Tape({ style, rotate = -3, width = 96 }: TapeProps) {
  return <span aria-hidden="true" className="craft-tape" style={{ width, transform: `rotate(${rotate}deg)`, ...style }} />;
}

type PaperCardProps = {
  as?: "div" | "section" | "article" | "aside" | "li" | "figure";
  tone?: "blueprint" | "deep" | "kraft";
  /** Uneven edges: hero elements only, everyday UI stays crisp. */
  deckled?: boolean;
  /** Folded top-right corner that lifts on hover. */
  fold?: boolean;
  grain?: boolean;
  /** Tape strips holding the sheet down. */
  tape?: TapeProps[];
  seed?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  [key: string]: unknown;
};

/** A sheet of blueprint (or kraft) paper. */
export function PaperCard({
  as = "div",
  tone = "blueprint",
  deckled = false,
  fold = false,
  grain = false,
  tape = [],
  seed = 7,
  className = "",
  style,
  children,
  ...rest
}: PaperCardProps) {
  const classes = [
    "craft-paper",
    tone === "deep" ? "craft-paper--deep" : "",
    tone === "kraft" ? "craft-paper--kraft" : "",
    grain ? "craft-paper--grain" : "",
    deckled ? "craft-paper--deckled" : "",
    fold ? "craft-fold" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const Tag = as as "div";
  const sheet = (
    <Tag {...rest} className={classes} style={deckled ? { ...style, clipPath: deckledClipPath(seed) } : style}>
      {children}
    </Tag>
  );
  if (!tape.length) return sheet;
  // Tape sits outside the clipped sheet so it can overhang the edge.
  return (
    <div className="relative">
      {sheet}
      {tape.map((strip, index) => (
        <Tape key={index} {...strip} />
      ))}
    </div>
  );
}

/** Torn-paper edge used between landing sections. `color` is the colour of the section below. */
export function TornEdge({ color = "var(--craft-panel)", seed = 3, flip = false }: { color?: string; seed?: number; flip?: boolean }) {
  const random = seeded(seed);
  const points: string[] = ["0,24"];
  for (let x = 0; x <= 1200; x += 24) {
    points.push(`${x},${(6 + random() * 12).toFixed(1)}`);
  }
  points.push("1200,24");
  return (
    <svg
      aria-hidden="true"
      className="block h-6 w-full"
      viewBox="0 0 1200 24"
      preserveAspectRatio="none"
      style={flip ? { transform: "scaleY(-1)" } : undefined}
    >
      <polygon points={points.join(" ")} fill={color} />
      <polyline points={points.slice(1, -1).join(" ")} fill="none" stroke="rgb(244 247 251 / 0.18)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Fixed paper-grain overlay. Sits above the background, below content. */
export function PaperGrain() {
  return <div aria-hidden="true" className="craft-grain" />;
}
