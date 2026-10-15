"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

import { Gear, GearTrain, type GearSpec, type GearTrainHandle } from "./gear";
import { MakerIcon, type MakerIconName } from "./maker-icons";
import { Stamp } from "./stamp";

export type MachineStepStatus = "pending" | "active" | "completed" | "failed" | "skipped";
export type MachineState = "running" | "done" | "failed" | "stopped";

export type MachineStep = {
  id: string;
  label: string;
  agent?: string;
  status: MachineStepStatus;
};

const MACHINE_GEARS: GearSpec[] = [
  { teeth: 16, angle: 0 },
  { teeth: 10, angle: -35, color: "var(--craft-brass)" },
  { teeth: 13, angle: 25 },
];

/** Gear ticks one tooth this often while a design is generating. */
const TICK_MS = 1400;

/** Pick a maker icon from the step id; unknown steps get a gear. */
export function stepIcon(id: string): MakerIconName {
  const rules: [RegExp, MakerIconName][] = [
    [/safety|guardrail/, "shield"],
    [/clarif|intent|requirement/, "pencil"],
    [/research|architect|search/, "search"],
    [/component|sourcing|parts/, "battery"],
    [/wiring|netlist/, "wire"],
    [/validat|repair|audit/, "caliper"],
    [/bom|cost/, "sheet"],
    [/mechanical|fabrication|product_model|cad/, "cube"],
    [/assembly/, "solder"],
    [/package/, "box"],
    [/image|visual|render/, "camera"],
    [/system/, "chip"],
  ];
  return rules.find(([pattern]) => pattern.test(id))?.[1] ?? "gear";
}

function MachineChip({ step }: { step: MachineStep }) {
  const { status } = step;
  return (
    <li className={`craft-machine__chip is-${status}`} title={step.agent ? `${step.agent}: ${step.label}` : step.label}>
      <MakerIcon name={stepIcon(step.id)} size={14} className={status === "active" ? "is-drawing" : ""} />
      <span className="max-w-[150px] truncate">{step.label}</span>
      <span className="sr-only">
        {status === "completed" ? " (done)" : status === "failed" ? " (failed)" : status === "active" ? " (running)" : status === "skipped" ? " (skipped)" : ""}
      </span>
      {status === "completed" && (
        <Stamp tone="amber" rotate={-8} className="craft-machine__stamp">
          ✓
        </Stamp>
      )}
      {status === "failed" && (
        <Stamp tone="red" rotate={6} className="craft-machine__stamp">
          ✕
        </Stamp>
      )}
    </li>
  );
}

/**
 * The generation pipeline as a little machine: a gear train that ratchets forward while it runs
 * (one extra tooth for each finished step), a stamped chip per step, and a red jammed gear with a
 * plain-English note when a step fails.
 */
export function PipelineMachine({
  steps,
  state,
  canRetry = false,
}: {
  steps: MachineStep[];
  state: MachineState;
  /** Show the "Reset job" hint in the jammed note. */
  canRetry?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const train = useRef<GearTrainHandle>(null);
  const completed = steps.filter((step) => step.status === "completed").length;
  const lastCompleted = useRef(completed);
  const running = state === "running";

  // Ratchet forward while the job runs; pause in hidden tabs.
  useEffect(() => {
    if (!running || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) train.current?.advance();
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [running, reducedMotion]);

  // A finished step clicks the train forward straight away.
  useEffect(() => {
    if (completed > lastCompleted.current) train.current?.advance();
    lastCompleted.current = completed;
  }, [completed]);

  const failedStep = steps.find((step) => step.status === "failed") ?? steps.find((step) => step.status === "active");

  return (
    <div className={`craft-machine is-${state}`}>
      <div className="craft-machine__gears" aria-hidden="true">
        {state === "failed" ? (
          <Gear teeth={16} radius={20} mode="still" color="var(--craft-red)" strokeWidth={2} className="craft-machine__jammed h-11 w-11" />
        ) : (
          <GearTrain ref={train} gears={MACHINE_GEARS} module={3.2} mode="step" strokeWidth={1.6} className="h-11 w-auto" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <ol className="craft-machine__belt" aria-label={`Pipeline: ${completed} of ${steps.length} steps done`}>
          {steps.map((step) => (
            <MachineChip key={step.id} step={step} />
          ))}
        </ol>
        {state === "failed" && (
          <p className="craft-machine__jam-note" role="alert">
            <strong>Jammed{failedStep ? ` at “${failedStep.label}”` : ""}.</strong> That step couldn&apos;t finish, so the design
            stopped there.{" "}
            {canRetry ? "Press Reset job to try again, or reword your request." : "Try sending your request again, or reword it."}
          </p>
        )}
      </div>
    </div>
  );
}
