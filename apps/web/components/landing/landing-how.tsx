"use client";

import { useRef, type ReactNode } from "react";

import { Tape } from "./landing-bits";
import { clamp, lerp, ss, stickyProgress, useLandingFrame } from "./landing-motion";

type Step = { code: string; title: string; body: string; tape: number; last?: boolean; extra: ReactNode };

const STEPS: Step[] = [
  {
    code: "01 — DESCRIBE",
    title: "Say what you want to make",
    body: "Plain English, plus an optional reference image or sketch. Then refine it in conversation.",
    tape: 3,
    extra: (
      <div className="lp-how__box">
        <span>
          › a 1 L bottle that shows water temp + time<span className="lp-amber">▍</span>
        </span>
        <span className="lp-how__file">
          <span className="lp-how__sketch" />
          sketch.png · 214 KB
        </span>
      </div>
    ),
  },
  {
    code: "02 — COMPILE",
    title: "AI drafts, rules check",
    body: "An AI turns your idea into every part and connection. Rule-based checks flag shorts, voltage mismatches and pin conflicts, and repair what they can.",
    tape: -4,
    extra: (
      <div className="lp-how__box lp-how__checks">
        <span className="lp-green">✓ no shorts</span>
        <span className="lp-green">✓ all logic at 3.3 V</span>
        <span className="lp-amber">⚠ GPIO9 strapping pin → SCL moved to GPIO10</span>
        <span className="lp-green">✓ repaired · revalidated</span>
      </div>
    ),
  },
  {
    code: "03 — BUILD",
    title: "Get the full package",
    body: "Parts list, wiring diagram, 3D model, product renders and step-by-step assembly instructions. Keep iterating on the same project.",
    tape: 3,
    extra: (
      <div className="lp-how__chips">
        {["Parts list", "Wiring", "3D model", "Renders", "Build guide"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    ),
  },
  {
    code: "04 — LAUNCH",
    title: "Launch a coin for it",
    body: "Turn the idea into a pump.fun coin from your own wallet. Bluebuild builds its pitch deck, the coin's website, from your design.",
    tape: -4,
    last: true,
    extra: (
      <div className="lp-how__coinrow">
        <span className="lp-how__coin">$SIP</span>
        <span>
          pitch deck → coin website
          <br />
          your wallet · fee to Bluebuild: 0
        </span>
      </div>
    ),
  },
];

/** How it works: a 340vh sticky section where four taped cards slide across a pinned trace line. */
export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const traceRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const gearARef = useRef<HTMLDivElement>(null);
  const gearBRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pinRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const state = useRef<{ q?: number; active?: number }>({});

  useLandingFrame(({ vw, vh, reduced }) => {
    const section = sectionRef.current;
    const track = trackRef.current;
    const first = cardRefs.current[0];
    const last = cardRefs.current[3];
    if (!section || !track || !first || !last) return;
    const { rect, p } = stickyProgress(section, vh);
    if (rect.bottom <= 0 || rect.top >= vh) return;
    const st = state.current;
    st.q = st.q === undefined ? p : lerp(st.q, p, 0.12);
    const q = ss(0, 1, st.q);
    const startX = vw + 40 - first.offsetLeft;
    const endX = vw * 0.5 - (last.offsetLeft + last.offsetWidth / 2);
    const tx = lerp(startX, endX, q);
    track.style.transform = `translate3d(${tx.toFixed(1)}px,0,0)`;
    if (traceRef.current) traceRef.current.style.transform = `scaleX(${clamp((vw * 0.5 - tx) / track.scrollWidth).toFixed(4)})`;
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
    let active = 0;
    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const d = (tx + card.offsetLeft + card.offsetWidth / 2 - vw / 2) / vw;
      const ad = Math.abs(d);
      const focus = Math.max(0, 1 - ad * 2.5);
      card.style.transform = `perspective(1200px) rotateY(${clamp(-d * 40, -50, 50).toFixed(2)}deg) translateZ(${(-ad * 220 + focus * 40).toFixed(1)}px) translateY(${(ad * 30).toFixed(1)}px)`;
      card.style.opacity = (1 - clamp(ad - 0.3) * 1.4).toFixed(3);
      card.style.borderColor = focus > 0.4 ? "#ffb547" : "#3a70c4";
      card.style.boxShadow = `inset 0 0 26px rgba(5,18,44,.35),0 ${(16 + focus * 30).toFixed(0)}px ${(30 + focus * 40).toFixed(0)}px -18px rgba(0,0,0,.7)`;
      const lit = tx + card.offsetLeft + 37 < vw * 0.5 + 4;
      if (lit) active = i;
      const pin = pinRefs.current[i];
      if (pin) {
        pin.style.background = lit ? "#ffb547" : "#143a73";
        pin.style.boxShadow = lit ? "0 0 0 6px rgba(255,181,71,.2)" : "none";
      }
    });
    if (active !== st.active) {
      const firstTime = st.active === undefined;
      st.active = active;
      if (numRef.current) {
        numRef.current.textContent = `0${active + 1}`;
        if (!firstTime && !reduced) {
          numRef.current.animate([{ transform: "translateY(-60%)", opacity: 0 }, { transform: "none", opacity: 1 }], {
            duration: 360,
            easing: "cubic-bezier(.2,.8,.2,1)",
          });
        }
      }
    }
    const rot = p * 540;
    if (gearARef.current) gearARef.current.style.transform = `rotate(${rot}deg)`;
    if (gearBRef.current) gearBRef.current.style.transform = `rotate(${-rot * 2 + 6}deg)`;
  });

  return (
    <section id="how" ref={sectionRef} className="lp-how lp-blueprint">
      <div className="lp-sticky lp-how__stage">
        <div ref={gearARef} className="lp-how__gearA" aria-hidden="true">
          <div className="lp-how__teeth" />
          <div className="lp-how__webA" />
          <div className="lp-how__hubA" />
          <div className="lp-how__axle" />
          <div className="lp-how__crossV" />
          <div className="lp-how__crossH" />
        </div>
        <div ref={gearBRef} className="lp-how__gearB" aria-hidden="true">
          <div className="lp-how__teeth lp-how__teeth--amber" />
          <div className="lp-how__webB" />
          <div className="lp-how__hubB" />
          <div className="lp-how__crossB" />
        </div>

        <div className="lp-how__head">
          <span className="lp-eyebrow lp-eyebrow--amber">How it works</span>
          <h2 className="lp-how__h2">From a sentence to a buildable drawing.</h2>
        </div>
        <div className="lp-how__count" aria-hidden="true">
          <span>STEP</span>
          <span ref={numRef} className="lp-how__num">
            01
          </span>
          <span>/ 04</span>
        </div>

        <div ref={trackRef} className="lp-how__track">
          <div className="lp-how__dash" />
          <div ref={traceRef} className="lp-how__trace" />
          {STEPS.map((step, i) => (
            <div
              key={step.code}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className={`lp-how__card${step.last ? " is-last" : ""}`}
            >
              <span
                ref={(el) => {
                  pinRefs.current[i] = el;
                }}
                className="lp-how__pin"
              />
              <span className="lp-how__stem" />
              <Tape rotate={step.tape} width={96} style={{ right: 26, top: -13 }} />
              <span className="lp-how__code">{step.code}</span>
              <h3 className="lp-how__title">{step.title}</h3>
              <p className="lp-how__body">{step.body}</p>
              {step.extra}
            </div>
          ))}
          <div className="lp-how__spacer" />
        </div>
        <div className="lp-how__progress">
          <div ref={barRef} className="lp-how__progressfill" />
        </div>
      </div>
    </section>
  );
}
