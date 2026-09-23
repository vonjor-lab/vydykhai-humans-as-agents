import test from "node:test";
import assert from "node:assert/strict";
import { prepareNavigation as validateNavigation, checkPreparationAssignment } from "../scripts/context-navigation.mjs";
import { createHash } from "node:crypto";
const prepareNavigation = (p, task, read, contracts = ["contract.md"]) => validateNavigation(p, task, read, contracts);

const task = { id: "task-1", worker: "worker-1" };
const read = async () => Buffer.from("Keep accepted output.\nPreparation is read-only.\n");
const packet = () => ({ taskId: task.id, worker: task.worker, preparedBy: "preparer-1", outcome: "Extend without losing accepted output",
  assignment: { owner: "owner", requestId: "request-1", question: "Find retained invariants", phase: "initial", previous: null },
  references: [
    { id: "contract", path: "contract.md", startLine: 1, endLine: 1, quote: "Keep accepted output.", purpose: "Invariant", appliesTo: "task" },
    { id: "local", path: "contract.md", startLine: 2, endLine: 2, quote: "Preparation is read-only.", purpose: "Local authority", appliesTo: "preparation" },
  ], constraints: [
    { text: "Keep accepted output.", appliesTo: "task", referenceIds: ["contract"] },
    { text: "Do not implement.", appliesTo: "preparation", referenceIds: ["local"] },
  ], gaps: [] });

test("preparation authority is reviewed but not forwarded as executor authority", async () => {
  const p = packet(); p.assignment.question = "Preparation is read-only. Do not implement.";
  const result = await prepareNavigation(p, task, read);
  assert.deepEqual(result.references.map(r => r.id), ["contract"]);
  assert.equal(result.constraints.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /read-only|Do not implement/);
  assert.match(result.references[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.assignment.question, undefined);
  assert.equal(result.assignment.requestId, p.assignment.requestId);
});

test("quote-only references derive exact coordinates without model-written line numbers", async () => {
  const p = packet();
  for (const r of p.references) { delete r.startLine; delete r.endLine; }
  const result = await prepareNavigation(p, task, read);
  assert.equal(result.references[0].startLine, 1);
  assert.equal(result.references[0].endLine, 1);
});

test("quote resolution handles multiline CRLF, Unicode and final newline without exceeding EOF", async () => {
  const p = packet(); p.references = [{ ...p.references[0], quote: "Accepted \u03b1.\r\nSecond line.\r\n" }];
  delete p.references[0].startLine; delete p.references[0].endLine;
  p.constraints = [p.constraints[0]];
  const result = await prepareNavigation(p, task, async () => Buffer.from("Heading\r\nAccepted \u03b1.\r\nSecond line.\r\n"));
  assert.equal(result.references[0].startLine, 2); assert.equal(result.references[0].endLine, 3);
  assert.equal(result.references[0].quote, "Accepted \u03b1.\nSecond line.\n");
  p.references[0].startLine = 2; p.references[0].endLine = 3;
  assert.deepEqual((await prepareNavigation(p, task, async () => Buffer.from("Heading\r\nAccepted \u03b1.\r\nSecond line.\r\n"))).references, result.references);
});

test("ambiguous or missing quotes require source selection, never fuzzy correction", async () => {
  const p = packet(); p.references = [p.references[0]]; p.constraints = [p.constraints[0]];
  delete p.references[0].startLine; delete p.references[0].endLine;
  await assert.rejects(prepareNavigation(p, task, async () => Buffer.from("Keep accepted output.\nKeep accepted output.\n")), /NAVIGATION_QUOTE_AMBIGUOUS/);
  await assert.rejects(prepareNavigation(p, task, async () => Buffer.from("Changed meaning.\n")), /NAVIGATION_QUOTE_MISMATCH/);
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

test("only the assigned owner can request preparation; initial work has no parent", async () => {
  const a = packet().assignment;
  await checkPreparationAssignment(a, "owner", task, read);
  await assert.rejects(checkPreparationAssignment(a, "other", task, read), /PREPARATION_ASSIGNMENT_INVALID/);
  await assert.rejects(checkPreparationAssignment({ ...a, previous: {} }, "owner", task, read), /PREPARATION_PARENT_INVALID/);
});

test("supplements pin an approved parent and retain exact task, worker, scope and action", async () => {
  const sha = data => createHash("sha256").update(data).digest("hex");
  const fullTask = { ...task, scope: ["module"], action: { executable: "node", args: ["check.mjs"] } };
  const plan = Buffer.from(JSON.stringify({ schema: "context.preparation-plan.v1", owner: "owner", semanticPackage: { task: fullTask } }));
  const approval = Buffer.from(JSON.stringify({ schema: "context.package-approval.v1", owner: "owner", decision: "approved", planSha256: sha(plan) }));
  const files = { plan, approval };
  const a = { ...packet().assignment, phase: "supplement", previous: {
    plan: { path: "plan", sha256: sha(plan) }, approval: { path: "approval", sha256: sha(approval) } } };
  const readParent = async p => files[p];
  await checkPreparationAssignment(a, "owner", fullTask, readParent);
  for (const changed of [{ ...fullTask, worker: "other" }, { ...fullTask, id: "other" }, { ...fullTask, scope: ["wider"] }, { ...fullTask, action: {} }]) {
    await assert.rejects(checkPreparationAssignment(a, "owner", changed, readParent), /PREPARATION_PARENT_MISMATCH/);
  }
  files.approval = Buffer.from(approval.toString().replace("approved", "revoked"));
  await assert.rejects(checkPreparationAssignment(a, "owner", fullTask, readParent), /PREPARATION_PARENT_CHANGED/);
  a.previous.approval.sha256 = sha(files.approval);
  await assert.rejects(checkPreparationAssignment(a, "owner", fullTask, readParent), /PREPARATION_PARENT_MISMATCH/);
});
