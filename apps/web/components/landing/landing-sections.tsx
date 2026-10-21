"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { ContractAddress, Tape, TornTop, tornPoints } from "./landing-bits";
import { TitleCell } from "./landing-hero";
import { GITHUB_REPO_LINK, PUMP_FUN_LINK, X_LINK } from "./landing-links";
import { clamp, prefersReducedMotion, useLandingFrame } from "./landing-motion";
import { BottleSketch } from "./landing-output";
import { Wordmark } from "./wordmark";

const LAUNCH_EDGE = tornPoints(7);
const DOCS_EDGE = tornPoints(19);
const TOKEN_EDGE = tornPoints(29);

const POINTS = [
  ["Your wallet, your coin.", "You create it on pump.fun yourself. Bluebuild never holds your keys and takes no fee."],
  [
    "A pitch deck, built for you.",
    "It becomes the coin's website, so buyers see what the product actually is, with renders, a 3D model, use cases and costs.",
  ],
  ["Bring your community.", "Add your X and Telegram links when you launch."],
];

export function LaunchpadSection() {
  const cardRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const coinRef = useRef<HTMLDivElement>(null);

  useLandingFrame(({ now, vw, vh, pointer: m, reduced }) => {
    const card = cardRef.current;
    if (!card) return;
    const b = card.getBoundingClientRect();
    if (b.bottom < -100 || b.top > vh + 100) return;
    const dx = clamp((m.sx - (b.left + b.width / 2)) / (vw * 0.5), -1, 1);
    const dy = clamp((m.sy - (b.top + b.height / 2)) / (vh * 0.5), -1, 1);
    card.style.transform = `rotateY(${dx * 16}deg) rotateX(${-dy * 12}deg)`;
    if (glareRef.current) {
      glareRef.current.style.background = `radial-gradient(circle at ${50 + dx * 50}% ${50 + dy * 50}%, rgba(255,255,255,.9), transparent 55%)`;
    }
    if (coinRef.current && !reduced) {
      coinRef.current.style.transform = `translateY(${Math.sin(now / 700) * 10}px) rotateY(${now * 0.08}deg)`;
    }
  });

  return (
    <section id="launch" className="lp-launch">
      <TornTop color="#0e2a57" points={LAUNCH_EDGE} />
      <div className="lp-launch__copy">
        <span className="lp-eyebrow lp-eyebrow--amber">Launchpad</span>
        <h2 className="lp-h2">Every idea can have a coin.</h2>
        <p className="lp-lede">
          When your design is ready, launch a pump.fun coin for it in a couple of clicks. Bluebuild turns the design into a pitch deck
          that becomes the coin&apos;s website.
        </p>
        <div className="lp-launch__points">
          {POINTS.map(([title, body], i) => (
            <div key={title} className="lp-launch__point">
              <span className="lp-launch__n">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <b>{title}</b> {body}
              </span>
            </div>
          ))}
        </div>
        <a href="/app" className="lp-btn lp-btn--amber lp-btn--lg lp-self-start">
          Design something to launch →
        </a>
        <p className="lp-fine">
          Coins are created by their designers on pump.fun. Bluebuild takes no fee, doesn&apos;t endorse or promote any coin, and
          can&apos;t undo transactions. Crypto is risky; only spend what you can afford to lose.
        </p>
      </div>

      <div className="lp-launch__stage">
        <div ref={cardRef} className="lp-launch__card" aria-label="Example: a design launched as a coin with its pitch deck">
          <Tape rotate={-28} width={90} style={{ left: -22, top: -8 }} />
          <Tape rotate={-24} width={84} style={{ right: -20, bottom: 30 }} />
          <div className="lp-launch__sheet">
            <div className="lp-launch__top">
              <span className="lp-launch__name">SMART SIP BOTTLE</span>
              <span className="lp-launch__live">$SIP · LIVE ON PUMP.FUN</span>
            </div>
            <BottleSketch className="lp-launch__render" />
            <span className="lp-launch__tagline">Know exactly how cold your water is, at a glance.</span>
            <div className="lp-launch__stats">
              <span>
                RENDERS<b>3 VIEWS</b>
              </span>
              <span>
                3D MODEL<b>X-RAY</b>
              </span>
              <span>
                COSTS<b>PER UNIT</b>
              </span>
            </div>
            <div className="lp-launch__actions">
              <span className="lp-launch__primary">View on pump.fun</span>
              <span className="lp-launch__ghost">Pitch deck</span>
              <span className="lp-launch__ghost">X</span>
            </div>
            <span className="lp-launch__example">EXAMPLE · FEE TO BLUEBUILD: 0</span>
            <div ref={glareRef} className="lp-launch__glare" />
          </div>
          <div className="lp-coin" aria-hidden="true">
            <div ref={coinRef} className="lp-coin__spin">
              {[2, 4, 6, 8].map((z) => (
                <div key={z} className="lp-coin__edge" style={{ transform: `translateZ(-${z}px)` }} />
              ))}
              <div className="lp-coin__front">
                <span>
                  <b>$SIP</b>
                  <small>BB-001 · REV A</small>
                </span>
              </div>
              <div className="lp-coin__back">
                <span>BLUEBUILD</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const TERMINAL: [string, string][] = [
  ["# run Bluebuild on your own machine", "#8aa3c8"],
  [`$ git clone ${GITHUB_REPO_LINK}.git`, "#f4f7fb"],
  ["$ cd bluebuild", "#f4f7fb"],
  ["$ ./scripts/development/dev.sh", "#f4f7fb"],
  ["  ✓ workspace ready · form@mpl-2.0", "#78d6a0"],
  ["# then open", "#8aa3c8"],
  ["  http://localhost:3000", "#ffb547"],
];

export function DocsSection() {
  const termRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // The terminal types itself in, line by line, the first time it scrolls into view.
  useEffect(() => {
    const term = termRef.current;
    if (!term || prefersReducedMotion()) return undefined;
    const lines = lineRefs.current.filter((el): el is HTMLSpanElement => Boolean(el));
    lines.forEach((el) => {
      el.style.clipPath = "inset(0 100% 0 0)";
    });
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        lines.forEach((el, i) =>
          el.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], {
            duration: 520,
            delay: i * 380,
            easing: "steps(24,end)",
            fill: "forwards",
          }),
        );
      },
      { threshold: 0.4 },
    );
    observer.observe(term);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="docs" className="lp-docs">
      <TornTop color="#14366e" points={DOCS_EDGE} />
      <div className="lp-docs__copy">
        <span className="lp-eyebrow lp-eyebrow--amber">Docs</span>
        <h2 className="lp-h2">Open source. Read every line.</h2>
        <p className="lp-lede">
          Bluebuild&apos;s full code is public on GitHub. It is built on Form, the open-source AI hardware design workspace by CAID
          Technologies, and shared under the same MPL-2.0 licence.
        </p>
        <div className="lp-row">
          <a href={GITHUB_REPO_LINK} className="lp-btn lp-btn--paper lp-btn--lg">
            View the code on GitHub
          </a>
          <a href={`${GITHUB_REPO_LINK}/tree/main/docs`} className="lp-btn lp-btn--outline lp-btn--lg">
            Read the docs
          </a>
        </div>
      </div>
      <div ref={termRef} className="lp-term">
        <Tape rotate={-2} width={110} style={{ left: "50%", top: -14, marginLeft: -55 }} />
        <div className="lp-term__bar">
          <span className="lp-term__dot is-amber" />
          <span className="lp-term__dot" />
          <span className="lp-term__dot" />
          <span className="lp-term__title">~/bluebuild — zsh</span>
        </div>
        <div className="lp-term__body">
          {TERMINAL.map(([text, color], i) => (
            <span
              key={text}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              style={{ color }}
            >
              {text}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

const LETTERS = "$BLUEBUILD".split("");

export function TokenSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useLandingFrame(({ vh, pointer: m }) => {
    const section = sectionRef.current;
    if (!section) return;
    const tb = section.getBoundingClientRect();
    if (tb.bottom <= 0 || tb.top >= vh) return;
    LETTERS.forEach((c, i) => {
      const el = letterRefs.current[i];
      if (!el) return;
      const b = el.getBoundingClientRect();
      const dx = m.sx - (b.left + b.width / 2);
      const dy = m.sy - (b.top + b.height / 2);
      const w = Math.exp(-(dx * dx + dy * dy * 0.6) / (2 * 200 * 200));
      el.style.transform = `translateY(${(-w * 0.16).toFixed(3)}em) rotate(${((c.charCodeAt(0) % 2 ? 1 : -1) * w * 9).toFixed(2)}deg) scale(${(1 + w * 0.14).toFixed(3)})`;
      el.style.color = w > 0.55 ? "#ffb547" : "#f4f7fb";
    });
  });

  return (
    <section id="token" ref={sectionRef} className="lp-token">
      <TornTop color="#0e2a57" points={TOKEN_EDGE} />
      <span className="lp-eyebrow lp-eyebrow--amber">Token</span>
      <h2 className="lp-token__word" aria-label="$BLUEBUILD">
        {LETTERS.map((c, i) => (
          <span
            key={i}
            ref={(el) => {
              letterRefs.current[i] = el;
            }}
            aria-hidden="true"
          >
            {c}
          </span>
        ))}
      </h2>
      <span className="lp-token__sub">on pump.fun</span>
      <ContractAddress className="lp-token__ca" />
      <div className="lp-row lp-row--center">
        <a href={PUMP_FUN_LINK} className="lp-btn lp-btn--amber lp-btn--lg">
          Buy on pump.fun
        </a>
        <a href={X_LINK} className="lp-btn lp-btn--outline lp-btn--lg">
          Follow @bluebuild_AI
        </a>
      </div>
      <p className="lp-fine lp-token__fine">
        $BLUEBUILD is a community memecoin. It is not a share in Bluebuild, gives no rights to the software or any revenue, and carries
        no promise of returns. Only buy what you can afford to lose. It is separate from the coins people launch for their own designs.
      </p>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer__left">
        <Wordmark height={26} />
        <p>
          Bluebuild is an independent open-source project. Not affiliated with Blueprint.io. Built on Form by CAID Technologies
          (MPL-2.0).
        </p>
        <div className="lp-footer__links">
          <a href={GITHUB_REPO_LINK}>GITHUB</a>
          <a href={X_LINK}>X / TWITTER</a>
          <a href={PUMP_FUN_LINK}>PUMP.FUN</a>
          <Link href="/legal">ABOUT &amp; LEGAL</Link>
        </div>
      </div>
      <div className="lp-titleblock lp-titleblock--light">
        <TitleCell label="Project" value="Bluebuild — AI hardware design" />
        <TitleCell label="Dwg no." value="BB-001" />
        <TitleCell label="Rev" value="A" />
        <TitleCell label="Sheet" value="1 / 1" />
      </div>
    </footer>
  );
}
