"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

import type { PipelineChip, PipelineView } from "../../lib/pipeline-view";

export type PipelineRunState = "running" | "failed" | "stopped";

type AgentPipelineCardProps = {
  view: PipelineView;
  state: PipelineRunState;
  jobId?: string | null;
  /** Pill text: "backend synced", "starting", "waiting on provider", "estimated"... */
  signal: string;
  startedAtMs: number | null;
  /** When the run stopped (last backend event); the clock freezes there once it isn't running. */
  endedAtMs?: number | null;
  /** Shown under the rail when the backend has been quiet for a while. */
  quietNote?: string | null;
  canRetry?: boolean;
  onStop?: () => void;
  onReset?: () => void;
  resetting?: boolean;
};

const EASE = "cubic-bezier(.2,.8,.2,1)";
const GEAR_COLOURS = { running: "#f4f7fb", failed: "#ff6b5e", stopped: "#a9bedd" } as const;

// Generic live draft: reference designators only, since the real parts aren't known until the end.
const DRAFT_NODES = [
  { x: 30, y: 30, w: 120, h: 60, name: "J1" },
  { x: 30, y: 170, w: 120, h: 60, name: "U2" },
  { x: 30, y: 310, w: 120, h: 60, name: "BT1" },
  { x: 255, y: 130, w: 140, h: 140, name: "U1" },
  { x: 490, y: 36, w: 120, h: 76, name: "U3" },
  { x: 490, y: 284, w: 120, h: 76, name: "U4" },
];
const DRAFT_WIRES = [
  { color: "#ff6b6b", points: "90,90 90,170" },
  { color: "#ff6b6b", points: "90,230 90,310" },
  { color: "#ff6b6b", points: "150,200 205,200 205,160 255,160" },
  { color: "#ff6b6b", points: "395,250 428,250 428,334 490,334" },
  { color: "#8aa3c8", points: "150,350 215,350 215,252 255,252" },
  { color: "#7fb2ff", points: "395,180 440,180 440,62 490,62" },
  { color: "#7fb2ff", points: "395,196 454,196 454,84 490,84" },
  { color: "#a8a0ff", points: "395,232 440,232 440,308 490,308" },
];

function formatElapsed(startedAtMs: number | null, now: number) {
  if (startedAtMs === null) return "—";
  return `${Math.max(0, (now - startedAtMs) / 1000).toFixed(1)}s`;
}

function MiniGear({ chip }: { chip: PipelineChip }) {
  return (
    <span data-cgear={chip.id} data-st={chip.state} className="bb-chip-gear" aria-hidden="true">
      <span className="bb-chip-gear__teeth" />
      <span className="bb-chip-gear__ring" />
    </span>
  );
}

function ChipBadge({ failed }: { failed: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion) return;
    el.animate(
      [
        { transform: "rotate(-60deg) scale(0)", opacity: 0 },
        { transform: "rotate(4deg) scale(1.35)", opacity: 1, offset: 0.6 },
        { transform: "rotate(-8deg) scale(1)" },
      ],
      { duration: 520, easing: "cubic-bezier(.3,1.5,.5,1)", fill: "backwards" },
    );
    const ring = failed ? "255,107,94" : "120,214,160";
    el.parentElement?.animate(
      [
        { boxShadow: `0 0 0 0 rgba(${ring},.9),0 0 26px rgba(${ring},.7)` },
        { boxShadow: `0 0 0 12px rgba(${ring},0),0 0 0 rgba(${ring},0)` },
      ],
      { duration: 650, easing: EASE },
    );
  }, [failed, reducedMotion]);
  return (
    <span ref={ref} className={`bb-chip__badge ${failed ? "is-failed" : ""}`} aria-hidden="true">
      {failed ? "✕" : "✓"}
    </span>
  );
}

function Chip({ chip }: { chip: PipelineChip }) {
  const label = { idle: "", run: " (running)", done: " (done)", failed: " (failed)", skipped: " (skipped)" }[chip.state];
  return (
    <li className={`bb-chip is-${chip.state}`}>
      {chip.state === "run" && (
        <span className="bb-chip__sweep-clip" aria-hidden="true">
          <span className="bb-chip__sweep" />
        </span>
      )}
      <MiniGear chip={chip} />
      <span className="bb-chip__name">{chip.name}</span>
      <span className="sr-only">{label}</span>
      {(chip.state === "done" || chip.state === "failed") && <ChipBadge failed={chip.state === "failed"} />}
    </li>
  );
}

function GearTrain({ colour, count }: { colour: string; count: number }) {
  const gear = (ratio: string, size: number, left: number, top: number, teeth: number) => {
    const half = 360 / teeth / 2;
    return (
      <span data-mgear={ratio} className="bb-mgear" style={{ left, top, width: size, height: size }}>
        <span
          className="bb-mgear__teeth"
          style={{ background: `repeating-conic-gradient(${colour} 0 ${half}deg, transparent ${half}deg ${half * 2}deg)` }}
        />
        <span className="bb-mgear__web" style={{ borderColor: colour }} />
        <span className="bb-mgear__hub" style={{ borderColor: colour }} />
        <span className="bb-mgear__spoke is-v" style={{ background: colour }} />
        <span className="bb-mgear__spoke is-h" style={{ background: colour }} />
      </span>
    );
  };
  return (
    <div className="bb-train" aria-hidden="true">
      {gear("-1.6", 40, 44, 0, 10)}
      {gear("-2", 30, 46, 70, 8)}
      {gear("1", 64, 0, 26, 16)}
      <span data-mhub="1" className="bb-train__hub" style={{ borderColor: colour }} />
      <span data-pawl="1" className="bb-train__pawl" />
      <span className="bb-train__label">{count} LOCKED</span>
    </div>
  );
}

/**
 * The agent pipeline as a machine (design: Bluebuild App.dc.html): progress rail, current step
 * with live log lines and a live draft, a gear train that snaps one tooth per finished step, and
 * one chip per step whose mini gear spins while running and locks when done. Driven entirely by
 * the backend's pipeline events through `view`.
 */
export function AgentPipelineCard({
  view,
  state,
  jobId,
  signal,
  startedAtMs,
  endedAtMs = null,
  quietNote,
  canRetry = false,
  onStop,
  onReset,
  resetting = false,
}: AgentPipelineCardProps) {
  const reducedMotion = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const motion = useRef({ a: 0, v: 0, snap: null as number | null, lockAt: 0, chips: new Map<string, { a: number; v: number; snap: number | null }>() });
  const previous = useRef<{ count: number; active: number } | null>(null);
  const running = state === "running";
  const colour = GEAR_COLOURS[state];

  // Panel and chips enter once.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || reducedMotion) return;
    el.querySelector<HTMLElement>(".bb-pipe")?.animate(
      [
        { opacity: 0, transform: "translateY(14px)", clipPath: "inset(0 0 100% 0 round 10px)" },
        { opacity: 1, transform: "none", clipPath: "inset(0 0 0 0 round 10px)" },
      ],
      { duration: 700, easing: EASE },
    );
    el.querySelectorAll<HTMLElement>(".bb-chips > .bb-chip").forEach((chip, index) =>
      // The end keyframe omits opacity so dim (pending) chips settle at their own opacity.
      chip.animate([{ opacity: 0, transform: "translateY(12px) scale(.94)" }, { transform: "none" }], {
        duration: 480,
        delay: 120 + index * 45,
        easing: EASE,
        fill: "backwards",
      }),
    );
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A finished step: text re-enters, the train snaps a tooth, the pawl ticks, the hub flashes.
  useEffect(() => {
    const last = previous.current;
    previous.current = { count: view.count, active: view.activeIndex };
    if (!last || reducedMotion) return;
    if (last.count === view.count && last.active === view.activeIndex) return;
    const el = root.current;
    if (!el) return;
    if (view.count > last.count) motion.current.lockAt = performance.now();
    el.querySelectorAll<HTMLElement>("[data-hero-anim]").forEach((node, index) =>
      node.animate(
        [{ opacity: 0, transform: "translateY(10px)", filter: "blur(3px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
        { duration: 440, delay: index * 55, easing: EASE, fill: "backwards" },
      ),
    );
    if (view.count > last.count) {
      el.querySelector<HTMLElement>("[data-pawl]")?.animate(
        [{ transform: "rotate(0)" }, { transform: "rotate(28deg)" }, { transform: "rotate(0)" }],
        { duration: 420, easing: "cubic-bezier(.3,1.6,.5,1)" },
      );
      el.querySelector<HTMLElement>("[data-mhub]")?.animate(
        [
          { background: "#ffb547", boxShadow: "0 0 0 8px rgba(255,181,71,.35)" },
          { background: "#1c4a91", boxShadow: "0 0 0 0 rgba(255,181,71,0)" },
        ],
        { duration: 560 },
      );
    }
  }, [view.count, view.activeIndex, reducedMotion]);

  // One animation frame loop for the train, the chip gears and the elapsed clock.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(50, now - last) : 16;
      last = now;
      if (elapsedRef.current && running) elapsedRef.current.textContent = formatElapsed(startedAtMs, Date.now());
      if (reducedMotion) return;
      const m = motion.current;
      const locking = !running || (m.lockAt && now - m.lockAt < 480);
      if (locking) {
        if (m.snap === null) m.snap = Math.ceil(m.a / 22.5) * 22.5 + 22.5;
        m.a += (m.snap - m.a) * 0.24;
        m.v = 0;
      } else {
        m.snap = null;
        m.v += (0.2 - m.v) * 0.05;
        m.a += m.v * dt;
      }
      el.querySelectorAll<HTMLElement>("[data-mgear]").forEach((gear) => {
        const ratio = parseFloat(gear.dataset.mgear || "1");
        gear.style.transform = `rotate(${(m.a * ratio + (ratio === 1 ? 0 : 9)).toFixed(2)}deg)`;
      });
      el.querySelectorAll<HTMLElement>("[data-cgear]").forEach((gear) => {
        const key = gear.dataset.cgear || "";
        const g = m.chips.get(key) || { a: 0, v: 0, snap: null };
        m.chips.set(key, g);
        if (gear.dataset.st === "run") {
          g.snap = null;
          g.v += (7 - g.v) * 0.08;
          g.a += (g.v * dt) / 16;
        } else if (gear.dataset.st === "done") {
          if (g.snap === null) g.snap = Math.ceil(g.a / 45) * 45 + 45;
          g.v = (g.v + (g.snap - g.a) * 0.16) * 0.64;
          g.a += g.v;
        }
        gear.style.transform = `rotate(${g.a.toFixed(2)}deg)`;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, startedAtMs, reducedMotion]);

  const pill = state === "failed" ? "is-failed" : state === "stopped" ? "is-stopped" : signal === "backend synced" ? "is-synced" : "is-pending";
  const ticks = Array.from({ length: view.total }, (_, index) => index);
  const failedChip = view.chips.find((chip) => chip.state === "failed");

  return (
    <div ref={root} className="bb-build">
      <p data-hero-anim="1" className="bb-build__status">
        {state === "failed" ? "The build stopped on a step that couldn’t finish." : state === "stopped" ? "Build stopped. Your project brief is kept." : view.statusLine}
      </p>
      <div className="bb-pipe">
        <div className="bb-pipe__head">
          <div className="bb-pipe__title">
            <span className="bb-pipe__label">
              Agent pipeline
              <span className={`bb-pill ${pill}`}>
                {running && <span className="bb-pill__spin" aria-hidden="true" />}
                {signal}
              </span>
            </span>
            {jobId && <span className="bb-pipe__job">{jobId}</span>}
          </div>
          <span className="bb-pipe__spacer" />
          {running && onStop && (
            <button type="button" className="bb-pipe__btn" onClick={onStop} aria-label="Stop agent pipeline">
              Stop
            </button>
          )}
          {state === "failed" && onReset && (
            <button type="button" className="bb-pipe__btn is-amber" onClick={onReset} disabled={resetting} aria-label="Reset failed generation job">
              {resetting ? "Resetting…" : "Reset job"}
            </button>
          )}
          <div className="bb-pipe__count">
            <span>
              <span data-hero-anim="1" className="bb-pipe__done">{view.count}</span>/{view.total}
            </span>
            <span ref={elapsedRef} className="bb-pipe__elapsed">
              {running ? formatElapsed(startedAtMs, Date.now()) : endedAtMs ? formatElapsed(startedAtMs, endedAtMs) : "—"}
            </span>
          </div>
        </div>

        <div className="bb-rail" role="progressbar" aria-valuemin={0} aria-valuemax={view.total} aria-valuenow={view.count} aria-label="Pipeline progress">
          <div className="bb-rail__fill" style={{ width: `${view.percent.toFixed(1)}%` }}>
            <span className="bb-rail__head" />
          </div>
          {ticks.map((index) => (
            <span
              key={index}
              className="bb-rail__tick"
              style={{ left: `${(((index + 1) / view.total) * 100).toFixed(2)}%`, background: index < view.count ? "rgba(255,181,71,.7)" : "rgba(120,160,230,.35)" }}
            />
          ))}
        </div>
        {quietNote && <p className="bb-pipe__quiet">› {quietNote}</p>}

        <div className="bb-step">
          {running && <span className="bb-step__scan" aria-hidden="true" />}
          <div className="bb-step__main">
            <span className={`bb-step__icon ${running ? "" : "is-still"}`} aria-hidden="true">
              <span className="bb-step__icon-teeth" />
              <span className="bb-step__icon-ring" />
            </span>
            <div className="bb-step__text">
              <span data-hero-anim="1" className="bb-step__name">{view.heroName}</span>
              <span data-hero-anim="1" className="bb-step__agent">{view.heroAgent}</span>
              <div className="bb-step__feed" aria-live="polite">
                {view.feed.map((line, index) => (
                  <span key={`${index}-${line.text}`} className={`is-${line.tone}`} style={{ opacity: line.opacity }}>
                    {line.text}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="bb-draft" aria-hidden="true">
            <svg viewBox="0 0 640 400" className="bb-draft__svg">
              {view.showWires && (
                <g key="wires" className="bb-draft__wires" fill="none" strokeWidth={3.5}>
                  {DRAFT_WIRES.map((wire) => (
                    <polyline key={wire.points} points={wire.points} stroke={wire.color} />
                  ))}
                </g>
              )}
              {view.showParts && (
                <g key="parts" className="bb-draft__parts">
                  {DRAFT_NODES.map((node) => (
                    <g key={node.name}>
                      <rect x={node.x} y={node.y} width={node.w} height={node.h} fill="#0e2a57" stroke="#f4f7fb" strokeWidth={2.5} />
                      <text x={node.x + 12} y={node.y + 26} fill="#f4f7fb" fontSize={19} fontWeight={700} style={{ fontFamily: "var(--craft-mono)" }}>
                        {node.name}
                      </text>
                    </g>
                  ))}
                </g>
              )}
            </svg>
            {!view.showParts && <span className="bb-draft__waiting">AWAITING COMPONENTS…</span>}
            {view.showRulesPass && <span className="bb-draft__stamp">✓ RULES PASS</span>}
            <span className="bb-draft__label">LIVE DRAFT</span>
          </div>
        </div>

        <div className="bb-machine">
          <GearTrain colour={colour} count={view.count} />
          <ol className="bb-chips" aria-label={`Pipeline: ${view.count} of ${view.total} steps done`}>
            {view.chips.map((chip) => (
              <Chip key={chip.id} chip={chip} />
            ))}
          </ol>
        </div>

        {state === "failed" && (
          <p className="bb-pipe__jam" role="alert">
            <strong>Jammed{failedChip ? ` at “${failedChip.name}”` : ""}.</strong> That step couldn&apos;t finish, so the design stopped there.{" "}
            {canRetry ? "Press Reset job to try again, or reword your request." : "Try sending your request again, or reword it."}
          </p>
        )}
      </div>
    </div>
  );
}

