"use client";

import { useRef, useState, type FormEvent } from "react";
import { useReducedMotion } from "framer-motion";

import { GearTrain, PaperCard, Stamp, type GearTrainHandle } from "../craft";
import { CONTRACT_ADDRESS } from "./landing-links";

const mono = "font-[family-name:var(--craft-mono)]";
const HERO_GEARS = [
  { teeth: 26 },
  { teeth: 13, angle: 115, color: "var(--craft-brass)" },
  { teeth: 18, angle: 60 },
  { teeth: 10, angle: 150 },
];

function CopyAddress() {
  const [copied, setCopied] = useState(0);
  return (
    <div className={`bb-in bb-d4 flex flex-wrap items-center gap-2.5 ${mono}`}>
      <span className="text-[12px] tracking-[0.12em] text-[var(--craft-muted)]">CA</span>
      <code className="break-all rounded-[3px] border border-[var(--craft-hairline)] bg-[var(--craft-panel)] px-3 py-2.5 text-[13px]">{CONTRACT_ADDRESS}</code>
      <button
        type="button"
        className="craft-key min-h-[40px] px-3 text-[12px] tracking-[0.12em]"
        onClick={() => {
          void navigator.clipboard?.writeText(CONTRACT_ADDRESS);
          setCopied((value) => value + 1);
          window.setTimeout(() => setCopied(0), 1800);
        }}
      >
        {copied ? <Stamp tone="amber" rotate={-4} stampKey={copied} className="border-[1.5px] px-1.5 py-0 text-[11px]">Copied ✓</Stamp> : "COPY"}
      </button>
    </div>
  );
}

function WiringDrawing() {
  return (
    <PaperCard
      as="figure"
      tone="deep"
      grain
      className="bb-fig bb-in bb-d2 m-0 flex flex-col p-5"
      tape={[
        { style: { top: -11, left: "8%" }, rotate: -4, width: 92 },
        { style: { top: -11, right: "8%" }, rotate: 3, width: 92 },
      ]}
    >
      <div className="bb-scan" aria-hidden="true" />
      <svg viewBox="0 0 560 420" role="img" aria-label="Example output: a wiring diagram connecting a microcontroller to an OLED screen and a temperature sensor" className="block h-auto w-full">
        <g className="bb-draw" fill="none" stroke="#F4F7FB" strokeWidth="2" strokeLinejoin="round">
          <rect pathLength={1} x="210" y="140" width="140" height="160" />
          <rect pathLength={1} x="400" y="60" width="130" height="80" />
          <rect pathLength={1} x="400" y="260" width="130" height="80" />
          <rect pathLength={1} x="30" y="180" width="120" height="80" />
        </g>
        <g className="bb-wires" fill="none" strokeWidth="2" strokeLinecap="round">
          <path pathLength={1} d="M350 170H375V100H400" stroke="#F4F7FB" />
          <path pathLength={1} d="M350 190H385V120H400" stroke="#F4F7FB" />
          <path pathLength={1} d="M350 250H375V290H400" stroke="#F4F7FB" />
          <path pathLength={1} d="M150 210H210" stroke="#FFB547" />
          <path pathLength={1} d="M150 230H210" stroke="#A9BEDD" />
          <path pathLength={1} d="M350 275H385V320H400" stroke="#FFB547" />
        </g>
        <g fill="none" stroke="#FFB547" strokeWidth="2.5" strokeLinecap="round">
          <path className="bb-flow" d="M150 210H210" />
          <path className="bb-flow" d="M350 170H375V100H400" />
          <path className="bb-flow" d="M350 190H385V120H400" />
          <path className="bb-flow" d="M350 275H385V320H400" />
        </g>
        <g fill="#F4F7FB">
          {[[350, 170], [350, 190], [350, 250], [350, 275], [210, 210], [210, 230]].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} className="bb-node" cx={cx} cy={cy} r="3.5" />
          ))}
        </g>
        <g className="bb-lbl" fontFamily="IBM Plex Mono, Consolas, monospace" fontSize="12" fill="#A9BEDD" letterSpacing="1">
          <text x="222" y="164" fill="#F4F7FB" fontSize="14">MCU</text>
          <text x="222" y="182">3.3 V LOGIC</text>
          <text x="412" y="84" fill="#F4F7FB" fontSize="14">OLED</text>
          <text x="412" y="102">I2C · SDA/SCL</text>
          <text x="412" y="284" fill="#F4F7FB" fontSize="14">TEMP SENSOR</text>
          <text x="412" y="302">DATA · 3.3 V</text>
          <text x="42" y="204" fill="#F4F7FB" fontSize="14">USB 5 V</text>
          <text x="42" y="222">POWER IN</text>
        </g>
        <g className="bb-wires" stroke="#FFB547" strokeWidth="1.5" fill="none">
          <path pathLength={1} d="M210 330H350M210 322V338M350 322V338" />
        </g>
        <text className="bb-lbl" x="280" y="356" textAnchor="middle" fontFamily="IBM Plex Mono, Consolas, monospace" fontSize="11" fill="#FFB547" letterSpacing="1">
          VALIDATED · NO SHORTS · NO PIN CONFLICTS
        </text>
        <g stroke="#F4F7FB" strokeOpacity="0.6" strokeWidth="1.2">
          <path d="M14 14h12M20 8v12M534 14h12M540 8v12M14 406h12M20 400v12M534 406h12M540 400v12" />
        </g>
      </svg>
      <TitleBlock project="Temperature monitor + OLED" className="bb-tb" />
    </PaperCard>
  );
}

/** The engineering title block (PROJECT / DWG NO. / REV / SHEET). */
export function TitleBlock({ project, className = "" }: { project: string; className?: string }) {
  const cell = "px-3 py-2";
  const value = "block text-[13px] text-[var(--craft-ink)]";
  return (
    <div className={`grid grid-cols-[2fr_1fr_1fr] border border-[rgb(244_247_251/0.7)] text-[11px] tracking-[0.1em] text-[var(--craft-muted)] ${mono} ${className}`}>
      <div className={`${cell} col-span-3 border-b border-[rgb(244_247_251/0.7)]`}>
        PROJECT<span className={`${value} uppercase`}>{project}</span>
      </div>
      <div className={`${cell} border-r border-[rgb(244_247_251/0.7)]`}>DWG NO.<span className={value}>BB-001</span></div>
      <div className={`${cell} border-r border-[rgb(244_247_251/0.7)]`}>REV<span className={`${value} bb-rev text-[var(--craft-amber)]`}>A</span></div>
      <div className={cell}>SHEET<span className={value}>1 / 1</span></div>
    </div>
  );
}

export function LandingHero() {
  const gears = useRef<GearTrainHandle>(null);
  const reducedMotion = useReducedMotion();
  const [prompt, setPrompt] = useState("");

  const draw = (event?: FormEvent) => {
    event?.preventDefault();
    const text = prompt.trim();
    const target = text ? `/app?prompt=${encodeURIComponent(text)}` : "/app";
    if (reducedMotion) {
      window.location.assign(target);
      return;
    }
    // The gears spin up for a moment, then the app opens with the idea.
    gears.current?.spin(7, 900);
    window.setTimeout(() => window.location.assign(target), 650);
  };

  return (
    <section id="top" className="relative mx-auto grid max-w-[1240px] items-center gap-14 px-4 pb-24 pt-16 sm:px-6 lg:grid-cols-2 lg:pt-24">
      <GearTrain
        ref={gears}
        gears={HERO_GEARS}
        module={5}
        period={48}
        className="pointer-events-none absolute right-2 top-2 hidden h-48 w-auto opacity-75 lg:block xl:-right-6 xl:h-60"
      />
      <div className="relative flex flex-col gap-7">
        <p className={`bb-in m-0 text-[12px] uppercase tracking-[0.14em] text-[var(--craft-muted)] ${mono}`}>
          DWG NO. BB-001 · Open-source AI hardware design · Launchpad
        </p>
        <h1 className="landing-h1 bb-in bb-d1 m-0 font-semibold leading-[1.05] tracking-[-0.02em]">
          Describe it.
          <br />
          We&apos;ll draw the build.
          <br />
          <span className="text-[var(--craft-amber)]">Then launch it.</span>
        </h1>
        <span className="bb-dim" aria-hidden="true" />
        <p className="bb-in bb-d2 m-0 max-w-[540px] text-[19px] leading-[1.55] text-[var(--craft-muted)]">
          Type one sentence. Bluebuild returns a parts list, a wiring diagram, a 3D model and a step-by-step build guide for your
          product idea. Then launch a pump.fun coin for it, with its own pitch deck, straight from your wallet.
        </p>
        <PaperCard
          as="div"
          deckled
          grain
          seed={11}
          className="bb-in bb-d3 p-5"
          tape={[{ style: { top: -12, left: 22 }, rotate: -5, width: 84 }]}
        >
          <form onSubmit={draw} className="flex flex-col gap-3">
            <label htmlFor="bb-prompt" className={`text-[12px] uppercase tracking-[0.12em] text-[var(--craft-muted)] ${mono}`}>
              What do you want to build?
            </label>
            <div className="flex flex-wrap gap-3">
              <input
                id="bb-prompt"
                type="text"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="A temperature monitor with a small OLED screen"
                className="min-h-[48px] flex-[1_1_260px] rounded-[4px] border border-[var(--craft-hairline)] bg-[var(--craft-panel)] px-3.5 text-base text-[var(--craft-ink)] placeholder:text-[var(--craft-muted)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--craft-amber)]"
              />
              <button type="submit" className="craft-key craft-key--primary min-h-[48px] px-6 text-base">
                Draw it →
              </button>
            </div>
          </form>
        </PaperCard>
        <CopyAddress />
      </div>
      <WiringDrawing />
    </section>
  );
}
