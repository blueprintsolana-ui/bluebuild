"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type * as Three from "three";

import { deckledClipPath } from "../craft/paper";
import type { BottleModel } from "./bottle-model";
import { ContractAddress, Tape } from "./landing-bits";
import { clamp, lerp, pad4, prefersReducedMotion, ss, stickyProgress, useLandingFrame } from "./landing-motion";

const PARTS = [
  { n: "1", name: "Lid display", spec: '0.96" OLED', side: 1 },
  { n: "2", name: "Lid", spec: "Moulded PC · Ø 70 mm", side: -1 },
  { n: "3", name: "Controller board", spec: "ESP32-C3 · 40 × 30 mm", side: 1 },
  { n: "4", name: "Battery", spec: "400 mAh LiPo", side: -1 },
  { n: "5", name: "Temperature probe", spec: "DS18B20 · sealed", side: 1 },
  { n: "6", name: "Bottle body", spec: "1 L aluminium · Ø 76 mm · 275 mm", side: -1 },
];

export const SUGGESTIONS = [
  "a 1 L bottle that shows the water temperature and the time",
  "a plant pot that texts me when the soil is dry",
  "a bike light that flashes brighter when I brake",
  "a desk cube that glows red when CO₂ gets high",
  "a cat feeder that weighs every meal",
];

const PROMPT_CLIP = deckledClipPath(11, 2.5, 26);

type Scene = {
  renderer: Three.WebGLRenderer;
  scene: Three.Scene;
  camera: Three.PerspectiveCamera;
  model: BottleModel;
  target: Three.Vector3;
  v: Three.Vector3;
};

/** Hero + exploded view: a 440vh sticky section whose scroll progress drives the 3D bottle. */
export function LandingHero() {
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blueRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const exCopyRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const l1Ref = useRef<HTMLSpanElement>(null);
  const l2FillRef = useRef<HTMLSpanElement>(null);
  const l2PenRef = useRef<HTMLSpanElement>(null);
  const l3Ref = useRef<HTMLSpanElement>(null);
  const dimRef = useRef<HTMLSpanElement>(null);
  const noteRef = useRef<HTMLSpanElement>(null);
  const promptRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const leaderRefs = useRef<(SVGLineElement | null)[]>([]);
  const sceneRef = useRef<Scene | null>(null);
  const motion = useRef({ drawStart: 0, xr: 0, rotY: 0, hud: "" });
  const [xray, setXray] = useState(false);
  const xrayRef = useRef(false);
  useEffect(() => {
    xrayRef.current = xray;
  }, [xray]);
  const [submitting, setSubmitting] = useState(false);
  const timers = useRef<number[]>([]);

  // Headline intro: line 1 rises, line 2's fill wipes in behind an amber pen, line 3 rises, the dimension line draws.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const ease = "cubic-bezier(.2,.8,.2,1)";
    const rise = [
      { transform: "translateY(40%)", opacity: 0, clipPath: "inset(0 0 100% 0)" },
      { transform: "none", opacity: 1, clipPath: "inset(0 0 0 0)" },
    ];
    l1Ref.current?.animate(rise, { duration: 900, easing: ease, fill: "both", delay: 150 });
    l2FillRef.current?.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], {
      duration: 1500,
      easing: "cubic-bezier(.65,0,.35,1)",
      fill: "both",
      delay: 900,
    });
    l2PenRef.current?.animate(
      [
        { left: "0%", opacity: 1 },
        { left: "100%", opacity: 1, offset: 0.96 },
        { left: "100%", opacity: 0 },
      ],
      { duration: 1500, easing: "cubic-bezier(.65,0,.35,1)", fill: "both", delay: 900 },
    );
    l3Ref.current?.animate(rise, { duration: 900, easing: ease, fill: "both", delay: 2100 });
    dimRef.current?.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      duration: 1100,
      delay: 2300,
      easing: "cubic-bezier(.2,.7,.2,1)",
      fill: "both",
    });
    noteRef.current?.animate(
      [
        { opacity: 0, transform: "rotate(-5deg) translateY(8px)" },
        { opacity: 1, transform: "rotate(-5deg)" },
      ],
      { duration: 600, fill: "both", delay: 2900 },
    );
  }, []);

  // The prompt box types example ideas into its placeholder, on a loop.
  useEffect(() => {
    const input = promptRef.current;
    if (!input) return undefined;
    if (prefersReducedMotion()) {
      input.placeholder = SUGGESTIONS[0];
      return undefined;
    }
    let si = 0;
    let ci = 0;
    let dir = 1;
    let hold = 0;
    let timer = 0;
    const tick = () => {
      const s = SUGGESTIONS[si];
      if (hold > 0) hold -= 1;
      else if (dir > 0) {
        ci += 1;
        if (ci >= s.length) {
          dir = -1;
          hold = 40;
        }
      } else {
        ci -= 2;
        if (ci <= 0) {
          ci = 0;
          dir = 1;
          si = (si + 1) % SUGGESTIONS.length;
          hold = 6;
        }
      }
      input.placeholder = s.slice(0, ci) + (hold % 10 < 5 ? "▍" : " ");
      timer = window.setTimeout(tick, dir > 0 ? 42 : 18);
    };
    timer = window.setTimeout(tick, 1600);
    return () => window.clearTimeout(timer);
  }, []);

  // three.js scene, loaded after first paint so the page text shows straight away.
  useEffect(() => {
    let cancelled = false;
    let onResize: (() => void) | undefined;
    void Promise.all([import("three"), import("./bottle-model")]).then(([T, { buildBottleModel }]) => {
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      let renderer: Three.WebGLRenderer;
      try {
        renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
      } catch {
        return; // No WebGL: the hero still reads fine without the model.
      }
      renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(30, 1, 1, 8000);
      scene.add(new T.HemisphereLight(0xffffff, 0x9aa6c0, 0.95));
      const light = new T.DirectionalLight(0xffffff, 0.4);
      light.position.set(300, 600, 500);
      scene.add(light);
      const model = buildBottleModel(T);
      scene.add(model.root);
      scene.add(model.gears);
      model.gears.scale.setScalar(1.25);
      sceneRef.current = { renderer, scene, camera, model, target: new T.Vector3(), v: new T.Vector3() };
      motion.current.drawStart = performance.now() + 300;
      onResize = () => {
        renderer.setSize(innerWidth, innerHeight, false);
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
      };
      onResize();
      addEventListener("resize", onResize);
    });
    const pending = timers.current;
    return () => {
      cancelled = true;
      if (onResize) removeEventListener("resize", onResize);
      pending.forEach((t) => window.clearTimeout(t));
      const s = sceneRef.current;
      if (s) {
        s.model.dispose();
        s.renderer.dispose();
        sceneRef.current = null;
      }
    };
  }, []);

  useLandingFrame(({ now, vw, vh, pointer: m, reduced }) => {
    const hero = heroRef.current;
    if (!hero || !copyRef.current || !blueRef.current) return;
    const { rect: hr, p } = stickyProgress(hero, vh);
    if (hr.bottom < -vh) return;
    const k = ss(0.1, 0.4, p);
    const e = ss(0.32, 0.7, p);
    const st = motion.current;
    blueRef.current.style.opacity = String(ss(0.1, 0.26, p));
    if (barRef.current) barRef.current.style.transform = `scaleY(${p})`;
    const heroOpacity = 1 - ss(0.03, 0.15, p);
    copyRef.current.style.opacity = String(heroOpacity);
    copyRef.current.style.transform = `translate3d(0,${-ss(0, 0.2, p) * 220}px,0)`;
    copyRef.current.style.pointerEvents = heroOpacity < 0.3 ? "none" : "auto";
    if (tagRef.current) tagRef.current.style.opacity = String(1 - ss(0.02, 0.1, p));
    const exOpacity = ss(0.3, 0.4, p);
    if (exCopyRef.current) {
      exCopyRef.current.style.opacity = String(exOpacity);
      exCopyRef.current.style.transform = `translate3d(0,${(1 - exOpacity) * 40}px,0)`;
    }
    const hud =
      p < 0.05
        ? "Scroll to separate the parts ↓"
        : `Explode ${e.toFixed(2)} · Rot ${pad4((((st.rotY * 57.3) % 360) + 360) % 360).slice(1)}° · ${p > 0.78 ? "X-ray" : "Solid"}`;
    if (hudRef.current && st.hud !== hud) hudRef.current.textContent = st.hud = hud;

    const s = sceneRef.current;
    if (!s || hr.bottom <= 0) return;
    const { model, camera, renderer, scene, target, v } = s;
    model.setDraw(reduced ? 1 : clamp((now - st.drawStart) / 2600));
    model.setExplode(e);
    st.xr = lerp(st.xr, xrayRef.current ? 1 : ss(0.78, 0.86, p), 0.08);
    model.setXray(st.xr);
    const narrow = vw < 900;
    const phone = vw < 700;
    // On a phone the bottle sits behind the headline, so it stays faint until the copy scrolls away,
    // then moves left to leave room for the callouts.
    model.root.position.x = lerp(narrow ? 0 : 150, phone ? -150 : 0, k);
    renderer.domElement.style.opacity = phone ? String(lerp(0.22, 1, ss(0.05, 0.2, p))) : "1";
    if (!reduced) st.rotY += 0.0045 * (1 - k * 0.75);
    model.root.rotation.y = st.rotY + p * Math.PI * 1.2 + (m.sx / vw - 0.5) * 0.7;
    model.root.rotation.z = lerp(0.06, 0, k);
    const ty = lerp(140, 320, k);
    const dist = lerp(narrow ? 1250 : 980, vw < 700 ? 2100 : 1550, k);
    const elevation = lerp(0.12, 0.2, k) + (m.sy / vh - 0.5) * 0.18;
    target.set(0, ty, 0);
    camera.position.set(0, ty + Math.sin(elevation) * dist, Math.cos(elevation) * dist);
    camera.lookAt(target);
    model.gears.position.set(lerp(narrow ? 120 : 290, 520, k), lerp(70, -60, k), lerp(-160, -500, k));
    model.gears.rotation.set(-0.15, -0.55, 0.1);
    model.setGearOpacity(lerp(1, 0.5, k));
    model.updateGears((now / 1000) * 0.5 + window.scrollY * 0.004);
    renderer.render(scene, camera);

    PARTS.forEach((part, i) => {
      const label = labelRefs.current[i];
      const line = leaderRefs.current[i];
      if (!label || !line) return;
      const mp = model.parts[i];
      mp.group.localToWorld(v.copy(mp.anchor));
      v.project(camera);
      const sx = (v.x * 0.5 + 0.5) * vw;
      const sy = (-v.y * 0.5 + 0.5) * vh;
      const side = narrow ? 1 : part.side;
      const lx = sx + side * (narrow ? 70 : 150);
      const opacity = ss(0.46 + i * 0.025, 0.58 + i * 0.025, p) * (1 - ss(0.97, 1, p));
      label.style.opacity = String(opacity);
      label.style.transform = `translate3d(${lx + side * 8}px,${sy}px,0) translate(${side < 0 ? "-100%" : "0"},-50%)`;
      line.setAttribute("x1", String(sx));
      line.setAttribute("y1", String(sy));
      line.setAttribute("x2", String(lx));
      line.setAttribute("y2", String(sy));
      line.setAttribute("opacity", String(opacity));
    });
  });

  const onDraw = (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const idea = (promptRef.current?.value || "").trim() || SUGGESTIONS[0];
    setSubmitting(true);
    motion.current.drawStart = performance.now();
    const steps = ["READING YOUR SENTENCE…", "OPENING WORKSPACE →"];
    steps.forEach((text, i) =>
      timers.current.push(
        window.setTimeout(() => {
          if (statusRef.current) statusRef.current.textContent = text;
        }, i * 520),
      ),
    );
    timers.current.push(
      window.setTimeout(() => {
        window.location.href = `/app?prompt=${encodeURIComponent(idea.slice(0, 2000))}`;
      }, steps.length * 520 + 200),
    );
  };

  return (
    <section id="top" ref={heroRef} className="lp-hero" aria-label="Bluebuild">
      <div className="lp-sticky">
        <div ref={blueRef} className="lp-hero__blue lp-blueprint" />
        <canvas ref={canvasRef} className="lp-hero__canvas" aria-hidden="true" />
        <svg className="lp-hero__leaders" aria-hidden="true">
          {PARTS.map((part, i) => (
            <line
              key={part.n}
              ref={(el) => {
                leaderRefs.current[i] = el;
              }}
              x1="0"
              y1="0"
              x2="0"
              y2="0"
              stroke="#ffb547"
              strokeWidth="1"
              opacity="0"
            />
          ))}
        </svg>
        {PARTS.map((part, i) => (
          <div
            key={part.n}
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            className="lp-callout"
            aria-hidden="true"
          >
            <span className="lp-callout__n">{part.n}</span>
            <span className="lp-callout__text">
              <span className="lp-callout__name">{part.name}</span>
              <span className="lp-callout__spec">{part.spec}</span>
            </span>
          </div>
        ))}

        <div ref={copyRef} className="lp-hero__copy">
          <div className="lp-hero__kicker">
            <span className="lp-hero__dwg">DWG NO. BB-001</span>
            <span>Open-source AI hardware design · Launchpad</span>
          </div>
          <h1 className="lp-h1">
            <span ref={l1Ref} className="lp-h1__line">
              Describe it.
            </span>
            <span className="lp-h1__line lp-h1__outline">
              <span className="lp-h1__stroke">We&apos;ll draw the build.</span>
              <span ref={l2FillRef} className="lp-h1__fill" aria-hidden="true">
                We&apos;ll draw the build.
              </span>
              <span ref={l2PenRef} className="lp-h1__pen" aria-hidden="true" />
            </span>
            <span ref={l3Ref} className="lp-h1__line lp-h1__amber">
              Then launch it.
            </span>
          </h1>
          <span ref={dimRef} className="lp-dim" aria-hidden="true" />
          <p className="lp-hero__lede">
            Type one sentence. Bluebuild returns a parts list, a wiring diagram, a 3D model and a step-by-step build guide for your
            product idea. Then launch a pump.fun coin for it, with its own pitch deck, straight from your wallet.
          </p>
          <form className="lp-prompt" onSubmit={onDraw}>
            <div aria-hidden="true" className="lp-prompt__paper" style={{ clipPath: PROMPT_CLIP }} />
            <Tape rotate={-4} width={84} style={{ left: 24, top: -12 }} />
            <div className="lp-prompt__body">
              <label htmlFor="lp-idea" className="lp-prompt__label">
                What do you want to build?
              </label>
              <div className="lp-prompt__row">
                <input id="lp-idea" ref={promptRef} type="text" className="lp-prompt__input" maxLength={2000} autoComplete="off" />
                <button type="submit" className="lp-btn lp-btn--amber lp-btn--lg" disabled={submitting}>
                  Draw it →
                </button>
              </div>
            </div>
            <span ref={noteRef} className="lp-hand lp-prompt__note" aria-hidden="true">
              one sentence. that&apos;s it ↓
            </span>
          </form>
          <div className="lp-hero__status">
            <span ref={statusRef} aria-live="polite">
              READY · SCOPE 3.3–5 V
            </span>
          </div>
          <ContractAddress className="lp-hero__ca" />
        </div>

        <div ref={tagRef} className="lp-hero__tag">
          <Tape rotate={2} width={90} style={{ left: "50%", top: -13, marginLeft: -45 }} />
          <span className="lp-hero__tagrow">
            <span>MCU</span>
            <b>3.3 V logic</b>
          </span>
          <span className="lp-hero__tagrow">
            <span>OLED</span>
            <b>I2C · SDA/SCL</b>
          </span>
          <span className="lp-hero__tagrow">
            <span>Temp sensor</span>
            <b>Data · 3.3 V</b>
          </span>
          <span className="lp-hero__tagrow">
            <span>USB</span>
            <b>5 V power</b>
          </span>
          <span className="lp-hero__tagok">✓ Validated · no shorts · no pin conflicts</span>
        </div>

        <div ref={exCopyRef} className="lp-hero__excopy">
          <span className="lp-eyebrow lp-eyebrow--amber">Exploded view · Sheet 1 / 1</span>
          <h2 className="lp-hero__exh2">Every part, pulled apart.</h2>
          <p>
            “A 1 litre aluminium bottle that shows the water temperature and the time” becomes a numbered drawing of every part, with
            sizes, so you know exactly what goes where.
          </p>
        </div>

        <div className="lp-hero__hudrow">
          <span ref={hudRef} className="lp-hero__hud">
            Scroll to separate the parts ↓
          </span>
          <button type="button" className={`lp-xray${xray ? " is-on" : ""}`} aria-pressed={xray} onClick={() => setXray((on) => !on)}>
            X-RAY {xray ? "ON" : "AUTO"}
          </button>
        </div>

        <div className="lp-titleblock lp-hero__titleblock" aria-label="Title block">
          <TitleCell label="Project" value="Temperature monitor + OLED" />
          <TitleCell label="Dwg no." value="BB-001" />
          <TitleCell label="Rev" value="A" />
          <TitleCell label="Sheet" value="1 / 1" />
        </div>
        <div ref={barRef} className="lp-hero__bar" />
      </div>
    </section>
  );
}

export function TitleCell({ label, value }: { label: string; value: string }) {
  return (
    <span className="lp-titleblock__cell">
      <span className="lp-titleblock__label">{label}</span>
      <span>{value}</span>
    </span>
  );
}
