import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const recall = read("docs/workflows/memory-recall.md");

// Contract wiring checks, not evidence that a model recalls or applies meaning.
test("first hint routes to existing reflection without a global rebuild", () => {
  for (const text of ["The first human hint", "not proof of a particular historical decision",
    "not every node in the project", "No whole-history inventory", "independent work continues"])
    assert.ok(recall.includes(text), text);
  for (const path of [".agents/skills/framework-orchestrator/SKILL.md",
    "docs/workflows/project-memory-graph-template.md", "docs/FRAMEWORK.md", "docs/FRAMEWORK_RU.md"])
    assert.ok(read(path).includes("memory-recall.md#memory-understanding-escalation"), path);
});

test("repair closure requires evidence and application, not a rewritten reminder", () => {
  for (const text of ["ABSENT", "RETRIEVAL_MISS", "APPLICATION_MISS", "VERIFICATION_MISS",
    "source -> graph -> retrieval -> application -> verification", "Attempts and costs do not reset",
    "repairer cannot accept their own repair", "stored readback", "ordinary unhinted retrieval",
    "never retrieve secret values", "keep the gap owned and open"])
    assert.ok(recall.includes(text), text);
});

test("material context can change without losing semantic obligations or task history", () => {
  for (const text of ["semantic meaning", "material selection", "retain applicable meaning",
    "Parking does not delete memory", "never replay an uncertain action"])
    assert.ok(recall.includes(text), text);
  const routing = read("docs/workflows/context-routing.md");
  assert.ok(routing.includes("unless the authorized safe-boundary context pivot"));
  assert.ok(routing.includes("preserve logical task, effects and spend"));
  for (const path of ["docs/FRAMEWORK.md", "docs/workflows/framework-orchestrator.md"])
    assert.ok(!read(path).includes("After adoption into an existing project or a proven memory miss,"), path);
});
