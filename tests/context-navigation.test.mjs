import test from "node:test";
import assert from "node:assert/strict";
import { prepareNavigation as validateNavigation } from "../scripts/context-navigation.mjs";
const prepareNavigation = (p, task, read, contracts = ["contract.md"]) => validateNavigation(p, task, read, contracts);

const task = { id: "task-1", worker: "worker-1" };
const read = async () => Buffer.from("Keep accepted output.\nPreparation is read-only.\n");
const packet = () => ({ taskId: task.id, worker: task.worker, preparedBy: "preparer-1", outcome: "Extend without losing accepted output",
  references: [
    { id: "contract", path: "contract.md", startLine: 1, endLine: 1, quote: "Keep accepted output.", purpose: "Invariant", appliesTo: "task" },
    { id: "local", path: "contract.md", startLine: 2, endLine: 2, quote: "Preparation is read-only.", purpose: "Local authority", appliesTo: "preparation" },
  ], constraints: [
    { text: "Keep accepted output.", appliesTo: "task", referenceIds: ["contract"] },
    { text: "Do not implement.", appliesTo: "preparation", referenceIds: ["local"] },
  ], gaps: [] });

test("preparation authority is reviewed but not forwarded as executor authority", async () => {
  const result = await prepareNavigation(packet(), task, read);
  assert.deepEqual(result.references.map(r => r.id), ["contract"]);
  assert.equal(result.constraints.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /read-only|Do not implement/);
  assert.match(result.references[0].sha256, /^[0-9a-f]{64}$/);
});

test("real task-wide read-only authority is preserved, not removed by keyword filtering", async () => {
  const p = packet(); p.constraints[0].text = "Task is read-only under human authority.";
  assert.match((await prepareNavigation(p, task, read)).constraints[0].text, /read-only/);
});

for (const [name, mutate, code] of [
  ["wrong task", p => p.taskId = "other", "NAVIGATION_IDENTITY_INVALID"],
  ["same preparer and worker", p => p.preparedBy = task.worker, "NAVIGATION_IDENTITY_INVALID"],
  ["out-of-range citation", p => p.references[0].endLine = 3, "NAVIGATION_LINE_RANGE_INVALID"],
  ["unsupported quote", p => p.references[0].quote = "Invented rationale", "NAVIGATION_QUOTE_MISMATCH"],
  ["duplicate reference", p => p.references[1].id = "contract", "NAVIGATION_REFERENCE_INVALID"],
  ["unscoped rule", p => delete p.constraints[0].appliesTo, "NAVIGATION_CONSTRAINT_INVALID"],
  ["local rule relabeled for executor", p => p.constraints[1].appliesTo = "task", "NAVIGATION_ROLE_CONFLICT"],
  ["unknown reference", p => p.constraints[0].referenceIds = ["missing"], "NAVIGATION_CONSTRAINT_INVALID"],
  ["critical missing history", p => p.gaps.push({ text: "Missing accepted decision", critical: true }), "NAVIGATION_CRITICAL_GAP"],
]) test(name, async () => {
  const p = packet(); mutate(p);
  await assert.rejects(prepareNavigation(p, task, read), { message: code });
});

test("noncritical evidence limits stay visible", async () => {
  const p = packet(); p.gaps.push({ text: "No comparative quota measurement", critical: false });
  assert.deepEqual((await prepareNavigation(p, task, read)).gaps, p.gaps);
});

test("found code is not proof of an independently required module contract", async () => {
  await assert.rejects(prepareNavigation(packet(), task, read, []), { message: "NAVIGATION_CONTRACT_ROUTE_MISSING" });
  await assert.rejects(prepareNavigation(packet(), task, read, ["unread-contract.md"]), { message: "NAVIGATION_CONTRACT_UNREAD" });
});
