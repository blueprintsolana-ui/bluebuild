"use client";

import { useEffect, useRef } from "react";

import { HowItWorks } from "./landing-how";
import { CommunityTurntable } from "./landing-community";
import { LandingHero } from "./landing-hero";
import { LandingMotion, clamp, pad4, useLandingFrame } from "./landing-motion";
import { OutputPad } from "./landing-output";
import { DocsSection, LandingFooter, LaunchpadSection, TokenSection } from "./landing-sections";
import { X_LINK } from "./landing-links";
import { Wordmark } from "./wordmark";

/** The Bluebuild landing page, rebuilt from design_handoff_bluebuild_redesign/Bluebuild Landing.dc.html. */
export default function LandingPage() {
  return (
    <LandingMotion>
      <div className="lp-root">
        <BulgeGrid />
        <div aria-hidden="true" className="lp-grain" />
        <LandingNav />
        <main>
          <LandingHero />
          <HowItWorks />
          <OutputPad />
          <CommunityTurntable />
          <LaunchpadSection />
          <DocsSection />
          <TokenSection />
        </main>
        <LandingFooter />
      </div>
    </LandingMotion>
  );
}

function LandingNav() {
  const xyRef = useRef<HTMLSpanElement>(null);
  const scaleRef = useRef<HTMLSpanElement>(null);
  const last = useRef({ xy: "", scale: "" });

  useLandingFrame(({ pointer, vh }) => {
    const scroll = window.scrollY;
    const docH = document.documentElement.scrollHeight - vh;
    const xy = `X ${pad4(pointer.x)} Y ${pad4(pointer.y + scroll)}`;
    const scale = `1:${(48 - 47 * clamp(scroll / Math.max(1, docH))).toFixed(1)}`;
    if (xyRef.current && last.current.xy !== xy) xyRef.current.textContent = last.current.xy = xy;
    if (scaleRef.current && last.current.scale !== scale) scaleRef.current.textContent = last.current.scale = scale;
  });

  return (
    <nav className="lp-nav" aria-label="Main">
      <a href="#top" aria-label="Bluebuild home" className="lp-nav__logo">
        <Wordmark height={26} />
      </a>
      <div className="lp-nav__links">
        <a href="#how">How it works</a>
        <a href="#output">Output</a>
        <a href="#community">Community</a>
        <a href="#launch">Launchpad</a>
        <a href="#docs">Docs</a>
        <a href="#token">Token</a>
        <a href={X_LINK}>@bluebuild_AI</a>
      </div>
      <span ref={xyRef} className="lp-nav__xy" aria-hidden="true">
        X 0000 Y 0000
      </span>
      <span ref={scaleRef} className="lp-nav__scale" aria-hidden="true">
        1:48.0
      </span>
      <a href="/app" className="lp-btn lp-btn--outline">
        Launch app
      </a>
      <a href="#token" className="lp-btn lp-btn--amber">
        <span>
          Buy<span className="lp-nav__long"> on pump.fun</span>
        </span>
      </a>
    </nav>
  );
}

/** Fixed drafting grid that bulges around the cursor and ripples where you click. */
function BulgeGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripples = useRef<{ x: number; y: number; t: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return undefined;
    const resize = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const onDown = (event: PointerEvent) => {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      ripples.current.push({ x: event.clientX, y: event.clientY, t: performance.now() });
      if (ripples.current.length > 4) ripples.current.shift();
    };
    resize();
    addEventListener("resize", resize);
    addEventListener("pointerdown", onDown, { passive: true });
    return () => {
      removeEventListener("resize", resize);
      removeEventListener("pointerdown", onDown);
    };
  }, []);

  useLandingFrame(({ now, vw: W, vh: H, pointer: m, reduced, touch }) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const scroll = window.scrollY;
    const S = 20;
    ctx.clearRect(0, 0, W, H);
    const A = touch || reduced ? 0 : 0.42;
    const sig2 = 150 * 150;
    const cut = sig2 * 9;
    ripples.current = ripples.current.filter((r) => now - r.t < 2400);
    const rip = ripples.current;
    const out = [0, 0];
    const disp = (x: number, y: number) => {
      let X = x;
      let Y = y;
      const dx = x - m.sx;
      const dy = y - m.sy;
      const d2 = dx * dx + dy * dy;
      if (d2 < cut) {
        const k = A * Math.exp(-d2 / sig2);
        X += dx * k;
        Y += dy * k;
      }
      for (const r of rip) {
        const age = (now - r.t) / 1000;
        const radius = age * 760;
        const rx = x - r.x;
        const ry = y - r.y;
        const dd = Math.sqrt(rx * rx + ry * ry) || 1;
        const q = dd - radius;
        if (q > -140 && q < 140) {
          const w = Math.exp(-(q * q) / 3200) * (1 - age / 2.4) * 16 * Math.sin(q / 14);
          X += (rx / dd) * w;
          Y += (ry / dd) * w;
        }
      }
      out[0] = X;
      out[1] = Y;
    };
    const base = Math.floor(scroll / S);
    const frac = scroll - base * S;
    const paths = [new Path2D(), new Path2D()];
    for (let j = -1; j * S < H + S; j += 1) {
      const y = j * S - frac;
      const path = paths[(((base + j) % 5) + 5) % 5 === 0 ? 1 : 0];
      for (let x = 0, k = 0; x <= W + S; x += S, k += 1) {
        disp(x, y);
        if (k) path.lineTo(out[0], out[1]);
        else path.moveTo(out[0], out[1]);
      }
    }
    for (let i = 0; i * S < W + S; i += 1) {
      const x = i * S;
      const path = paths[i % 5 === 0 ? 1 : 0];
      for (let j = -1, k = 0; j * S < H + S * 2; j += 1, k += 1) {
        disp(x, j * S - frac);
        if (k) path.lineTo(out[0], out[1]);
        else path.moveTo(out[0], out[1]);
      }
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(244,247,251,.065)";
    ctx.stroke(paths[0]);
    ctx.strokeStyle = "rgba(244,247,251,.15)";
    ctx.stroke(paths[1]);
  });

  return <canvas ref={canvasRef} aria-hidden="true" className="lp-grid" />;
}
