"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { CONTRACT_ADDRESS } from "./landing-links";

/** A strip of kraft washi tape, positioned inside its card. */
export function Tape({ style, rotate, width = 96 }: { style?: CSSProperties; rotate: number; width?: number }) {
  return <span aria-hidden="true" className="lp-tape" style={{ width, transform: `rotate(${rotate}deg)`, ...style }} />;
}

/** "CA [address] COPY" row; the button reads COPIED ✓ for a moment after copying. */
export function ContractAddress({ className = "" }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = () => {
    navigator.clipboard?.writeText(CONTRACT_ADDRESS).catch(() => undefined);
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className={`lp-ca ${className}`}>
      <span className="lp-ca__label">CA</span>
      <code className="lp-ca__code">{CONTRACT_ADDRESS}</code>
      <button type="button" className="lp-btn lp-btn--outline lp-btn--sm" onClick={copy} aria-live="polite">
        {copied ? "COPIED ✓" : "COPY"}
      </button>
    </div>
  );
}

/** Rough deckled-edge sheet torn along the top of a section; `color` is the section's own colour. */
export function TornTop({ color, points }: { color: string; points: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 1200 24" preserveAspectRatio="none" className="lp-torn">
      <polygon points={`0,24 ${points} 1200,24`} fill={color} />
      <polyline points={points} fill="none" stroke="rgba(244,247,251,.18)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Deterministic uneven edge for TornTop. */
export function tornPoints(seed: number) {
  let value = seed;
  const random = () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
  const points: string[] = [];
  for (let x = 0; x <= 1200; x += 24) points.push(`${x},${(6 + random() * 12).toFixed(1)}`);
  return points.join(" ");
}
