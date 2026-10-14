"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";

const mono = "font-[family-name:var(--craft-mono)]";
const INK = "#F4F7FB";
const MUTED = "#A9BEDD";
const AMBER = "#FFB547";

type Part = {
  number: number;
  name: string;
  detail: string;
  /** Vertical centre of the part when assembled, for its callout. */
  centreY: number;
  /** How far the part travels when fully exploded. */
  travel: number;
  rightEdge: number;
  shape: ReactNode;
};

const PARTS: Part[] = [
  {
    number: 1, name: "Lid display", detail: '0.96" OLED', centreY: 147, travel: -112, rightEdge: 230,
    shape: (
      <>
        <rect x="170" y="142" width="60" height="10" rx="2" />
        <path d="M178 147h20M204 147h14" stroke={AMBER} />
      </>
    ),
  },
  {
    number: 2, name: "Lid", detail: "Moulded PC · Ø 70 mm", centreY: 175, travel: -50, rightEdge: 248,
    shape: (
      <>
        <rect x="152" y="152" width="96" height="46" rx="8" />
        <path d="M164 160v30M176 160v30M224 160v30M236 160v30" strokeOpacity="0.5" />
      </>
    ),
  },
  {
    number: 3, name: "Controller board", detail: "ESP32-C3 · 40 × 30 mm", centreY: 164, travel: 40, rightEdge: 238,
    shape: (
      <>
        <rect x="162" y="160" width="76" height="8" rx="1" stroke="#7FD49A" />
        <rect x="186" y="156" width="16" height="4" />
        <rect x="210" y="157" width="10" height="3" />
      </>
    ),
  },
  {
    number: 4, name: "Battery", detail: "400 mAh LiPo", centreY: 181, travel: 78, rightEdge: 230,
    shape: (
      <>
        <rect x="170" y="172" width="60" height="18" rx="4" />
        <path d="M184 181h8M188 177v8" stroke={AMBER} />
      </>
    ),
  },
  {
    number: 5, name: "Temperature probe", detail: "DS18B20 · sealed", centreY: 250, travel: 100, rightEdge: 206,
    shape: (
      <>
        <path d="M200 200v96" />
        <rect x="194" y="292" width="12" height="18" rx="6" />
      </>
    ),
  },
  {
    number: 6, name: "Bottle body", detail: "1 L aluminium · Ø 76 mm", centreY: 360, travel: 220, rightEdge: 262,
    shape: (
      <>
        <path d="M162 196h76v14c18 4 24 16 24 32v262c0 10-8 18-18 18h-88c-10 0-18-8-18-18V242c0-16 6-28 24-32z" />
        <path d="M150 260h100M150 470h100" strokeOpacity="0.35" strokeDasharray="4 6" />
      </>
    ),
  },
];

function ExplodingPart({ part, explode, callouts }: { part: Part; explode: MotionValue<number>; callouts: MotionValue<number> }) {
  const y = useTransform(explode, (value) => value * part.travel);
  const labelX = 300;
  return (
    <motion.g style={{ y }}>
      <g fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        {part.shape}
      </g>
      <motion.g style={{ opacity: callouts }}>
        <path d={`M${part.rightEdge + 6} ${part.centreY}H${labelX - 16}`} stroke={MUTED} strokeWidth="1" strokeDasharray="3 3" fill="none" />
        <circle cx={labelX - 6} cy={part.centreY} r="11" fill="#0E2A57" stroke={AMBER} strokeWidth="1.5" />
        <text x={labelX - 6} y={part.centreY + 4} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="12" fill={AMBER}>
          {part.number}
        </text>
        <text x={labelX + 12} y={part.centreY - 2} fontFamily="Space Grotesk, sans-serif" fontSize="16" fill={INK}>
          {part.name}
        </text>
        <text x={labelX + 12} y={part.centreY + 15} fontFamily="IBM Plex Mono, monospace" fontSize="11" fill={MUTED} letterSpacing="0.5">
          {part.detail}
        </text>
      </motion.g>
    </motion.g>
  );
}

function BottleDrawing({ explode, callouts }: { explode: MotionValue<number>; callouts: MotionValue<number> }) {
  const bodyTravel = PARTS[5].travel;
  const dimensionY = useTransform(explode, (value) => value * bodyTravel);
  return (
    <svg viewBox="0 0 560 760" role="img" aria-label="Exploded view of a 1 litre smart water bottle: lid display, lid, controller board, battery, temperature probe and bottle body" className="h-full max-h-[78vh] w-full">
      {PARTS.map((part) => (
        <ExplodingPart key={part.number} part={part} explode={explode} callouts={callouts} />
      ))}
      {/* Height dimension on the bottle body. */}
      <motion.g style={{ y: dimensionY, opacity: callouts }} stroke={AMBER} strokeWidth="1.5" fill="none">
        <path d="M112 196V522M104 196h16M104 522h16" />
        <text x="96" y="364" fill={AMBER} stroke="none" fontFamily="IBM Plex Mono, monospace" fontSize="12" textAnchor="middle" transform="rotate(-90 96 364)">
          275 mm
        </text>
      </motion.g>
      <g stroke={INK} strokeOpacity="0.5" strokeWidth="1.2">
        <path d="M14 14h12M20 8v12M534 14h12M540 8v12M14 746h12M20 740v12M534 746h12M540 740v12" />
      </g>
    </svg>
  );
}

function Copy() {
  return (
    <div className="max-w-md">
      <p className={`m-0 text-[12px] uppercase tracking-[0.14em] text-[var(--craft-muted)] ${mono}`}>Exploded view</p>
      <h2 className="landing-h2 mt-3 font-semibold leading-tight">Every part, pulled apart.</h2>
      <p className="mt-4 text-[17px] leading-relaxed text-[var(--craft-muted)]">
        &ldquo;A 1 litre aluminium bottle that shows the water temperature and the time&rdquo; becomes a numbered drawing of every
        part, with sizes, so you know exactly what goes where.
      </p>
      <p className={`mt-6 text-[12px] tracking-[0.1em] text-[var(--craft-amber)] ${mono}`}>SCROLL TO SEPARATE THE PARTS ↓</p>
    </div>
  );
}

/** The landing showpiece: the smart water bottle separates into its parts as you scroll. */
export function ExplodedBottle() {
  const reducedMotion = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const scrollExplode = useTransform(scrollYProgress, [0.08, 0.6], [0, 1], { clamp: true });
  const scrollCallouts = useTransform(scrollYProgress, [0.45, 0.7], [0, 1], { clamp: true });
  const finished = useMotionValue(1);

  if (reducedMotion) {
    return (
      <section className="relative z-10 mx-auto grid max-w-[1240px] items-center gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
        <Copy />
        <BottleDrawing explode={finished} callouts={finished} />
      </section>
    );
  }

  return (
    <section ref={section} className="relative z-10 h-[260vh]">
      <div className="sticky top-0 mx-auto grid h-screen max-w-[1240px] grid-rows-[auto_1fr] items-center gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:grid-rows-1">
        <Copy />
        <div className="h-full min-h-0">
          <BottleDrawing explode={scrollExplode} callouts={scrollCallouts} />
        </div>
      </div>
    </section>
  );
}
