import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = name => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const core = await source("docs/AGENTS_CORE.md");
const manifest = JSON.parse(await source("vydykhai.json"));
const managed = file => manifest.managedPaths.some(root => file === root || file.startsWith(root + "/"));

// Structural regression only: these checks cannot prove that a model follows a route.
test("always-loaded core has a reviewed size budget and a conditional event router", () => {
  assert.ok(core.trim().split(/\s+/u).length <= 1800, "review meaning and event ownership before growing the core");
  for (const heading of ["Purpose And Authority", "Context And Module Boundaries",
    "Ownership And Continuation", "Proof And Retention", "Event Routes"]) {
    assert.ok(core.includes("### " + heading), heading);
  }
  assert.match(core, /router, not a checklist/);
  assert.match(core, /not a routine prerequisite/);
  assert.match(core, /ordinary continuation reuses current evidence/);
});

test("core procedures and anchors resolve inside the installed kit", async () => {
  const references = [...new Set([...core.matchAll(/`(docs\/[^\s`]+\.md(?:#[a-z-]+)?)`/g)].map(match => match[1]))];
  assert.ok(references.length > 0, "core must route to installed procedures");
  for (const reference of references) {
    const [file, anchor] = reference.split("#");
    assert.ok(managed(file), reference + " is not installed");
    const text = await source(file);
    if (anchor) {
      const headings = [...text.matchAll(/^#{1,6} (.+)$/gm)]
        .map(match => match[1].toLowerCase().replace(/[^a-z0-9 -]/g, "").replace(/ /g, "-"));
      assert.ok(headings.includes(anchor), reference + " has no target heading");
    }
  }
});

test("smaller core retains authority, accepted work, module isolation and honest proof", () => {
  for (const rule of [
    /source precedence within host permissions/,
    /Direct human control persists until returned/,
    /explicit pause stays paused/,
    /owner and return condition/,
    /Accepted Baseline, Candidate and next action/,
    /without producer-source context, including cheap preparation/,
    /Agree new\/changed boundaries with the human/,
    /finite tests do not prove all inputs/,
    /transition cost from repeated use/,
  ]) assert.match(core, rule);
  assert.match(core, /do not claim arbitrary native reads\/edits are sandboxed/);
});

test("continuation and Return keep ownership without inviting repeated global preparation", () => {
  for (const rule of [
    /Do not repeat global retrieval, preparation, readiness checks, approval or State publication without a material change/,
    /first safe action after approval and continue/,
    /failed internal test or acknowledgment is not completion/,
    /one single accepted notification owner, never parallel Guard delivery/,
    /does not rewrite producer evidence/,
    /uncertain external outcome is `OUTCOME_UNKNOWN`/,
    /reconcile exact durable\/provider evidence before replay/,
    /unchanged waits create no model call or user message/,
  ]) assert.match(core, rule);
});

test("cold events retain due maintenance, actual adoption and quiet limited-observation handling", () => {
  const routes = core.split("### Event Routes")[1];
  for (const rule of [
    /every unfinished worker at safe boundaries/,
    /paused work without resuming it/,
    /active orchestrator's own clean cwd/,
    /All code mapped and modular architecture confirmed are separate YES\/NO decisions/,
    /Each NO retains an owned proposal\/plan and concrete safe checkpoint/,
    /Partial mapping is not full coverage/,
    /first active use after 24 hours/,
    /after confirmed allowance renewal within the agreed budget/,
    /checkpoint-review-without-runtime-observation/,
    /Compaction alone is not automatic rotation/,
  ]) assert.match(routes, rule);
});

test("transition plan survives maintainer handoff but is not installed as runtime context", async () => {
  const file = "docs/FRAMEWORK_TRANSITION_PLAN.md";
  assert.match(await source("AGENTS.md"), /docs\/FRAMEWORK_TRANSITION_PLAN\.md/);
  assert.equal(managed(file), false);
  assert.doesNotMatch(core, /FRAMEWORK_TRANSITION_PLAN/);
  const plan = await source(file);
  for (const section of ["Outcome And Rationale", "Decisions To Preserve", "Stages And Exit Gates",
    "Evidence Plan", "Current Checkpoint", "Release Decision"]) assert.ok(plan.includes("## " + section), section);
  assert.match(plan, /Do not mark a stage complete solely because its instructions or tests exist/);
  assert.match(plan, /project owner/);
  assert.match(plan, /subscription allowance are different measures/);
});

test("local fact inspection is execution; a real supplement keeps owner and access boundaries", async () => {
  const routing = await source("docs/workflows/context-routing.md");
  const handoff = await source("docs/workflows/task-context-handoff-template.md");
  const cycle = await source("docs/workflows/module-delivery.md");
  assert.match(routing, /Inspecting already authorized sources and edit\/test paths is local execution/);
  assert.match(routing, /sources cannot answer a necessary question, disagree materially/);
  assert.match(routing, /does not expand packet access, authorize a new retrieval\s+agent/);
  assert.match(routing, /or permit producer-source exploration for a consumed module/);
  assert.match(handoff, /For necessary evidence they cannot supply, or a material contradiction/);
  assert.match(handoff, /never expand packet access, explore consumed producer internals or manage the preparer yourself/);
  assert.match(cycle, /An information gap that these sources cannot resolve/);
});
