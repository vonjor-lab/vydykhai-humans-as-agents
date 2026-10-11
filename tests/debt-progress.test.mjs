import test from "node:test";
import assert from "node:assert/strict";
import {assessDebtProgress} from "../scripts/debt-progress.mjs";

const item = id => ({id, criterion: `original-${id}`, owner: "worker", evidence: "source",
  origin: "INHERITED", originEvidence: "baseline", severity: "NORMAL", status: "OPEN",
  reviewAt: 1000, attempts: 0});
const close = r => ({...r, status: "CLOSED", closure: {evidence: "independent-recheck", reviewer: "reviewer", criterion: r.criterion}});
function input() {
  const before = {scope: "project", evidence: "observation-1", at: 100, items: [item("a"), item("b")]};
  return {before, after: {...structuredClone(before), evidence: "observation-2", at: 200},
    outcomes: [{id: "accepted-increment", evidence: "public-use-proof", scope: "project", at: 200}], stagnantWindows: 0,
    policy: {evidence: "accepted-health-policy", windowMs: 100, maxStagnantWindows: 2}};
}
test("missing observations produce an explicit reconciliation, not an exception", () => {
  for (const value of [undefined, null, {}, {before: null, after: null}]) {
    assert.equal(assessDebtProgress(value).action, "RECONCILE_EVIDENCE");
  }
});
test("stale, foreign or undated product outcomes cannot conceal a maintenance-only window", () => {
  for (const mutate of [r => r.scope = "other-project", r => r.at = 50,
    r => r.at = 100, r => r.at = 201, r => delete r.at, r => delete r.scope]) {
    const x = input(); x.after.items[0] = close(x.after.items[0]); mutate(x.outcomes[0]);
    assert.equal(assessDebtProgress(x).action, "RECONCILE_EVIDENCE");
  }
  const x = input(); x.after.items[0] = close(x.after.items[0]);
  assert.equal(assessDebtProgress(x).action, "PROGRESS_RECORDED");
});
test("sparse and explicit missing rows cannot count as product outcomes or valid debt", () => {
  for (const rows of [Array(1), [undefined], [null]]) {
    for (const target of ["outcomes", "before", "after"]) {
      const x = input(); x.after.items[0] = close(x.after.items[0]);
      if (target === "outcomes") x.outcomes = rows;
      else x[target].items = rows;
      assert.equal(assessDebtProgress(x).action, "RECONCILE_EVIDENCE");
    }
  }
});
test("old debt reduction and product progress remain distinct from discovered/new debt", () => {
  const x = input(); x.after.items[0] = close(x.after.items[0]);
  x.after.items.push({...item("c"), origin: "DISCOVERED", originEvidence: "new-survey"});
  const before = structuredClone(x); const r = assessDebtProgress(x);
  assert.equal(r.action, "PROGRESS_RECORDED"); assert.equal(r.metrics.currentOpen, 2);
  assert.equal(r.metrics.baselineClosed, 1); assert.equal(r.metrics.discovered, 1);
  assert.deepEqual(x, before); assert.equal(r.mutationAuthorized, false);
});
test("deleted, renamed, reweighted or reset debt cannot improve trend", () => {
  for (const mutate of [x => x.after.items.pop(), x => x.after.items[0].id = "renamed",
    x => x.after.items[0].criterion = "easier", x => x.after.items[0].severity = "HIGH",
    x => x.after.items[0].origin = "CREATED", x => x.after.items[0].originEvidence = "new-origin",
    x => {x.before.items[0].attempts = 1; x.after.items[0].attempts = 0;}]) {
    const x = input(); mutate(x); assert.equal(assessDebtProgress(x).action, "RECONCILE_EVIDENCE");
  }
});
test("deferral and accepted risk do not count as repaired debt", () => {
  const x = input(); x.after.items[0].status = "DEFERRED"; x.after.items[1].status = "ACCEPTED_RISK";
  x.stagnantWindows = 1;
  const r = assessDebtProgress(x); assert.equal(r.action, "PRIORITY_REVIEW");
  assert.equal(r.metrics.baselineClosed, 0); assert.equal(r.metrics.deferred, 1);
  assert.equal(r.metrics.acceptedRisk, 1);
});
test("closure requires original criterion and independent proof", () => {
  for (const mutate of [r => r.closure.evidence = "", r => r.closure.reviewer = r.owner,
    r => r.closure.criterion = "other"]) {
    const x = input(); x.after.items[0] = close(x.after.items[0]); mutate(x.after.items[0]);
    assert.equal(assessDebtProgress(x).action, "RECONCILE_EVIDENCE");
  }
});
test("new unresolved debt cannot be hidden by closing one old item", () => {
  const x = input(); x.after.items[0] = close(x.after.items[0]);
  for (const id of ["c", "d"]) x.after.items.push({...item(id), origin: "CREATED", originEvidence: "current-change"});
  assert.equal(assessDebtProgress(x).action, "PRIORITY_REVIEW");
});
test("critical or overdue debt is not averaged away by many normal closures", () => {
  const x = input(); x.after.items[0] = close(x.after.items[0]);
  x.before.items[1].severity = x.after.items[1].severity = "CRITICAL";
  assert.equal(assessDebtProgress(x).action, "PRIORITY_REVIEW");
  const y = input(); y.before.items[0].reviewAt = y.after.items[0].reviewAt = 199;
  assert.equal(assessDebtProgress(y).action, "PRIORITY_REVIEW");
});
test("postponing a deadline needs retained decision and does not count as progress", () => {
  const x = input(); x.after.items[0].reviewAt = 2000;
  assert.equal(assessDebtProgress(x).action, "RECONCILE_EVIDENCE");
  x.after.items[0].reschedule = {previous: 1000, next: 2000, decision: "authorized-scope-defer", evidence: "decision-source"};
  assert.equal(assessDebtProgress(x).metrics.baselineClosed, 0);
});
test("healthy controls and short windows avoid compulsory maintenance", () => {
  const x = input(); x.after.at = 150; x.outcomes[0].at = 150;
  assert.equal(assessDebtProgress(x).action, "WINDOW_NOT_COMPLETE");
  const y = input(); y.before.items = []; y.after.items = [];
  assert.equal(assessDebtProgress(y).action, "NO_DEBT_RECORDED");
  assert.equal(assessDebtProgress(input()).action, "OWNED_DEBT_REMAINS");
});
test("three increments distinguish progress, hidden postponement and recovered balance", () => {
  const x = input(); x.after.items[0] = close(x.after.items[0]);
  assert.equal(assessDebtProgress(x).action, "PROGRESS_RECORDED");
  const second = {...x, before: structuredClone(x.after), after: {...structuredClone(x.after), at: 300}, stagnantWindows: 1};
  second.outcomes = [{id: "second-increment", evidence: "second-proof", scope: "project", at: 300}];
  second.after.items[1].status = "DEFERRED";
  assert.equal(assessDebtProgress(second).action, "PRIORITY_REVIEW");
  const third = {...second, before: structuredClone(second.after), after: {...structuredClone(second.after), at: 400}};
  third.outcomes = [{id: "third-increment", evidence: "third-proof", scope: "project", at: 400}];
  third.after.items[1] = close(third.after.items[1]);
  assert.equal(assessDebtProgress(third).action, "PROGRESS_RECORDED");
  third.outcomes = []; assert.equal(assessDebtProgress(third).action, "REVIEW_PRODUCT_BALANCE");
});
