import assert from "node:assert/strict";
import test from "node:test";
import { evaluateGuardLock, planGuardLockRecovery } from "../scripts/vydykhai.mjs";

const now = Date.parse("2026-01-01T12:00:00Z");
const held = {
  exists: true,
  pid: 42,
  pidAlive: true,
  acquiredAt: "2026-01-01T11:50:00Z",
  hostId: "host-a",
  currentHostId: "host-a",
};

test("lock liveness distinguishes free, live, settling, and stale states", () => {
  assert.equal(evaluateGuardLock({ exists: false }, { now }).status, "FREE");
  assert.equal(evaluateGuardLock(held, { now }).status, "HELD");
  assert.equal(evaluateGuardLock({ ...held, pidAlive: false, acquiredAt: "2026-01-01T11:59:00Z" }, { now }).status, "HELD");
  const stale = evaluateGuardLock({ ...held, pidAlive: false }, { now });
  assert.equal(stale.status, "STALE_RECLAIMABLE");
  assert.equal(stale.ageSeconds, 600);
});

test("unknown pid, malformed time, and cross-host locks remain LIMITED", () => {
  for (const observation of [
    null,
    { exists: true },
    { ...held, pidAlive: undefined },
    { ...held, acquiredAt: "not-a-time" },
    { ...held, currentHostId: "host-b" },
  ]) {
    assert.equal(evaluateGuardLock(observation, { now }).status, "LIMITED");
  }
});

test("stale-lock recovery never replays an unknown external action", () => {
  const stale = evaluateGuardLock({ ...held, pidAlive: false }, { now });
  assert.deepEqual(planGuardLockRecovery(stale, { externalOutcome: "OUTCOME_UNKNOWN" }), {
    action: "BLOCKED",
    replayExternalAction: false,
    reason: "external outcome must be reconciled first",
  });
  assert.deepEqual(planGuardLockRecovery(stale, { externalOutcome: "NO_EXTERNAL_ACTION" }), {
    action: "QUARANTINE_STALE_LOCK_THEN_RECHECK",
    replayExternalAction: false,
    reason: "remove only the stale lock boundary and recompute current control state",
  });
  assert.equal(planGuardLockRecovery({ status: "HELD" }, { externalOutcome: "RECONCILED" }).action, "NONE");
});
