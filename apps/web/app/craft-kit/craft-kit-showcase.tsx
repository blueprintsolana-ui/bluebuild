"use client";

import { useEffect, useRef, useState } from "react";

import {
  CrosshairReadout,
  Gear,
  GearTrain,
  LivingGrid,
  MakerIcon,
  MechanicalCounter,
  PaperCard,
  PaperGrain,
  PipelineMachine,
  Stamp,
  TornEdge,
  type GearTrainHandle,
  type MachineStep,
  type MakerIconName,
} from "../../components/craft";

const HERO_TRAIN = [
  { teeth: 24 },
  { teeth: 12, angle: 20, color: "var(--craft-brass)" },
  { teeth: 18, angle: -40 },
  { teeth: 10, angle: 35 },
];
const PIPELINE_TRAIN = [{ teeth: 12 }, { teeth: 8, angle: 0, color: "var(--craft-amber)" }, { teeth: 12, angle: 0 }];
const ICONS: MakerIconName[] = ["gear", "caliper", "bolt", "chip", "battery", "screen", "solder", "shield", "search", "wire", "cube", "box", "camera"];
const DEMO_STEPS: Omit<MachineStep, "status">[] = [
  { id: "safety_guardrail", label: "Checking safe build scope" },
  { id: "intent_parser", label: "Parsing the hardware idea" },
  { id: "component_selection", label: "Selecting compatible parts" },
  { id: "wiring_netlist", label: "Drafting nets and pin mappings" },
  { id: "validation_repair", label: "Validating and repairing wiring" },
  { id: "bom", label: "Calculating BOM and cost" },
  { id: "assembly", label: "Writing build steps" },
  { id: "image_generation", label: "Generating product visuals" },
];

function demoSteps(done: number, failed = false): MachineStep[] {
  return DEMO_STEPS.map((step, index) => ({
    ...step,
    status: index < done ? "completed" : index === done ? (failed ? "failed" : "active") : "pending",
  }));
}

/** Runs the machine through a fake job so its ticks, stamps and jam can be checked. */
function MachineDemo() {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setDone((value) => (value >= DEMO_STEPS.length ? 0 : value + 1)), 2200);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="space-y-6">
      <PipelineMachine state={done >= DEMO_STEPS.length ? "done" : "running"} steps={demoSteps(done)} />
      <PipelineMachine state="failed" canRetry steps={demoSteps(3, true)} />
      <p className="flex items-baseline gap-2 text-[22px]">
        <MechanicalCounter value={20 - done * 2} />
        <span className="text-[12px] text-[var(--craft-muted)]">designs left (counts down with the demo)</span>
      </p>
    </div>
  );
}
const label = "font-[family-name:var(--craft-mono)] text-[11px] uppercase tracking-[0.16em] text-[var(--craft-muted)]";

export default function CraftKitShowcase() {
  const hero = useRef<GearTrainHandle>(null);
  const pipeline = useRef<GearTrainHandle>(null);
  const [revision, setRevision] = useState(1);

  return (
    <div className="craft-crosshair-zone relative min-h-screen font-[family-name:var(--craft-sans)] text-[var(--craft-ink)]">
      <LivingGrid fragments />
      <PaperGrain />
      <CrosshairReadout />
      <main className="relative z-10 mx-auto max-w-5xl space-y-14 px-4 py-14 sm:px-6">
        <header>
          <p className={label}>Bluebuild · craft kit test sheet</p>
          <h1 className="mt-2 text-4xl font-semibold">Crafty drafting table</h1>
          <p className="mt-2 max-w-xl text-[var(--craft-muted)]">Every piece of the kit on one sheet. Move the mouse, scroll, hover and press things.</p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <PaperCard className="p-6" tape={[{ style: { top: -10, left: "40%" }, rotate: -3 }]}>
            <p className={label}>Gear train · meshed, opposite directions, speeds in tooth ratio</p>
            <GearTrain ref={hero} gears={HERO_TRAIN} module={6} period={40} className="mx-auto mt-4 h-56 w-auto" title="Meshed gear train" />
            <button type="button" className="craft-key craft-key--primary mt-4" onClick={() => hero.current?.spin()}>
              Spin up
            </button>
          </PaperCard>

          <PaperCard className="p-6" tone="deep">
            <p className={label}>Pipeline train · clicks one tooth per finished step</p>
            <GearTrain ref={pipeline} gears={PIPELINE_TRAIN} module={5} mode="step" className="mx-auto mt-6 h-24 w-auto" title="Pipeline gears" />
            <button type="button" className="craft-key mt-6" onClick={() => pipeline.current?.advance()}>
              Advance one tooth
            </button>
            <div className="mt-6 flex items-center gap-8">
              <div className="text-center">
                <Gear mode="wobble" teeth={14} radius={22} className="h-14 w-14" color="var(--craft-muted)" />
                <p className={`${label} mt-2`}>Idle (empty states)</p>
              </div>
              <div className="text-center">
                <Gear mode="scroll" teeth={20} radius={22} className="h-14 w-14" color="var(--craft-brass)" />
                <p className={`${label} mt-2`}>Turns with scroll</p>
              </div>
            </div>
          </PaperCard>
        </section>

        <section>
          <p className={label}>Paper</p>
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            <PaperCard className="p-5" deckled grain tape={[{ style: { top: -9, left: 18 }, rotate: -4 }, { style: { top: -9, right: 18 }, rotate: 3 }]}>
              <h3 className="font-semibold">Hero sheet</h3>
              <p className="mt-2 text-sm text-[var(--craft-muted)]">Deckled edges, grain and two strips of washi tape.</p>
            </PaperCard>
            <PaperCard className="p-5" fold>
              <h3 className="font-semibold">Folded corner</h3>
              <p className="mt-2 text-sm text-[var(--craft-muted)]">Hover to lift the corner.</p>
            </PaperCard>
            <PaperCard className="p-5" tone="kraft" style={{ transform: "rotate(-1.5deg)" }}>
              <h3 className="font-semibold">Kraft note</h3>
              <p className="mt-2 text-sm">User messages in the app use this paper.</p>
            </PaperCard>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <PaperCard className="p-6">
            <p className={label}>Stamps</p>
            <div className="mt-5 flex flex-wrap items-center gap-5">
              <Stamp tone="amber">Approved</Stamp>
              <Stamp tone="amber" rotate={4} stampKey={revision}>Rev {String.fromCharCode(64 + revision)}</Stamp>
              <Stamp tone="red" rotate={-3}>Revise</Stamp>
            </div>
            <button type="button" className="craft-key mt-6" onClick={() => setRevision((value) => (value % 25) + 1)}>
              Save a new revision
            </button>
          </PaperCard>
          <PaperCard className="p-6">
            <p className={label}>Keys</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="craft-key craft-key--primary">Draw it →</button>
              <button type="button" className="craft-key">Secondary key</button>
            </div>
            <p className={`${label} mt-6`}>Maker icons · hover to redraw</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {ICONS.map((icon) => (
                <span key={icon} className="craft-draw-host flex h-12 w-12 items-center justify-center rounded border border-[var(--craft-hairline)]" title={icon}>
                  <MakerIcon name={icon} />
                </span>
              ))}
            </div>
          </PaperCard>
        </section>

        <section>
          <p className={label}>Generation machine · running and jammed</p>
          <PaperCard tone="deep" className="mt-4 p-5">
            <MachineDemo />
          </PaperCard>
        </section>

        <section>
          <p className={label}>Torn-paper divider</p>
          <div className="mt-4">
            <TornEdge />
            <div className="h-24 bg-[var(--craft-panel)]" />
          </div>
        </section>
        <div className="h-[60vh]" />
      </main>
    </div>
  );
}
