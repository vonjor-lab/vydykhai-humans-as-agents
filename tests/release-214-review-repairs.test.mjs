import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
test("review finding: native wait has total bounds and an owned unavailable fallback", () => {
  const text = read("docs/workflows/production-continuation.md");
  for (const clause of ["approved observation deadline/budget", "native waiting is unavailable",
    "owned LIMITED observation gap", "renew the wait allowance automatically"])
    assert.ok(text.includes(clause));
});
test("review findings: dispatch and memory integration cannot bypass scoped routes", () => {
  const text = read("docs/workflows/framework-orchestrator.md");
  assert.ok(text.includes("After the launch receipt, apply production-continuation.md#terminal-delivery-before-turn-release"));
  assert.ok(!text.includes("For existing-project adoption or a proven miss,"));
  assert.ok(text.includes("Local misses instead use memory-recall.md#memory-understanding-escalation"));
  assert.ok(read("docs/AGENTS_CORE.md").includes("Actual migration/rotation retains human-confirmed cutover"));
});
