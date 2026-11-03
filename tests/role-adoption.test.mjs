import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { adoptionEvidenceScope } from "../scripts/adoption-plan.mjs";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("bounded role adoption retains independence, progress and full costs", async () => {
  const route = await read("docs/workflows/context-routing.md");
  for (const phrase of ["accepted project-local model/effort mapping", "owner-approved boundary",
    "one existing independent reviewer role", "fresh review", "reviewer of the preparer",
    "better verified candidate", "UNKNOWN_NONZERO", "one suitable real task",
    "Stop task follow-ups after actual", "input/contract, evaluator, integration/environment",
    "falsified hypothesis or missing input/access", "named reasoning/implementation capability gap"])
    assert.ok(route.includes(phrase), phrase);
  const control = await read("docs/workflows/independent-control.md");
  assert.match(control, /context-routing.md#bounded-role-adoption/);
  assert.match(control, /pending\/UNKNOWN into acceptance/);
});

test("existing adoption carries actual routing proof without a new role", async () => {
  const manifest = JSON.parse(await read("vydykhai.json"));
  const route = manifest.adoptionRequirements.filter(r => r.id === "context-routing");
  assert.equal(route.length, 1);
  assert.match(route[0].action, /actual participant model\/effort/);
  assert.match(route[0].action, /whole-chain spend and unknowns/);
  assert.deepEqual(Object.keys(manifest.agentRoutingPolicy.profiles).sort(),
    ["discovery", "execution", "orchestrator", "preparation"]);
});

test("routing adoption preserves reuse but never accepts missing or stale profile proof", async () => {
  const manifest = JSON.parse(await read("vydykhai.json"));
  const requirement = manifest.adoptionRequirements.find(r => r.id === "context-routing");
  const scope = { targetBundle: "kit", worker: "worker", routingProfile: "accepted",
    sourceRange: "sources", verificationBoundary: "task-class" };
  const prior = adoptionEvidenceScope(requirement, scope);
  const reused = adoptionEvidenceScope(requirement, scope, prior);
  assert.equal(reused.status, "REVIEW_EXISTING_EVIDENCE");
  assert.equal(reused.acceptance, "NOT_ESTABLISHED");
  assert.equal(adoptionEvidenceScope(requirement, { ...scope, routingProfile: "new" }, prior).status,
    "REVIEW_CHANGED_SCOPE");
  assert.equal(adoptionEvidenceScope(requirement, { worker: "worker" }, prior).status, "MISSING_SCOPE");
});
