import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("ordinary entry routes bounded repair and preserves independent evidence", async () => {
  const entry = await read(".agents/skills/framework-orchestrator/SKILL.md");
  const route = await read("docs/workflows/framework-orchestrator.md");
  assert.match(entry, /Reframe After Failure and Bounded Autonomous Assignment/);
  for (const phrase of [
    "one consistent current projection", "superseded commands as labelled history",
    "A bounded acceptance closes only its own", "applicable negative findings",
    "Never replay UNKNOWN effects", "stop automatic redispatch for that cause",
    "Do not reset attempts", "trust boundary needs explicit human agreement",
    "not a new audit", "not model polling"
  ]) assert.ok(route.includes(phrase), phrase);
});

test("safe-boundary adoption reuses existing owner and actual readback", async () => {
  const manifest = JSON.parse(await read("vydykhai.json"));
  const requirement = manifest.adoptionRequirements.find(r => r.id === "resume-or-checkpoint");
  for (const phrase of ["safe checkpoint", "NO_CHANGE", "participant's application",
    "without repeating accepted work", "trust-boundary changes remain human-owned"])
    assert.ok(requirement.action.includes(phrase), phrase);
  assert.match(await read("docs/FRAMEWORK.md"), /current-action-and-bounded-repair/);
  assert.match(await read("docs/FRAMEWORK_RU.md"), /current-action-and-bounded-repair/);
});

// Instruction contracts only: these checks do not prove a model follows them.
test("recovery separates progress, authority and hard limits without a global fix quota", async () => {
  const routing = await read("docs/workflows/context-routing.md");
  for (const phrase of ["not all successive defects", "not product acceptance",
    "explicit hard resource limits", "platform and enrolled runtime limits remain binding",
    "reassess the whole route", "Isolation or reversibility alone grants no authority",
    "UNKNOWN blocks replay", "no review merely for another local fix",
    "does not guarantee a numerical spending ceiling"])
    assert.ok(routing.includes(phrase), phrase);
  assert.ok(!routing.includes("Keep finite whole-task attempts, escalations and cost"));
  const manifest = JSON.parse(await read("vydykhai.json"));
  assert.match(manifest.adoptionRequirements.find(r => r.id === "context-routing").action,
    /replace invented global correction quotas without resetting expenditure/);
});
test("substantive failure routes to causal reframe before correction, not every red test", async () => {
  const routing = await read("docs/workflows/context-routing.md");
  const section = routing.split("## Reframe After Failure\n")[1].split("## Fit With Existing Work")[0];
  for (const phrase of ["Before the first substantive correction", "Obvious local typos and expected red tests stay local",
    "input -> transformation -> output -> consumer -> check", "at most two materially different alternatives",
    "existing brief/checkpoint", "new causal hypothesis", "discriminating check, owner, budget/checkpoint and stop condition",
    "not a changed approach", "not another analysis round"])
    assert.ok(section.includes(phrase), phrase);
  for (const file of ["docs/workflows/framework-orchestrator.md", "docs/workflows/module-delivery.md",
    "docs/AGENTS_CORE.md"])
    assert.match(await read(file), /reframe-after-failure/);
});

test("changed attempt preserves authority, evaluator integrity and independent acceptance", async () => {
  const routing = await read("docs/workflows/context-routing.md");
  for (const phrase of ["UNKNOWN is not replay authority", "does not authorize closed-module internals or new access",
    "never bypass an adopted protection boundary", "preserving acceptance criteria and unaffected evidence",
    "independent contract-based evidence and negative cases", "never a weaker criterion just to pass",
    "cannot independently accept it", "Independent safe work continues", "explicit pauses retain human control"])
    assert.ok(routing.includes(phrase), phrase);
});

test("capability escalation is not automatic and cannot reset a failed episode", async () => {
  const routing = await read("docs/workflows/context-routing.md");
  for (const phrase of ["one bounded changed attempt", "stop automatic redispatch for that cause",
    "falsified hypothesis or missing input/access", "named reasoning/implementation capability gap",
    "without a sacrificial weak attempt", "do not reset attempts or grant more budget",
    "No permanent re-preparer", "not automatic promotion after any failure"])
    assert.ok(routing.includes(phrase), phrase);
  assert.doesNotMatch(routing, /if that fails the same success criterion, use High/);
});

test("reframe adoption requires natural application and retains missing proof, not manufactured retries", async () => {
  const manifest = JSON.parse(await read("vydykhai.json"));
  const requirement = manifest.adoptionRequirements.find(r => r.id === "resume-or-checkpoint");
  for (const phrase of ["before the first substantive correction", "affected executor's instruction and brief application",
    "one natural recovery", "do not manufacture a failure or repeat accepted work",
    "Missing or stale application proof stays pending", "deferred behavioral proof, not demonstrated recovery",
    "shared publication/memory route and participant readback", "no mandatory refactor"])
    assert.ok(requirement.action.includes(phrase), phrase);
  assert.equal(manifest.agentRoutingPolicy.effortPolicy.orchestrator.escalateWhen,
    "control-failure-after-one-targeted-correction", "legacy policy marker remains compatible; routing qualifies its meaning");
});
