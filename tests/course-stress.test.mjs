import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, writeFile, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {verifyComposition} from "./fixtures/course-stress/oracle.mjs";
import {classifyCheckpointReviews} from "../scripts/checkpoint-review.mjs";
import {createReturnSync, createReturnRoute, validateDurableOutbox} from "../scripts/vydykhai.mjs";

const faulty = fileURLToPath(new URL("./fixtures/course-stress/work/composite.mjs", import.meta.url));
async function workspace(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "course-stress-"));
  t.after(() => rm(dir, {recursive: true, force: true}));
  return dir;
}

test("stress oracle rejects green count-only composition after real cold reopen", async t => {
  const result = await verifyComposition(faulty, await workspace(t));
  assert.equal(result.oldCountSmoke, true);
  assert.equal(result.status, "FAIL");
  assert.equal(result.coldProcess, true);
  assert.equal(result.childExit, 0);
  assert.equal(result.checks.filter(c => c.id.startsWith("identity-") && !c.pass).length, 4);
});

test("stress oracle distinguishes correct integration from hardcoded owner and ambiguous query repairs", async t => {
  const root = await workspace(t);
  const correct = `export function buildArchive(items){return items.map(({owner,id,payload})=>({owner,id,payload}));}
    export function lookup(records,q){if(!q.owner||!q.id)return null;
      return records.find(r=>r.owner===q.owner&&r.id===q.id)??null;}`;
  const variants = [
    ["correct", correct, "PASS"],
    ["one-owner", correct.replace("({owner,id,payload}));", '({owner:"red",id,payload}));'), "FAIL"],
    ["id-only", correct.replace("r.owner===q.owner&&", ""), "FAIL"],
    ["ambiguous-tuple", correct.replace("r.owner===q.owner&&r.id===q.id", '(r.owner+":"+r.id)===(q.owner+":"+q.id)'), "FAIL"],
  ];
  for (const [name, source, status] of variants) {
    const modulePath = path.join(root, `${name}.mjs`);
    await writeFile(modulePath, source);
    const result = await verifyComposition(modulePath, await workspace(t));
    assert.equal(result.status, status, name);
  }
});

test("stress coordinator retains due review until consumed and settled; duplicate close is quiet", () => {
  const cp = {id: "course-cp", owner: "independent-reviewer", dueAt: "2026-01-01T10:00:00Z",
    expected: "independent current-contract disposition", receiptId: "course-return",
    authority: "approved-isolated-course-review"};
  const lease = {work: "course-work integration", owner: cp.owner, state: "WORKING",
    checkpointText: JSON.stringify(cp)};
  const options = {now: Date.parse("2026-01-01T11:00:00Z")};
  const check = (outbox, state = "WORKING") => classifyCheckpointReviews({
    leases: [{...lease, state}], orchestrator: "outcome-owner", outbox: validateDurableOutbox(outbox),
  }, options);
  assert.equal(check("").action, "REVIEW_DUE");
  assert.equal(check("").reviews[0].recipient, "outcome-owner",
    "the existing classifier notifies the orchestrator; it does not independently dispatch semantic review");
  const receipt = createReturnSync({status: "ACCEPT", returnReceiptId: cp.receiptId,
    taskContextArtifact: `${cp.owner} / cold-process-evidence`, memoryCandidates: "NO_MEMORY_DELTA",
    artifactDisposition: "retained", recommendedNextAction: "consume verified result"});
  assert.equal(check(receipt).reviews[0].status, "RECEIPT_PRESENT");
  const route = createReturnRoute({returnReceiptId: cp.receiptId, consumer: "outcome-owner",
    routedNextAction: "next authorized consumer", evidence: "independent-current-contract-verification"});
  const delivered = `${receipt}\n${route}`;
  assert.equal(check(delivered).action, "REVIEW_DUE", "delivery alone does not settle the active obligation");
  for (let i = 0; i < 3; i++) assert.equal(check(delivered, "CLOSED").action, "NOOP");
  assert.equal(check(delivered, "CLOSED").taskCompletion, "NOT_EVALUATED",
    "mechanical route is not proof of semantic acceptance or autonomous triggering");
});
