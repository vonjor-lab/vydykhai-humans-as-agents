import test from "node:test";
import assert from "node:assert/strict";
import {evaluateControlCadence} from "../scripts/control-cadence.mjs";

const resetAt = Date.parse("2026-10-07T12:00:00.000Z");
const observedAt = resetAt - 1000;
const observation = {trusted:true, resetAt, observedAt, source:"allowance-observer",
  evidence:"fixture:observed-window-reset"};
const options = overrides => ({observation, now:resetAt, previousCompletedResetEpoch:null,
  maxObservationAgeMs:2000, followupOwner:"control-owner", ...overrides});
const evaluate = overrides => evaluateControlCadence(options(overrides));

function unknown(input, reason) {
  const result = evaluate(input);
  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.due, false);
  assert.equal(result.periodic.status, "UNKNOWN");
  assert.equal(result.periodic.reason, reason);
  assert.equal(result.periodic.nextDueAt, null);
  assert.equal(result.followup.owner, "control-owner");
  assert.equal(result.followup.reason, reason);
  assert.ok(result.followup.action);
  return result;
}

test("only the supplied observed reset is due, inclusive at the crossing boundary", () => {
  for (const [now, status, due] of [[resetAt - 1, "WAITING", false],
    [resetAt, "DUE", true], [resetAt + 1, "DUE", true]]) {
    const result = evaluate({now});
    assert.equal(result.due, due);
    assert.equal(result.periodic.status, status);
    assert.equal(result.status, due ? "REVIEW_DUE" : "WAITING");
    assert.equal(result.periodic.resetEpoch, resetAt);
    assert.equal(result.periodic.nextDueAt, due ? null : resetAt);
    assert.equal(result.followup, null);
  }
});

test("freshness is inclusive at its explicit bound, unknown immediately beyond it", () => {
  assert.equal(evaluate({now:observedAt + 2000}).due, true);
  const stale = unknown({now:observedAt + 2001}, "RESET_OBSERVATION_STALE");
  assert.deepEqual(stale.periodic.observation, observation);
});

test("missing, untrusted or unattributed evidence remains unknown with owned follow-up", () => {
  for (const missing of [undefined, null]) unknown({observation:missing}, "RESET_OBSERVATION_MISSING");
  for (const trusted of [undefined, false, "true", 1]) {
    unknown({observation:{...observation, trusted}}, "RESET_OBSERVATION_UNTRUSTED");
  }
  for (const field of ["source", "evidence"]) {
    for (const value of [undefined, null, "", " ", 42]) {
      unknown({observation:{...observation, [field]:value}}, "RESET_SOURCE_EVIDENCE_MISSING");
    }
  }
});

test("strict timestamps reject coercion, ambiguous units-as-strings and calendar rollover", () => {
  const invalid = [undefined, null, NaN, Infinity, -1, 1.5, 8640000000000001,
    "", String(resetAt), "2026-10-07", "2026-10-07T12:00:00", "2026-02-30T12:00:00Z", {}, new Date(resetAt)];
  for (const value of invalid) {
    unknown({now:value}, "NOW_INVALID");
    for (const field of ["observedAt", "resetAt"]) {
      unknown({observation:{...observation, [field]:value}}, "RESET_OBSERVATION_TIME_INVALID");
    }
    if (value !== null && value !== undefined) {
      unknown({previousCompletedResetEpoch:value}, "COMPLETED_RESET_INVALID");
    }
  }
});

test("UTC ISO timestamps normalize to the same reset epoch, including completion deduplication", () => {
  const iso = {observation:{...observation, resetAt:"2026-10-07T12:00:00Z",
    observedAt:"2026-10-07T11:59:59.000Z"}, now:"2026-10-07T12:00:00.000Z"};
  assert.deepEqual(evaluate(iso), evaluate());
  assert.equal(evaluate({...iso, previousCompletedResetEpoch:"2026-10-07T12:00:00Z"}).due, false);
  assert.equal(evaluate({observation:{...observation, observedAt:resetAt}}).due, true);
  assert.equal(evaluate({observation:{...observation, resetAt:0, observedAt:0}, now:0}).due, true);
});

test("time reversal and regressed reset epochs do not invent a fresh window", () => {
  unknown({now:observedAt - 1}, "TIME_BEFORE_OBSERVATION");
  unknown({previousCompletedResetEpoch:resetAt + 1}, "TIME_BEFORE_COMPLETED_RESET");
  unknown({observation:{...observation, resetAt:observedAt - 1}}, "RESET_BEFORE_OBSERVATION");
  unknown({now:resetAt + 2, previousCompletedResetEpoch:resetAt + 1}, "RESET_EPOCH_REGRESSED");
  const done = {previousCompletedResetEpoch:resetAt};
  assert.equal(evaluate(done).periodic.status, "COMPLETED");
  unknown({...done, now:resetAt - 1}, "TIME_BEFORE_COMPLETED_RESET");
});

test("completed epochs never redispatch; only a newly observed later epoch can become due", () => {
  const done = {previousCompletedResetEpoch:resetAt};
  for (const now of [resetAt, resetAt + 1, resetAt + 1000]) {
    const result = evaluate({...done, now});
    assert.equal(result.due, false);
    assert.equal(result.periodic.status, "COMPLETED");
    assert.equal(result.periodic.nextDueAt, null);
  }
  // Refreshed evidence for the same epoch still cannot authorize another review.
  assert.equal(evaluate({...done, observation:{...observation, observedAt:resetAt,
    evidence:"fixture:read-back-again"}}).due, false);
  const nextReset = resetAt + 10000;
  const next = {...done, observation:{...observation, observedAt:nextReset - 1000, resetAt:nextReset}};
  assert.equal(evaluate({...next, now:nextReset - 1}).periodic.status, "WAITING");
  assert.equal(evaluate({...next, now:nextReset}).due, true);
  assert.equal(evaluate({...next, now:nextReset, previousCompletedResetEpoch:nextReset}).due, false);
});

test("no future repeated reset, catch-up schedule or completion is inferred", () => {
  const farFuture = resetAt + 30 * 86400000;
  assert.equal(evaluate({now:farFuture, maxObservationAgeMs:farFuture - observedAt}).periodic.resetEpoch, resetAt);
  assert.equal(evaluate({now:farFuture, maxObservationAgeMs:farFuture - observedAt}).due, true);
  const done = evaluate({now:farFuture, previousCompletedResetEpoch:resetAt,
    maxObservationAgeMs:farFuture - observedAt});
  assert.equal(done.due, false);
  assert.equal(done.periodic.nextDueAt, null);
  unknown({now:farFuture, previousCompletedResetEpoch:resetAt}, "RESET_OBSERVATION_STALE");
  assert.deepEqual(evaluate(), evaluate()); // A due decision is not completed work.
});

test("nonreset failure triggers are immediate before reset and after epoch completion", () => {
  for (const overrides of [{now:resetAt - 1}, {previousCompletedResetEpoch:resetAt}, {}]) {
    const result = evaluate({...overrides, failureTriggers:["review-failed", "custody-lost", "review-failed"]});
    assert.equal(result.status, "REVIEW_DUE");
    assert.equal(result.due, true);
    assert.deepEqual(result.failureTriggers, ["review-failed", "custody-lost"]);
    assert.equal(result.followup, null);
  }
});

test("unknown cadence never suppresses safety triggers or erases its owned follow-up", () => {
  for (const overrides of [{observation:null}, {now:resetAt + 1001}, {now:NaN},
    {observation:{...observation, trusted:false}}, {previousCompletedResetEpoch:"bad"},
    {now:observedAt - 1}, {previousCompletedResetEpoch:resetAt + 1}]) {
    const result = evaluate({...overrides, failureTriggers:["urgent-failure"]});
    assert.equal(result.status, "REVIEW_DUE");
    assert.equal(result.due, true);
    assert.equal(result.periodic.status, "UNKNOWN");
    assert.equal(result.periodic.nextDueAt, null);
    assert.equal(result.followup.owner, "control-owner");
    assert.deepEqual(result.failureTriggers, ["urgent-failure"]);
  }
});

test("pause blocks dispatch but retains periodic, failure and unknown work until resumed", () => {
  for (const overrides of [{}, {now:resetAt - 1}, {previousCompletedResetEpoch:resetAt},
    {observation:null}, {now:resetAt + 1001}]) {
    for (const failureTriggers of [[], ["review-failed"]]) {
      const input = {...overrides, failureTriggers};
      const resumed = evaluate(input), paused = evaluate({...input, paused:true});
      assert.equal(paused.status, "PAUSED");
      assert.equal(paused.due, false);
      assert.deepEqual(paused.periodic, resumed.periodic);
      assert.deepEqual(paused.failureTriggers, resumed.failureTriggers);
      assert.deepEqual(paused.followup, resumed.followup);
      assert.deepEqual(evaluate({...input, paused:false}), resumed);
    }
  }
});

test("explicit bounded freshness, owner, pause and trigger configuration is required", () => {
  assert.throws(() => evaluateControlCadence(), /CONTROL_CADENCE_CONFIG_INVALID/);
  for (const maxObservationAgeMs of [undefined, null, 0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => evaluate({maxObservationAgeMs}), /CONTROL_CADENCE_CONFIG_INVALID/);
  }
  for (const followupOwner of [undefined, null, "", " ", 1]) {
    assert.throws(() => evaluate({followupOwner}), /CONTROL_CADENCE_CONFIG_INVALID/);
  }
  for (const paused of [null, 0, "false"]) {
    assert.throws(() => evaluate({paused}), /CONTROL_CADENCE_CONFIG_INVALID/);
  }
  for (const failureTriggers of [null, "failed", [""], [1]]) {
    assert.throws(() => evaluate({failureTriggers}), /CONTROL_CADENCE_CONFIG_INVALID/);
  }
});

test("evaluation is deterministic and independent of ambient time, with no input or budget mutation", () => {
  const input = options({failureTriggers:["review-failed"], budget:{remaining:0, maxCalls:1}});
  const before = structuredClone(input);
  Object.freeze(input.observation);
  Object.freeze(input.failureTriggers);
  Object.freeze(input.budget);
  Object.freeze(input);
  const realNow = Date.now;
  let first, second;
  try {
    Date.now = () => {throw Error("AMBIENT_CLOCK_FORBIDDEN");};
    first = evaluateControlCadence(input);
    second = evaluateControlCadence(input);
  } finally {Date.now = realNow;}
  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  first.failureTriggers.push("caller-local-change");
  first.periodic.observation.source = "caller-local-change";
  assert.deepEqual(evaluateControlCadence(input), second);
  assert.equal(input.budget.remaining, 0);
  assert.equal(Object.hasOwn(second, "budget"), false);
  assert.equal(Object.hasOwn(second, "previousCompletedResetEpoch"), false);
});
