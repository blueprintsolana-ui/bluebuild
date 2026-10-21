/**
 * Turns the backend's agent pipeline (steps + progress events) into what the build card shows:
 * step names, the status sentence, live log lines, progress and the live-draft stages.
 * Pure functions so the mapping can be tested without a running build.
 */

export type PipelineStepInput = {
  id: string;
  label: string;
  agent?: string;
  description?: string;
};

export type PipelineEventInput = {
  step_id: string;
  status: string;
  label?: string;
  details?: Record<string, unknown>;
};

export type ChipState = "idle" | "run" | "done" | "failed" | "skipped";

export type PipelineChip = {
  id: string;
  name: string;
  state: ChipState;
};

export type PipelineFeedLine = {
  text: string;
  tone: "ok" | "warn" | "fail" | "info";
  opacity: number;
};

export type PipelineView = {
  chips: PipelineChip[];
  total: number;
  /** Steps finished (completed or skipped). */
  count: number;
  activeIndex: number;
  statusLine: string;
  heroName: string;
  heroAgent: string;
  feed: PipelineFeedLine[];
  /** Progress rail width, 0-100. */
  percent: number;
  /** Live draft: component boxes, wires, rules stamp. */
  showParts: boolean;
  showWires: boolean;
  showRulesPass: boolean;
};

/** The redesign's copy for the 14 web-research steps; other workflows fall back to backend labels. */
export const STEP_COPY: Record<string, { name: string; agent: string; status: string }> = {
  safety_guardrail: { name: "Checking safe build scope", agent: "Safety Scope Agent", status: "Checking the request against the 3.3–5 V maker scope." },
  context_clarifier: { name: "Clarifying build context", agent: "Intent Agent", status: "Clarifying what the product needs to do." },
  external_research: { name: "Gathering source context", agent: "External Source Research Agent", status: "Running web research via live web sources." },
  web_architect: { name: "Planning sourced architecture", agent: "Architecture Agent", status: "Planning the system architecture from sourced parts." },
  web_component_sourcing: { name: "Selecting sourced components", agent: "Component Agent", status: "Selecting real components with sourcing notes." },
  wiring_netlist: { name: "Drafting nets and pin map", agent: "Wiring Agent", status: "Drafting every net and pin assignment." },
  validation_repair: { name: "Validating and repairing", agent: "Rules Engine", status: "Running rule checks and repairing conflicts." },
  mechanical_fabrication: { name: "Designing enclosure and mounts", agent: "Enclosure Agent", status: "Designing the enclosure and part mounts." },
  assembly: { name: "Writing build steps", agent: "Documentation Agent", status: "Writing the step-by-step build guide." },
  product_model: { name: "Shaping the 3D product", agent: "Modeling Agent", status: "Shaping the 3D product model." },
  cad_generation: { name: "Authoring native CAD", agent: "CAD Agent", status: "Authoring native CAD geometry." },
  completeness_audit: { name: "Auditing completeness", agent: "Audit Agent", status: "Auditing the package for gaps." },
  package_project: { name: "Packaging project artifacts", agent: "Packaging Agent", status: "Packaging the project files." },
  image_generation: { name: "Generating product visuals", agent: "Render Agent", status: "Generating product renders." },
};

// Live-draft stages, by step id (the design's "parts at step 5, wires at step 6, rules pass at step 8").
const PARTS_STEP = "web_component_sourcing";
const WIRES_STEP = "wiring_netlist";
const RULES_STEP = "validation_repair";

function words(value: unknown): string {
  return String(value ?? "").replace(/_/g, " ").trim();
}

function shortModel(value: unknown): string {
  const text = String(value ?? "").trim();
  return text.includes("/") ? text.split("/").pop() || text : text;
}

/** One readable log line for a backend event, or null for events not worth showing. */
export function eventLogLine(event: PipelineEventInput, step?: PipelineStepInput): string | null {
  const details = event.details || {};
  const status = String(event.status || "").toLowerCase();
  const name = STEP_COPY[event.step_id]?.name || step?.label || event.label || words(event.step_id);
  switch (status) {
    case "started":
      return `› ${name.toLowerCase()}…`;
    case "provider_request_started": {
      if (details.query_count !== undefined) return `› ${details.query_count} web searches via ${words(details.provider) || "web search"}`;
      const schema = words(details.schema).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
      const model = shortModel(details.model);
      return `› drafting ${schema || "output"}${model ? ` · ${model}` : ""}`;
    }
    case "provider_response_received":
      if (details.source_count !== undefined) return `✓ ${details.source_count} sources found`;
      return `✓ response received${details.actual_model ? ` · ${shortModel(details.actual_model)}` : ""}`;
    case "provider_response_failed":
    case "provider_request_failed":
      return `⚠ provider call failed${details.error ? ` · ${String(details.error).slice(0, 60)}` : ""}`;
    case "diagnostics": {
      const categories = Array.isArray(details.failure_categories) ? details.failure_categories.map(words) : [];
      return categories.length ? `⚠ repairing: ${categories.join(", ")}` : "⚠ repairing wiring issues";
    }
    case "completed":
      return `✓ ${name.toLowerCase()} done`;
    case "skipped":
      return `› skipped${details.reason ? ` · ${words(details.reason)}` : ""}`;
    case "failed":
      return `✕ ${details.error ? String(details.error).slice(0, 80) : `${name.toLowerCase()} failed`}`;
    default:
      return null;
  }
}

function toneOf(text: string): PipelineFeedLine["tone"] {
  if (text.startsWith("✓")) return "ok";
  if (text.startsWith("⚠")) return "warn";
  if (text.startsWith("✕")) return "fail";
  return "info";
}

export function buildPipelineView({
  steps,
  states,
  events,
  activeStepId,
  finished,
  failed = false,
}: {
  steps: PipelineStepInput[];
  /** Per-step status from the existing pipeline logic: pending | active | completed | failed | skipped. */
  states: Record<string, string>;
  events: PipelineEventInput[];
  activeStepId: string | null;
  /** The whole job has finished successfully. */
  finished: boolean;
  /** The whole job failed: the step it stopped on shows as failed even without a failure event. */
  failed?: boolean;
}): PipelineView {
  const chips: PipelineChip[] = steps.map((step) => {
    const raw = finished ? "completed" : states[step.id] || "pending";
    const state: ChipState =
      raw === "completed" ? "done" : raw === "active" ? "run" : raw === "failed" ? "failed" : raw === "skipped" ? "skipped" : "idle";
    return { id: step.id, name: STEP_COPY[step.id]?.name || step.label, state };
  });
  const total = steps.length;
  const count = chips.filter((chip) => chip.state === "done" || chip.state === "skipped").length;
  const activeIndex = Math.max(
    0,
    activeStepId ? steps.findIndex((step) => step.id === activeStepId) : chips.findIndex((chip) => chip.state === "run"),
  );
  if (failed && chips.length && !chips.some((chip) => chip.state === "failed")) {
    chips[activeIndex] = { ...chips[activeIndex], state: "failed" };
  }
  const active = steps[activeIndex];
  const copy = active ? STEP_COPY[active.id] : undefined;

  const stepEvents = active ? events.filter((event) => event.step_id === active.id) : [];
  const lines = stepEvents.map((event) => eventLogLine(event, active)).filter((line): line is string => Boolean(line));
  const recent = lines.slice(-3);
  const feed: PipelineFeedLine[] = recent.length
    ? recent.map((text, index) => ({ text, tone: toneOf(text), opacity: Number((0.45 + (0.55 * (index + 1)) / recent.length).toFixed(2)) }))
    : [{ text: "› starting agent…", tone: "info", opacity: 1 }];

  const reached = (stepId: string, minState: ChipState[]) => {
    const index = steps.findIndex((step) => step.id === stepId);
    if (index < 0) return finished;
    return finished || minState.includes(chips[index].state) || chips.slice(index + 1).some((chip) => chip.state !== "idle");
  };

  return {
    chips,
    total,
    count,
    activeIndex,
    statusLine: copy?.status || active?.description || "Preparing the build.",
    heroName: copy?.name || active?.label || "Preparing job",
    heroAgent: copy?.agent || active?.agent || "Bluebuild runtime",
    feed,
    percent: total ? Math.min(100, ((count + (finished ? 0 : 0.5)) / total) * 100) : 0,
    showParts: reached(PARTS_STEP, ["run", "done"]),
    showWires: reached(WIRES_STEP, ["run", "done"]),
    showRulesPass: reached(RULES_STEP, ["done"]),
  };
}

export type PipelineSummary = {
  total: number;
  /** Seconds from start to the last backend event, or null when unknown. */
  elapsedSeconds: number | null;
  /** Time of the last backend event, for "just finished" checks. */
  finishedAtMs: number | null;
};

function timeMs(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** Reads a finished run's step count and duration from a message's stored pipeline progress. */
export function pipelineSummary(progress: unknown): PipelineSummary | null {
  if (!progress || typeof progress !== "object") return null;
  const record = progress as { steps?: unknown; startedAt?: unknown; events?: unknown };
  const steps = Array.isArray(record.steps) ? record.steps : [];
  if (!steps.length) return null;
  const events = Array.isArray(record.events) ? record.events : [];
  const times = events
    .map((event) => timeMs((event as { observed_at?: unknown })?.observed_at))
    .filter((value): value is number => value !== null);
  const started = timeMs(record.startedAt);
  const finished = times.length ? Math.max(...times) : null;
  return {
    total: steps.length,
    elapsedSeconds: started !== null && finished !== null && finished - started >= 100 ? (finished - started) / 1000 : null,
    finishedAtMs: finished,
  };
}
