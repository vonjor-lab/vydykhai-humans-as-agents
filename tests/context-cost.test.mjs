import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { estimateContextRoutes } from "../scripts/context-cost.mjs";

const input = () => ({ schema: "context.cost.v1", owner: "manager", taskId: "task-1",
  rates: [{ id: "standard", model: "example-capable-model", speed: "standard", checkedAt: "2026-01-01", source: "published rate card",
    input: 10, cachedInput: 1, output: 20 }],
  routes: [{ id: "prepared", eligible: true, evidence: "Retained and new task-class tests passed", unknownCosts: [],
    stages: ["preparation", "execution", "review", "recovery", "coordination"].map(purpose => ({ purpose, rateId: "standard", effort: "low",
      inputTokens: 1000, cachedInputTokens: 500, outputTokens: 100, basis: "Comparable observed run including coordinator" })) }] });

test("whole-chain credit estimate counts cached input once and never claims subscription savings", () => {
  const result = estimateContextRoutes(input());
  assert.equal(result.status, "ESTIMATED");
  assert.ok(Math.abs(result.routes[0].knownCredits - 0.0375) < 1e-12);
  assert.equal(result.bestEstimatedRoute, "prepared");
  assert.equal(result.subscriptionUsage, "UNKNOWN");
  assert.equal(result.ownerReviewRequired, true);
});

test("unknown coordinator or recovery cost prevents a false cheapest-route conclusion", () => {
  const v = input(); v.routes[0].stages.pop();
  assert.equal(estimateContextRoutes(v).status, "PARTIAL");
  assert.equal(estimateContextRoutes(v).bestEstimatedRoute, null);
  assert.match(estimateContextRoutes(v).routes[0].unknownCosts.join(), /coordination/);
  v.routes[0].unknownCosts.push("Unmeasured retries");
  assert.equal(estimateContextRoutes(v).bestEstimatedRoute, null);
});

test("cheaper unproven route is excluded from owner comparison", () => {
  const v = input(); const cheap = structuredClone(v.routes[0]); cheap.id = "unproven"; cheap.eligible = false;
  for (const s of cheap.stages) s.inputTokens = s.cachedInputTokens = s.outputTokens = 0;
  v.routes.push(cheap);
  assert.equal(estimateContextRoutes(v).bestEstimatedRoute, "prepared");
  v.routes[0].eligible = false;
  assert.equal(estimateContextRoutes(v).bestEstimatedRoute, null);
});

for (const [name, mutate] of [
  ["negative rate", v => v.rates[0].input = -1],
  ["unknown rate", v => v.routes[0].stages[0].rateId = "missing"],
  ["cache greater than input", v => v.routes[0].stages[0].cachedInputTokens = 1001],
  ["invalid token count", v => v.routes[0].stages[0].inputTokens = 0.5],
  ["missing rate evidence", v => v.rates[0].source = ""],
  ["duplicate route", v => v.routes.push(structuredClone(v.routes[0]))],
]) test(`cost rejects ${name}`, () => { const v = input(); mutate(v); assert.throws(() => estimateContextRoutes(v), /COST_/); });

test("estimate command is read-only and creates no preparation directory or action", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "context-cost-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "cost.json"), JSON.stringify(input()));
  const command = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/vydykhai.mjs", import.meta.url)), "context-prepare", "estimate", "--input", "cost.json"], { cwd: root, encoding: "utf8" });
  assert.equal(command.status, 0, command.stderr);
  const result = JSON.parse(command.stdout);
  assert.equal(result.status, "ESTIMATED", JSON.stringify(result));
  assert.deepEqual(await readdir(root), ["cost.json"]);
});
