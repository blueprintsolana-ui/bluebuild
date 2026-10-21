import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPipelineView, eventLogLine, pipelineSummary, STEP_COPY } from "../lib/pipeline-view.ts";

const STEPS = Object.keys(STEP_COPY).map((id) => ({ id, label: id, agent: id }));

function states(done: number, active?: string) {
  const out: Record<string, string> = {};
  STEPS.forEach((step, index) => {
    out[step.id] = index < done ? "completed" : step.id === active ? "active" : "pending";
  });
  return out;
}

test("the redesign copies all 14 web research steps", () => {
  assert.equal(STEPS.length, 14);
});

test("a step in progress shows its own copy, count and half-step progress", () => {
  const view = buildPipelineView({
    steps: STEPS,
    states: states(4, "web_component_sourcing"),
    events: [],
    activeStepId: "web_component_sourcing",
    finished: false,
  });
  assert.equal(view.count, 4);
  assert.equal(view.heroName, "Selecting sourced components");
  assert.equal(view.heroAgent, "Component Agent");
  assert.equal(view.chips[4].state, "run");
  assert.equal(view.chips[3].state, "done");
  assert.ok(Math.abs(view.percent - (4.5 / 14) * 100) < 1e-9);
  assert.equal(view.showParts, true);
  assert.equal(view.showWires, false);
  assert.equal(view.feed[0].text, "› starting agent…");
});

test("the live draft adds wires at wiring and the rules stamp once validation is done", () => {
  const wiring = buildPipelineView({ steps: STEPS, states: states(5, "wiring_netlist"), events: [], activeStepId: "wiring_netlist", finished: false });
  assert.equal(wiring.showWires, true);
  assert.equal(wiring.showRulesPass, false);
  const enclosure = buildPipelineView({ steps: STEPS, states: states(7, "mechanical_fabrication"), events: [], activeStepId: "mechanical_fabrication", finished: false });
  assert.equal(enclosure.showRulesPass, true);
});

test("the feed keeps the active step's last three events, newest brightest", () => {
  const events = [
    { step_id: "external_research", status: "started" },
    { step_id: "external_research", status: "provider_request_started", details: { provider: "firecrawl", query_count: 4 } },
    { step_id: "web_architect", status: "started" },
    { step_id: "external_research", status: "provider_response_received", details: { source_count: 9 } },
    { step_id: "external_research", status: "completed" },
  ];
  const view = buildPipelineView({ steps: STEPS, states: states(2, "external_research"), events, activeStepId: "external_research", finished: false });
  assert.deepEqual(view.feed.map((line) => line.text), [
    "› 4 web searches via firecrawl",
    "✓ 9 sources found",
    "✓ gathering source context done",
  ]);
  assert.equal(view.feed[2].opacity, 1);
  assert.ok(view.feed[0].opacity < view.feed[2].opacity);
  assert.equal(view.feed[1].tone, "ok");
});

test("log lines read like the design", () => {
  assert.equal(
    eventLogLine({ step_id: "wiring_netlist", status: "provider_request_started", details: { schema: "WiringWrapper", model: "anthropic/claude-opus-5" } }),
    "› drafting wiring wrapper · claude-opus-5",
  );
  assert.equal(eventLogLine({ step_id: "validation_repair", status: "diagnostics", details: { failure_categories: ["pin_conflict"] } }), "⚠ repairing: pin conflict");
  assert.equal(eventLogLine({ step_id: "assembly", status: "failed", details: { error: "Timed out" } }), "✕ Timed out");
  assert.equal(eventLogLine({ step_id: "assembly", status: "heartbeat" }), null);
});

test("a finished job locks every chip", () => {
  const view = buildPipelineView({ steps: STEPS, states: states(3), events: [], activeStepId: null, finished: true });
  assert.equal(view.count, 14);
  assert.ok(view.chips.every((chip) => chip.state === "done"));
  assert.equal(view.percent, 100);
});

test("unknown workflows fall back to the backend's labels", () => {
  const view = buildPipelineView({
    steps: [{ id: "custom_step", label: "Custom step", agent: "Custom Agent", description: "Doing custom work." }],
    states: { custom_step: "active" },
    events: [],
    activeStepId: "custom_step",
    finished: false,
  });
  assert.equal(view.heroName, "Custom step");
  assert.equal(view.heroAgent, "Custom Agent");
  assert.equal(view.statusLine, "Doing custom work.");
});

test("a failed job marks the step it stopped on as failed", () => {
  const view = buildPipelineView({ steps: STEPS, states: states(0, "safety_guardrail"), events: [], activeStepId: "safety_guardrail", finished: false, failed: true });
  assert.equal(view.chips[0].state, "failed");
  assert.equal(view.chips[1].state, "idle");
});

test("a finished run's summary reads its step count and duration", () => {
  const summary = pipelineSummary({
    steps: STEPS,
    startedAt: "2026-10-22T10:00:00.000Z",
    events: [{ observed_at: "2026-10-22T10:00:05.000Z" }, { observed_at: "2026-10-22T10:01:12.400Z" }],
  });
  assert.deepEqual(summary, { total: 14, elapsedSeconds: 72.4, finishedAtMs: Date.parse("2026-10-22T10:01:12.400Z") });
  assert.equal(pipelineSummary(null), null);
  assert.equal(pipelineSummary({ steps: [] }), null);
});
