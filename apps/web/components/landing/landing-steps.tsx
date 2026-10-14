"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";

import { MakerIcon, PaperCard, type MakerIconName } from "../craft";

const mono = "font-[family-name:var(--craft-mono)]";
const eyebrow = `m-0 text-[12px] uppercase tracking-[0.14em] text-[var(--craft-muted)] ${mono}`;

const STEPS: { step: string; title: string; body: string; icon: MakerIconName; tilt: number }[] = [
  { step: "01 — Describe", title: "Say what you want to make", body: "Plain English, plus an optional reference image or sketch. Then refine it in conversation.", icon: "pencil", tilt: -1.5 },
  { step: "02 — Compile", title: "AI drafts, rules check", body: "An AI turns your idea into every part and connection. Rule-based checks flag shorts, voltage mismatches and pin conflicts, and repair what they can.", icon: "chip", tilt: 1.2 },
  { step: "03 — Build", title: "Get the full package", body: "Parts list, wiring diagram, 3D model, product renders and step-by-step assembly instructions. Keep iterating on the same project.", icon: "solder", tilt: -0.8 },
  { step: "04 — Launch", title: "Launch a coin for it", body: "Turn the idea into a pump.fun coin from your own wallet. Bluebuild builds its pitch deck, the coin's website, from your design.", icon: "rocket", tilt: 1.6 },
];

/** "How it works": index cards pinned to the grid. Hover lifts a card and redraws its icon. */
export function HowItWorks() {
  return (
    <section id="how" className="relative z-10 border-y border-[var(--craft-hairline)] bg-[rgb(14_42_87/0.85)]">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-12 px-4 py-24 sm:px-6">
        <div className="bb-reveal flex flex-col gap-3">
          <p className={eyebrow}>How it works</p>
          <h2 className="landing-h2 m-0 font-semibold leading-tight">From a sentence to a buildable drawing.</h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item) => (
            <PaperCard
              key={item.step}
              className="craft-index-card craft-draw-host flex flex-col gap-3.5 p-7 pt-8"
              style={{ transform: `rotate(${item.tilt}deg)` }}
            >
              <span className="craft-pin" aria-hidden="true" />
              <span className="text-[var(--craft-ink)]">
                <MakerIcon name={item.icon} size={34} />
              </span>
              <span className={`text-[13px] tracking-[0.12em] text-[var(--craft-amber)] ${mono}`}>{item.step.toUpperCase()}</span>
              <h3 className="m-0 text-[21px] font-semibold">{item.title}</h3>
              <p className="m-0 text-[15px] leading-relaxed text-[var(--craft-muted)]">{item.body}</p>
            </PaperCard>
          ))}
        </div>
      </div>
    </section>
  );
}

const SHEETS: { title: string; body: string; icon: MakerIconName; stackTilt: number; fanTilt: number }[] = [
  { title: "Parts list", body: "Every component, with quantities and where to buy it.", icon: "sheet", stackTilt: -6, fanTilt: -5 },
  { title: "Wiring diagram", body: "Interactive schematic showing exactly which pin goes where.", icon: "chip", stackTilt: 3, fanTilt: -2.5 },
  { title: "3D model", body: "Drag it around, and switch on X-ray to see inside.", icon: "caliper", stackTilt: -2, fanTilt: 0 },
  { title: "Build guide", body: "Step-by-step assembly instructions, in order.", icon: "solder", stackTilt: 5, fanTilt: 2.5 },
  { title: "Pitch deck & coin", body: "A shareable pitch deck with renders, use cases and costs, ready to be your coin's website.", icon: "rocket", stackTilt: -4, fanTilt: 5 },
];

function useWideScreen() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

function FanSheet({ sheet, index, progress, fan }: { sheet: (typeof SHEETS)[number]; index: number; progress: MotionValue<number>; fan: boolean }) {
  const middle = (SHEETS.length - 1) / 2;
  // Stacked: every sheet sits over the middle column. Fanned: back in its own column.
  const x = useTransform(progress, [0, 1], [`${(middle - index) * 104}%`, "0%"]);
  const rotate = useTransform(progress, [0, 1], [sheet.stackTilt, sheet.fanTilt]);
  const y = useTransform(progress, [0, 1], [index * 4, Math.abs(index - middle) * 10]);
  return (
    <motion.div style={fan ? { x, rotate, y, zIndex: SHEETS.length - Math.abs(Math.round(index - middle)) } : undefined} className="craft-draw-host">
      <PaperCard tone={index % 2 ? "deep" : "blueprint"} fold={index === SHEETS.length - 1} className="flex h-full flex-col gap-3.5 p-6">
        <span className="text-[var(--craft-ink)]">
          <MakerIcon name={sheet.icon} size={32} />
        </span>
        <h3 className="m-0 text-[20px] font-semibold">{sheet.title}</h3>
        <p className="m-0 text-[15px] leading-relaxed text-[var(--craft-muted)]">{sheet.body}</p>
        <span className={`mt-auto text-[10px] tracking-[0.14em] text-[var(--craft-muted)] ${mono}`}>SHEET {index + 1} / {SHEETS.length}</span>
      </PaperCard>
    </motion.div>
  );
}

/** "What you get": a stack of drafting sheets that fans out as it scrolls into view (wide screens). */
export function OutputSheets() {
  const reducedMotion = useReducedMotion();
  const wide = useWideScreen();
  const row = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: row, offset: ["start 0.95", "center 0.55"] });
  const fan = wide && !reducedMotion;

  return (
    <section className="relative z-10 mx-auto flex max-w-[1240px] flex-col gap-12 px-4 py-24 sm:px-6">
      <div className="bb-reveal flex flex-col gap-3">
        <p className={eyebrow}>The output</p>
        <h2 className="landing-h2 m-0 font-semibold leading-tight">Everything on one set of sheets.</h2>
      </div>
      <div ref={row} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {SHEETS.map((sheet, index) => (
          <FanSheet key={sheet.title} sheet={sheet} index={index} progress={scrollYProgress} fan={fan} />
        ))}
      </div>
      <p className={`bb-reveal m-0 text-[12px] tracking-[0.1em] text-[var(--craft-muted)] ${mono}`}>
        SCOPE: 3.3–5 V MAKER ELECTRONICS. DESIGNS NEED HUMAN REVIEW BEFORE YOU BUILD.
      </p>
    </section>
  );
}
