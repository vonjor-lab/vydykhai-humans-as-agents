import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { classifyCheckpointReviews } from "../scripts/checkpoint-review.mjs";
import { evaluateCheckpointReview, checkpointNoticeStillDue, createReturnSync, createReturnRoute,
  validateDurableOutbox } from "../scripts/vydykhai.mjs";

const now = Date.parse("2026-01-01T12:00:00Z");
const checkpoint = { id: "CP-1", owner: "worker-one", dueAt: "2026-01-01T11:50:00Z",
  expected: "verified task result or concrete blocker", receiptId: "RETURN-1", authority: "accepted-work-contract" };
const lease = (overrides = {}) => ({ work: "WORK-1 [DOD] close flow", state: "WORKING", owner: "worker-one",
  checkpointText: JSON.stringify(checkpoint), ...overrides });
function state(rows = [lease()], next = {}) {
  return `<!-- vydykhai:project-state v2 -->
## Control Snapshot
Orchestrator health: HEALTHY | Context: manager-one | Profile: ORCHESTRATOR / maximum
## Execution Leases
| Work | State | Owner | Repo | Baseline | DOD | Next receipt or review-by | Return route |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map(r => `| ${r.work} | ${r.state} | ${r.owner} | repo | base | outcome | ${r.checkpointText} | outbox |`).join("\n")}
## Pending Return Inbox
## Next-Best-Action
\`\`\`json
${JSON.stringify({ schemaVersion: 1, id: "NEXT-1", work: "WORK-1", action: "deliver accepted increment",
    owner: "worker-one", state: "WORKING", evidence: "first-action-receipt", ...next })}
\`\`\`
<!-- vydykhai:project-state:end -->`;
}
const check = (content = state(), outbox = "", options = {}) => evaluateCheckpointReview(content, outbox, { now, ...options });
function receipt(id = checkpoint.receiptId, owner = checkpoint.owner, status = "ACCEPT") {
  return createReturnSync({ status, returnReceiptId: id, taskContextArtifact: `${owner} / result-artifact`,
    memoryCandidates: "NO_MEMORY_DELTA", artifactDisposition: "retained", recommendedNextAction: "reconcile result" });
}
const route = () => createReturnRoute({ returnReceiptId: checkpoint.receiptId, consumer: "manager-one",
  routedNextAction: "reviewed task checkpoint; next authorized step", evidence: "checked-result" });

test("missing expected receipt becomes a review, not inferred idle or recovery", () => {
  const result = check();
  assert.equal(result.action, "REVIEW_DUE"); assert.equal(result.coverage, "CHECKPOINTS_ONLY");
  assert.equal(result.runtimeObservation, "NOT_EVALUATED");
  assert.equal(result.deliveryPermission, "NOT_EVALUATED"); assert.equal(result.taskCompletion, "NOT_EVALUATED");
  assert.equal(result.reviews[0].recipient, "manager-one");
  assert.equal(result.reviews[0].reason, "expected-receipt-not-observed-by-agreed-checkpoint");
});

test("before due time and deliberately waiting, returned, closed, uncertain work stay quiet", () => {
  assert.equal(check(state(), "", { now: now - 3600000 }).action, "NOOP");
  for (const state of ["WAITING", "RETURNED", "CLOSED", "OUTCOME_UNKNOWN"]) {
    const result = classifyCheckpointReviews({ leases: [lease({ state })], orchestrator: "manager-one", outbox: validateDurableOutbox("") }, { now });
    assert.equal(result.action, "NOOP", state); assert.equal(result.reviews[0].status, "QUIET");
  }
  assert.equal(check(state([lease({ state: "WAITING" })], { state: "WAITING", resumeWhen: "human accepts preview" })).action, "NOOP");
});

test("pre-launch manager action can have a checkpoint without pretending execution started", () => {
  const result = check(state([lease({ state: "PREPARED" })], { state: "READY", owner: "manager-one" }));
  assert.equal(result.action, "REVIEW_DUE"); assert.equal(result.taskCompletion, "NOT_EVALUATED");
});

test("missing enrollment is explicit partial coverage, not a global stop", () => {
  const result = check(state([lease(), lease({ work: "WORK-2 side task", owner: "worker-two", checkpointText: "ask later" })]));
  assert.equal(result.action, "REVIEW_DUE"); assert.equal(result.coverage, "LIMITED");
  assert.equal(result.reviews[0].status, "REVIEW_DUE"); assert.equal(result.reviews[1].status, "LIMITED");
  assert.equal(check(state([lease({ checkpointText: "review tomorrow" })])).action, "LIMITED");
});

for (const [name, data] of [
  ["invalid JSON", "{"], ["null JSON", "{\"id\":null}"],
  ["missing authority", JSON.stringify({ ...checkpoint, authority: undefined })],
  ["ambiguous identity whitespace", JSON.stringify({ ...checkpoint, id: "CP-1 " })],
  ["wrong owner", JSON.stringify({ ...checkpoint, owner: "different-worker" })],
  ["local ambiguous date", JSON.stringify({ ...checkpoint, dueAt: "tomorrow" })],
  ["nonexistent calendar date", JSON.stringify({ ...checkpoint, dueAt: "2026-02-30T00:00:00Z" })],
  ["unknown field, including an unhandled pause", JSON.stringify({ ...checkpoint, paused: true })],
]) test(`checkpoint rejects ${name}`, () => { assert.equal(check(state([lease({ checkpointText: data })])).action, "LIMITED"); });

test("duplicate work, checkpoint and receipt bindings cannot select a first accidental match", () => {
  for (const second of [lease(), lease({ work: "WORK-2 other" }),
    lease({ work: "WORK-2 other", checkpointText: JSON.stringify({ ...checkpoint, id: "CP-2" }) })]) {
    const result = check(state([lease(), second]));
    assert.equal(result.action, "LIMITED"); assert.ok(result.reviews.every(r => r.status !== "REVIEW_DUE"));
  }
});

test("a result, blocker or checkpoint follows the existing Return route, never a second notice", () => {
  for (const status of ["ACCEPT", "CHECKPOINT_READY", "BLOCKED", "OUTCOME_UNKNOWN"]) {
    const result = check(state(), receipt(checkpoint.receiptId, checkpoint.owner, status));
    assert.equal(result.action, "NOOP"); assert.equal(result.reviews[0].status, "RECEIPT_PRESENT");
    assert.deepEqual(result.pendingReturnIds, [checkpoint.receiptId]);
  }
  const routed = check(state(), `${receipt()}\n${route()}`);
  assert.equal(routed.action, "NOOP"); assert.deepEqual(routed.pendingReturnIds, []);
  assert.equal(routed.taskCompletion, "NOT_EVALUATED", "receipt presence is not parent closure");
});

test("unavailable, malformed and mismatched evidence is never an empty healthy source", () => {
  for (const outbox of [null, `${receipt()}\n${receipt()}`, route(), receipt(checkpoint.receiptId, "other-worker")]) {
    assert.equal(check(state(), outbox).action, "LIMITED");
  }
  assert.equal(check(state(), receipt("DIFFERENT-RECEIPT")).action, "REVIEW_DUE");
  assert.equal(check(state([lease({ state: "WAITING" })], { state: "WAITING", resumeWhen: "input" }), null).action,
    "LIMITED", "a quiet wait must not certify an unreadable outbox");
});

test("tick, title, unrelated memory or prose changes do not rearm the same occurrence", () => {
  const first = check().reviews[0];
  const changed = check(state([lease({ work: "WORK-1 renamed task", checkpointText: JSON.stringify({ ...checkpoint,
    dueAt: "2026-01-01T11:55:00Z", expected: "updated explanation" }) })], { evidence: "different-evidence-prose" })).reviews[0];
  assert.equal(first.incidentId, changed.incidentId);
  assert.notEqual(first.binding, changed.binding, "material checkpoint change still requires final readback");
  assert.equal(check(state(), "", { now: now + 7200000 }).reviews[0].incidentId, first.incidentId);
});

test("one notice gives the manager response time, then one human checkpoint, never retries", () => {
  const id = check().reviews[0].incidentId;
  const options = { notifiedIncidentIds: [id], noticeTimes: { [id]: new Date(now).toISOString() } };
  const pending = check(state(), "", options);
  assert.equal(pending.action, "NOOP"); assert.equal(pending.reviews[0].status, "NOTICE_PENDING");
  const overdue = check(state(), "", { ...options, now: now + 1800000 });
  assert.equal(overdue.action, "NEEDS_ATTENTION");
  const surfaced = check(state(), "", { ...options, now: now + 3600000, attentionIncidentIds: [id] });
  assert.equal(surfaced.action, "NOOP"); assert.equal(surfaced.reviews[0].preservePending, true);
  assert.equal(surfaced.taskCompletion, "NOT_EVALUATED");
  assert.equal(check(state(), "", { attentionIncidentIds: [id] }).action, "REVIEW_DUE", "an old audit acceptance is not delivery");
});

test("unknown send and rotation cannot start a fresh retry", () => {
  const id = check().reviews[0].incidentId;
  const rotated = state().replace("Context: manager-one", "Context: manager-two");
  assert.equal(check(rotated).reviews[0].incidentId, id);
  assert.equal(check(rotated, "", { uncertainIncidentIds: [id] }).action, "NEEDS_ATTENTION");
  assert.equal(check(rotated, "", { notifiedIncidentIds: [id] }).action, "NEEDS_ATTENTION", "missing send time is not resend permission");
});

test("final preflight cancels after pause, new recipient, new deadline, result or prior send", () => {
  const first = check().reviews[0];
  assert.equal(checkpointNoticeStillDue(first, check()), true);
  for (const current of [
    check(state([lease({ state: "WAITING" })], { state: "WAITING", resumeWhen: "human decision" })),
    check(state().replace("Context: manager-one", "Context: manager-two")),
    check(state([lease({ checkpointText: JSON.stringify({ ...checkpoint, dueAt: "2026-01-02T00:00:00Z" }) })])),
    check(state(), receipt()), check(state(), "", { uncertainIncidentIds: [first.incidentId] }),
  ]) assert.equal(checkpointNoticeStillDue(first, current), false);
});

test("multiple due works retain independent notices and response handling", () => {
  const second = lease({ work: "WORK-2 other", checkpointText: JSON.stringify({ ...checkpoint, id: "CP-2", receiptId: "RETURN-2" }) });
  const content = state([lease(), second]);
  const first = check(content);
  assert.equal(first.reviews.filter(r => r.status === "REVIEW_DUE").length, 2);
  const next = check(content, "", { notifiedIncidentIds: [first.reviews[0].incidentId] });
  assert.equal(next.reviews[0].status, "NEEDS_ATTENTION"); assert.equal(next.reviews[1].status, "REVIEW_DUE");
});

test("closed-loop simulation: missed checkpoint, single notice, root reconciliation, real wait, result and quiet", () => {
  let content = state(), outbox = "", queueCalls = 0;
  const first = check(content).reviews[0];
  assert.ok(checkpointNoticeStillDue(first, check(content))); queueCalls += 1;
  const delivered = { notifiedIncidentIds: [first.incidentId], noticeTimes: { [first.incidentId]: new Date(now).toISOString() } };
  for (let i = 0; i < 5; i++) assert.equal(check(content, outbox, { ...delivered, now: now + i * 60000 }).action, "NOOP");
  // The manager reads the current human decision and records an actual wait.
  content = state([lease({ state: "WAITING" })], { state: "WAITING", resumeWhen: "input availability restored" });
  assert.equal(check(content, outbox, { ...delivered, now: now + 86400000 }).action, "NOOP");
  // Only a sourced change in the task contract arms a new checkpoint.
  content = state([lease({ checkpointText: JSON.stringify({ ...checkpoint, id: "CP-2", authority: "input-restored-approved-resume" }) })]);
  outbox = `${receipt()}\n${route()}`;
  assert.equal(check(content, outbox).action, "NOOP"); assert.equal(queueCalls, 1);
});

test("source helper is pure; no timer, model, provider, file writer or dispatcher is added", async () => {
  const source = await readFile(new URL("../scripts/checkpoint-review.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /node:(?:fs|child_process|http|net)|\bfetch\(|\bsetInterval\(|\bspawn\(/);
});

test("entrypoints choose supported coverage and preserve one return notification owner", async () => {
  for (const name of ["BOOTSTRAP.md", "docs/AGENTS_CORE.md", "docs/workflows/project-launch.md",
    ".agents/skills/project-launch/SKILL.md", ".agents/skills/framework-orchestrator/SKILL.md",
    ".agents/skills/start-work/SKILL.md", "docs/workflows/framework-orchestrator.md"]) {
    const source = await readFile(new URL(`../${name}`, import.meta.url), "utf8");
    assert.match(source, /checkpoint-review-without-runtime-observation/, name);
  }
  for (const name of ["BOOTSTRAP.md", "docs/AGENTS_CORE.md", "docs/workflows/start-work.md",
    "docs/workflows/accept-work.md", ".agents/skills/project-launch/SKILL.md",
    ".agents/skills/start-work/SKILL.md", ".agents/skills/accept-work/SKILL.md",
    ".agents/skills/framework-orchestrator/SKILL.md"]) {
    const source = await readFile(new URL(`../${name}`, import.meta.url), "utf8");
    assert.match(source, /single accepted.*owner/, name);
    assert.match(source, /never parallel Guard delivery/, name);
  }
});
