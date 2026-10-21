"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { TornTop, tornPoints } from "./landing-bits";
import { ss, stickyProgress, useLandingFrame } from "./landing-motion";

const SHEETS = [
  ["Parts list", "Every component, with quantities and where to buy it."],
  ["Wiring diagram", "Interactive schematic showing exactly which pin goes where."],
  ["3D model", "Drag it around, and switch on X-ray to see inside."],
  ["Build guide", "Step-by-step assembly instructions, in order."],
  ["Pitch deck & coin", "A shareable pitch deck with renders, use cases and costs, ready to be your coin's website."],
];

const BOM = [
  ["ESP32-C3 SuperMini", "40 × 30 mm · 3.3 V", "$3.20"],
  ["SSD1306 OLED", '0.96" · I2C · 128×64', "$2.10"],
  ["DS18B20 probe", "Sealed · 1-Wire", "$1.40"],
  ["LiPo cell", "3.7 V · 400 mAh", "$3.80"],
  ["TP4056 charger", "USB-C · 1 A", "$0.60"],
  ["Aluminium bottle", "1 L · Ø 76 × 275", "$6.50"],
  ["Moulded lid", "PC · Ø 70 mm", "$1.90"],
];

const GUIDE: [string, boolean][] = [
  ["Flash firmware to the ESP32-C3 over USB-C", true],
  ["Solder OLED: SDA → GPIO8, SCL → GPIO10", true],
  ["Seal the DS18B20 probe through the lid gland", true],
  ["Wire TP4056 → LiPo → 3V3 rail", false],
  ["Seat board + battery in the lid cavity", false],
  ["Close the lid, test against ice water", false],
];

const ISO_RINGS = [
  ...Array.from({ length: 7 }, (_, i) => ({ inset: "0", z: i * 18, border: i === 0 || i === 6 ? "1.5px solid #f4f7fb" : "1px dashed rgba(244,247,251,.45)" })),
  { inset: "26%", z: 150, border: "1.5px solid #ffb547" },
  { inset: "22%", z: 178, border: "1.5px solid #f4f7fb" },
  { inset: "6%", z: 214, border: "1.5px solid #f4f7fb" },
  { inset: "6%", z: 226, border: "1.5px solid #f4f7fb" },
  { inset: "34%", z: 252, border: "2px solid #ffb547" },
];

const OUTPUT_EDGE = tornPoints(41);

/** The output: a 440vh sticky section where a ring-bound pad flips through five example sheets. */
export function OutputPad() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const isoRef = useRef<HTMLDivElement>(null);
  const wiresRef = useRef<SVGGElement>(null);
  const sheetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const navRefs = useRef<(HTMLDivElement | null)[]>([]);
  const active = useRef(-1);

  // Fit the 640 × 500 pad into whatever room the right column has.
  useEffect(() => {
    const stage = stageRef.current;
    const pad = scaleRef.current;
    if (!stage || !pad) return undefined;
    const fit = () => {
      const s = Math.min(1.15, stage.clientWidth / 700, (stage.clientHeight - 40) / 580);
      pad.style.transform = `scale(${Math.max(0.4, s)})`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useLandingFrame(({ now, vw, vh, pointer: m, reduced }) => {
    const section = sectionRef.current;
    if (!section) return;
    const { rect, p } = stickyProgress(section, vh);
    if (rect.bottom <= 0 || rect.top >= vh) return;
    const f = p * 4.6 - 0.2;
    let current = 0;
    for (let i = 0; i < 4; i += 1) {
      const t = ss(0, 1, f - i);
      const sheet = sheetRefs.current[i];
      if (sheet) sheet.style.transform = `translateZ(${(4 - i) * 1.5 + 1}px) rotateX(${t * 172}deg)`;
      if (t > 0.5) current = i + 1;
    }
    if (current !== active.current) {
      active.current = current;
      navRefs.current.forEach((el, i) => el?.classList.toggle("is-active", i === current));
    }
    if (padRef.current) {
      padRef.current.style.transform = `rotateX(${24 + (m.sy / vh - 0.5) * -10}deg) rotateZ(${-3 + (m.sx / vw - 0.5) * 6}deg) rotateY(${(m.sx / vw - 0.5) * 8}deg)`;
    }
    if (reduced) return;
    if (isoRef.current) isoRef.current.style.transform = `rotateX(62deg) rotateZ(${35 + now * 0.03}deg)`;
    wiresRef.current?.querySelectorAll("polyline").forEach((wire, i) => {
      wire.style.strokeDashoffset = (-now * 0.03 * (i % 2 ? 1 : 1.3)).toFixed(1);
    });
  });

  const sheetRef = (i: number) => (el: HTMLDivElement | null) => {
    sheetRefs.current[i] = el;
  };

  return (
    <section id="output" ref={sectionRef} className="lp-output">
      <TornTop color="#14366e" points={OUTPUT_EDGE} />
      <div className="lp-sticky lp-output__stage">
        <div className="lp-output__left">
          <span className="lp-eyebrow lp-eyebrow--amber">The output</span>
          <h2 className="lp-output__h2">Everything on one set of sheets.</h2>
          <div className="lp-output__list">
            {SHEETS.map(([title, desc], i) => (
              <div
                key={title}
                ref={(el) => {
                  navRefs.current[i] = el;
                }}
                className={`lp-output__item${i === 0 ? " is-active" : ""}`}
              >
                <span className="lp-output__dot" />
                <span className="lp-output__text">
                  <span className="lp-output__title">{title}</span>
                  <span className="lp-output__desc">{desc}</span>
                </span>
                <span className="lp-output__sheetno">SHEET {i + 1} / 5</span>
              </div>
            ))}
          </div>
          <span className="lp-output__scope">SCOPE: 3.3–5 V MAKER ELECTRONICS. DESIGNS NEED HUMAN REVIEW BEFORE YOU BUILD.</span>
        </div>

        <div ref={stageRef} className="lp-output__padstage" aria-hidden="true">
          <div ref={scaleRef} className="lp-pad-scale">
            <div ref={padRef} className="lp-pad">
              <div className="lp-pad__backing" />

              <Sheet label="PITCH DECK & COIN" n={5} z={1} back={false}>
                <div className="lp-sheet__deck">
                  <BottleSketch />
                  <div className="lp-sheet__deckcopy">
                    <span className="lp-sheet__eyebrow">PITCH DECK · LIVE ON PUMP.FUN</span>
                    <span className="lp-sheet__deckname">Smart Sip Bottle</span>
                    <span className="lp-sheet__decktag">Know exactly how cold your water is, at a glance.</span>
                    <div className="lp-sheet__deckstats">
                      <span>
                        1 UNIT
                        <br />
                        <b>$19.50</b>
                      </span>
                      <span>
                        PARTS
                        <br />
                        <b>7 ITEMS</b>
                      </span>
                    </div>
                    <div className="lp-sheet__deckcoin">
                      <span className="lp-sheet__coin">$SIP</span>
                      <span>
                        RENDERS · 3D X-RAY
                        <br />
                        PARTS &amp; COSTS
                      </span>
                    </div>
                  </div>
                </div>
              </Sheet>

              <Sheet ref={sheetRef(3)} label="BUILD GUIDE" n={4} z={2.5}>
                <div className="lp-sheet__guide">
                  <span className="lp-sheet__eyebrow">BUILD GUIDE · 6 STEPS</span>
                  {GUIDE.map(([text, done], i) => (
                    <div key={text} className="lp-sheet__guiderow">
                      <span className="lp-sheet__tick">{done ? "✓" : ""}</span>
                      <span className="lp-sheet__guiden">{String(i + 1).padStart(2, "0")}</span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </Sheet>

              <Sheet ref={sheetRef(2)} label="3D MODEL" n={3} z={4}>
                <div className="lp-sheet__iso">
                  <div className="lp-sheet__isowrap">
                    <div ref={isoRef} className="lp-sheet__isostack">
                      {ISO_RINGS.map((ring, i) => (
                        <div key={i} style={{ inset: ring.inset, border: ring.border, transform: `translateZ(${ring.z}px)` }} />
                      ))}
                    </div>
                  </div>
                  <div className="lp-sheet__isoside">
                    <span className="lp-amber">3D MODEL · ISO</span>
                    <span>6 PARTS · Ø 76 × 275</span>
                    <span className="lp-sheet__xray">X-RAY ON</span>
                    <span className="lp-sheet__muted">
                      DRAG TO ROTATE
                      <br />
                      SCROLL TO ZOOM
                    </span>
                  </div>
                </div>
              </Sheet>

              <Sheet ref={sheetRef(1)} label="WIRING DIAGRAM" n={2} z={5.5}>
                <svg viewBox="0 0 600 360" className="lp-sheet__wiring">
                  <g ref={wiresRef} fill="none" strokeWidth="2" strokeLinejoin="round" strokeDasharray="6 4">
                    <polyline points="75,76 75,150" stroke="#ffb547" />
                    <polyline points="75,206 75,280" stroke="#ffb547" />
                    <polyline points="130,178 190,178 190,150 245,150" stroke="#ffb547" />
                    <polyline points="130,308 205,308 205,222 245,222" stroke="#f4f7fb" />
                    <polyline points="375,150 420,150 420,58 470,58" stroke="#7fb2ff" />
                    <polyline points="375,166 432,166 432,76 470,76" stroke="#7fb2ff" />
                    <polyline points="375,206 420,206 420,278 470,278" stroke="#7fb2ff" />
                    <polyline points="375,222 408,222 408,296 470,296" stroke="#ffb547" />
                  </g>
                  <g fill="#0e2a57" stroke="#f4f7fb" strokeWidth="1.5">
                    <rect x="20" y="20" width="110" height="56" />
                    <rect x="20" y="150" width="110" height="56" />
                    <rect x="20" y="280" width="110" height="56" />
                    <rect x="245" y="120" width="130" height="120" />
                    <rect x="470" y="30" width="110" height="70" />
                    <rect x="470" y="250" width="110" height="70" />
                  </g>
                  <g className="lp-mono" fontSize="12" fill="#f4f7fb" fontWeight="700">
                    <text x="32" y="46">USB-C</text>
                    <text x="32" y="176">TP4056</text>
                    <text x="32" y="306">LiPo</text>
                    <text x="258" y="146">ESP32-C3</text>
                    <text x="482" y="56">OLED</text>
                    <text x="482" y="276">DS18B20</text>
                  </g>
                  <g className="lp-mono" fontSize="10" fill="#a9bedd">
                    <text x="32" y="64">5 V IN</text>
                    <text x="32" y="194">CHARGE</text>
                    <text x="32" y="324">3.7 V · 400</text>
                    <text x="258" y="166">3V3</text>
                    <text x="258" y="232">GND</text>
                    <text x="330" y="166">G8</text>
                    <text x="324" y="182">G10</text>
                    <text x="330" y="212">G4</text>
                    <text x="482" y="74">SDA · SCL</text>
                    <text x="482" y="294">DATA · 1-W</text>
                    <text x="82" y="118" fill="#ffb547">5V</text>
                    <text x="82" y="248" fill="#ffb547">VBAT</text>
                    <text x="425" y="120" fill="#7fb2ff">I2C</text>
                  </g>
                </svg>
              </Sheet>

              <Sheet ref={sheetRef(0)} label="PARTS LIST" n={1} z={7}>
                <div className="lp-sheet__bom">
                  <div className="lp-sheet__bomhead">
                    <span>#</span>
                    <span>PART</span>
                    <span>SPEC</span>
                    <span>QTY</span>
                    <span className="lp-right">COST</span>
                  </div>
                  {BOM.map(([part, spec, cost], i) => (
                    <div key={part} className="lp-sheet__bomrow">
                      <span className="lp-sheet__bomn">{String(i + 1).padStart(2, "0")}</span>
                      <span className="lp-sheet__bompart">{part}</span>
                      <span className="lp-sheet__bomspec">{spec}</span>
                      <span className="lp-mono">×1</span>
                      <span className="lp-sheet__bomcost">{cost}</span>
                    </div>
                  ))}
                  <div className="lp-sheet__bomtotal">
                    <span>TOTAL · 1 UNIT</span>
                    <span>$19.50</span>
                  </div>
                </div>
              </Sheet>

              <div className="lp-pad__rings">
                {Array.from({ length: 16 }, (_, i) => (
                  <span key={i} />
                ))}
              </div>
            </div>
          </div>
          <span className="lp-hand lp-output__note">keep scrolling — flip the pad ↑</span>
        </div>
      </div>
    </section>
  );
}

function Sheet({
  ref,
  label,
  n,
  z,
  back = true,
  children,
}: {
  ref?: (el: HTMLDivElement | null) => void;
  label: string;
  n: number;
  z: number;
  back?: boolean;
  children: ReactNode;
}) {
  return (
    <div ref={ref} className="lp-sheet" style={{ transform: `translateZ(${z}px)` }}>
      <div className="lp-sheet__front">
        <div className="lp-sheet__frame">
          {children}
          <div className="lp-sheet__block">
            <span>{label}</span>
            <span>SHEET {n} / 5</span>
          </div>
        </div>
      </div>
      {back ? <div className="lp-sheet__back" /> : null}
    </div>
  );
}

/** Line drawing of the example bottle, standing in for a product render on the example sheets. */
export function BottleSketch({ className = "lp-sheet__render" }: { className?: string }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 120 200" aria-hidden="true">
        <g fill="none" stroke="#f4f7fb" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M34 186 V58 Q34 46 42 40 V30 H78 V40 Q86 46 86 58 V186 Q86 192 80 192 H40 Q34 192 34 186 Z" />
          <rect x="38" y="14" width="44" height="16" rx="3" />
          <path d="M34 70 H86 M34 176 H86" strokeDasharray="4 3" opacity="0.5" />
        </g>
        <rect x="48" y="18" width="24" height="8" fill="none" stroke="#ffb547" strokeWidth="1.6" />
        <path d="M60 36 V160" stroke="#ffb547" strokeWidth="1" strokeDasharray="6 4" opacity="0.7" />
      </svg>
      <span>EXAMPLE DRAWING</span>
    </div>
  );
}
