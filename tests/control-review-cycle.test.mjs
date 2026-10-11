import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, realpath, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {openReviewCycle} from "../scripts/control-review-cycle.mjs";
import {controlCatalog} from "../scripts/control-catalog.mjs";
import {canonicalJson, sha256} from "../scripts/memory-brief.mjs";

const hash = value => sha256(canonicalJson(value));
const metadata = observed => ({...observed, observationDigest: hash(observed),
  readbacks: observed.readbacks.map(({text, ...source}) => source)});
const ids = group => controlCatalog.find(g => g.id === group).checks.map(c => c.id);
const answer = group => ({schema: "control.review-answer.v2", rowGroups: [
  {ids: ids(group), status: "PASS", sourceIds: ["public"]}], newFindings: [], resolutions: []});
async function fixture(t, mutate = () => {}) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "control-cycle-")));
  t.after(() => rm(root, {recursive: true, force: true}));
  let time = Date.parse("2026-10-09T10:00:00Z");
  const text = "Synthetic public contract only", source = {id: "public", status: "AVAILABLE", sha256: sha256(text)};
  const config = {basis: {epoch: sha256("synthetic-epoch-0"), phase: "POST", action: "synthetic-accepted-action",
    offer: {key: "b".repeat(64), input: {previousFindings: []}}, sources: {rows: [source]},
    requiredSourceIds: ["public"]}, owner: "synthetic-owner", reviewer: "synthetic-independent",
    expiresAt: "2026-10-09T11:00:00Z", maxCalls: 3};
  mutate(config);
  let currentBasis = structuredClone(config.basis);
  const observations = new Map(), decisions = new Map(), dispatched = [];
  const adapters = {now: () => time, readBasis: async () => structuredClone(currentBasis), readEpoch: () => currentBasis.epoch,
    observeAttempt: async id => observations.get(id), observeRecovery: async id => decisions.get(id)};
  let cycle = await openReviewCycle(root, config, adapters);
  const observation = (id, group, outcome = "COMPLETED", state = "STOPPED") => ({
    cycleId: cycle.cycleId, basisKey: cycle.basisKey, attemptId: id, group,
    state, outcome, observedAt: new Date(time).toISOString(), rawDigest: sha256("synthetic:" + id),
    evidence: "synthetic trusted observer receipt", readbacks: [{...source, text}], answer: answer(group)});
  return {config, observations, decisions, dispatched, observation,
    get cycle() {return cycle;},
    async restart(overrides = {}) {cycle = await openReviewCycle(root, config, {...adapters, ...overrides}); return cycle;},
    drift(fn) {fn(currentBasis); currentBasis.epoch = hash(currentBasis);}, advance(ms) {time += ms;},
    async run(group, outcome = "COMPLETED", state = "STOPPED", id) {
      id ??= await cycle.claim(group);
      await cycle.markDispatched(id); dispatched.push(id);
      observations.set(id, observation(id, group, outcome, state));
      await cycle.settle(id); return id;
    },
    decision(prior, group = "C02") {
      const id = "retry-" + prior;
      decisions.set(id, {id, cycleId: cycle.cycleId, basisKey: cycle.basisKey, priorAttempt: prior, group,
        action: "RETRY", state: "APPROVED", evidence: "synthetic independent stopped-failure decision",
        reviewedBy: "independent-recovery", expiresAt: config.expiresAt});
      return id;
    }};
}

test("restart retains completed A, explicitly recovers only stopped B, and never admits 7/87", async t => {
  const f = await fixture(t);
  const a = await f.run("C15"), completedA = (await f.cycle.status()).state.receipts.C15;
  const aDigest = hash(completedA), b = await f.run("C02", "FAILED");
  const before = await f.cycle.status();
  assert.equal(before.rows.filter(r => r.state === "COMPLETED").length, 4);
  assert.equal(before.state.attempts[1].status, "FAILED");
  await f.restart();
  assert.equal(hash(await f.cycle.settle(a)), aDigest);
  assert.equal(hash((await f.cycle.status()).state.receipts.C15), aDigest);
  await assert.rejects(f.cycle.claim("C02"), /EXPLICIT_RECOVERY_REQUIRED/);
  await assert.rejects(f.cycle.claim("C15"), /EXPLICIT_RECOVERY_REQUIRED/);
  await assert.rejects(f.cycle.recover(a, f.decision(a, "C15")), /STOPPED_FAILURE_REQUIRED/);
  const retry = await f.cycle.recover(b, f.decision(b));
  assert.notEqual(retry, b);
  await f.run("C02", "COMPLETED", "STOPPED", retry);
  const final = await f.cycle.status();
  assert.equal(final.rows.length, 87);
  assert.equal(final.rows.filter(r => r.state === "COMPLETED").length, 7);
  assert.equal(final.rows.filter(r => r.state === "PENDING").length, 80);
  assert.equal(final.admission, "DENIED_NOT_INTEGRATED");
  assert.deepEqual(f.dispatched, [a, b, retry]);
  assert.deepEqual(final.accounting, {reserved: 3, dispatched: 3, completed: 2, nativeUsage: "UNKNOWN"});
  assert.equal(hash(final.state.receipts.C15), aDigest);
  assert.deepEqual(final.state.attempts[1], before.state.attempts[1]);
  assert.equal(final.state.receipts.C02.attemptId, retry);
  assert.equal(final.state.attempts[2].recovery.priorAttempt, b);
  await assert.rejects(f.cycle.claim("C01"), /CAPACITY_EXHAUSTED/);
  await assert.rejects(f.cycle.recover(b, f.decision(b)), /RECOVERY_REUSED/);
});

test("changed source, phase, action or prior findings invalidate the entire epoch without erasing receipts", async t => {
  for (const change of [b => b.sources.rows[0].sha256 = "c".repeat(64), b => b.phase = "HEALTH",
    b => b.action = "different-action", b => b.offer.input.previousFindings.push({id: "changed"})]) {
    const f = await fixture(t), a = await f.run("C15"), b = await f.run("C02", "FAILED");
    const original = hash((await f.cycle.status()).state.receipts.C15);
    f.drift(change); await f.restart();
    const status = await f.cycle.status();
    assert.equal(status.current, false);
    assert.ok(status.rows.every(r => r.state === "INVALIDATED"));
    assert.equal(hash(status.state.receipts.C15), original);
    await assert.rejects(f.cycle.recover(b, f.decision(b)), /BASIS_INVALIDATED/);
    await assert.rejects(f.cycle.claim("C01"), /BASIS_INVALIDATED/);
    // A receipt may be read idempotently, but never regains authority/currentness.
    assert.equal(hash(await f.cycle.settle(a)), original);
    assert.equal((await f.cycle.status()).admission, "DENIED_NOT_INTEGRATED");
  }
});

test("UNKNOWN and a missing completed checkpoint block further dispatch; log fragments prove nothing", async t => {
  const unknown = await fixture(t), a = await unknown.run("C15"), b = await unknown.run("C02", "FAILED", "UNKNOWN");
  await unknown.restart();
  await assert.rejects(unknown.cycle.recover(b, unknown.decision(b)), /STOPPED_FAILURE_REQUIRED/);
  await assert.rejects(unknown.cycle.claim("C01"), /ATTEMPT_UNRESOLVED/);
  assert.deepEqual(unknown.dispatched, [a, b]);
  const missing = await fixture(t), id = await missing.cycle.claim("C15");
  await missing.cycle.markDispatched(id); await missing.restart();
  await assert.rejects(missing.cycle.settle(id), /OBSERVATION_UNBOUND/);
  assert.equal((await missing.cycle.status()).rows.filter(r => r.state === "COMPLETED").length, 0);
  await assert.rejects(missing.cycle.claim("C02"), /ATTEMPT_UNRESOLVED/);
});

test("recovery cannot renew expiry, refund calls, reuse a decision or change cycle configuration", async t => {
  const f = await fixture(t), b = await f.run("C02", "FAILED"), decision = f.decision(b);
  f.decisions.get(decision).expiresAt = "2026-10-09T12:00:00Z";
  await assert.rejects(f.cycle.recover(b, decision), /RECOVERY_UNAUTHORIZED/);
  f.decision(b); f.advance(3600000);
  await assert.rejects(f.cycle.recover(b, decision), /CYCLE_EXPIRED/);
  assert.equal((await f.cycle.status()).accounting.reserved, 1);
  f.config.expiresAt = "2026-10-09T12:00:00Z";
  await assert.rejects(f.restart(), /IDENTITY_INVALID/);
});

test("acquisition, exact group coverage, original attempt identity and immutable receipts remain mandatory", async t => {
  for (const mutate of [o => o.answer.rowGroups[0].ids.pop(), o => o.attemptId = "another",
    o => o.basisKey = "c".repeat(64), o => o.readbacks[0].text = "changed",
    o => o.observedAt = "2026-10-09T12:00:00Z", o => o.readbacks = []]) {
    const f = await fixture(t), id = await f.cycle.claim("C15"); await f.cycle.markDispatched(id);
    const o = f.observation(id, "C15"); mutate(o); f.observations.set(id, o);
    await assert.rejects(f.cycle.settle(id));
    assert.equal((await f.cycle.status()).accounting.completed, 0);
  }
  const f = await fixture(t), id = await f.run("C15");
  f.observations.get(id).evidence = "rewritten explanation";
  await assert.rejects(f.cycle.settle(id), /RECEIPT_CHANGED/);
});

test("failed repair cannot close in a completed episode without its explicit independent retry decision", async t => {
  const check = controlCatalog.find(g => g.id === "C15").checks[0];
  const f = await fixture(t, c => c.basis.offer.input.previousFindings = [{id: "failed-repair", checkId: check.id,
    area: "C15", criterion: check.criterion, status: "OPEN", evidence: "original failure evidence",
    firstSeen: "2026-10-08T10:00:00Z", attempts: 1, lastResult: "FAILED", owner: "repair-owner",
    work: "repair-work", reviewAt: "2026-10-10T10:00:00Z", blocksResume: true}]);
  const id = await f.cycle.claim("C15"); await f.cycle.markDispatched(id);
  const o = f.observation(id, "C15");
  o.answer.resolutions = [{id: "failed-repair", sourceIds: ["public"], proof: "claimed fixed"}];
  f.observations.set(id, o);
  await assert.rejects(f.cycle.settle(id), /RESOLUTION_NEEDS_EXPLICIT_RETRY/);
  assert.equal((await f.cycle.status()).accounting.completed, 0);
});

test("concurrent claim cannot reserve two attempts, and recovery must be independent and transition-bound", async t => {
  const f = await fixture(t);
  const outcomes = await Promise.allSettled([f.cycle.claim("C15"), f.cycle.claim("C02")]);
  assert.equal(outcomes.filter(o => o.status === "fulfilled").length, 1);
  assert.equal((await f.cycle.status()).accounting.reserved, 1);
  const g = await fixture(t), id = await g.run("C02", "FAILED");
  for (const change of [d => d.reviewedBy = g.config.owner, d => d.priorAttempt = "different",
    d => d.group = "C15", d => d.basisKey = "c".repeat(64), d => d.action = "CONTINUE"]) {
    const decision = g.decision(id); change(g.decisions.get(decision));
    await assert.rejects(g.cycle.recover(id, decision));
    assert.equal((await g.cycle.status()).accounting.reserved, 1);
  }
});

test("a bound STOPPED result with invalid answer is a retained failed attempt, not an unknown running process", async t => {
  const f = await fixture(t), id = await f.cycle.claim("C02");
  await f.cycle.markDispatched(id);
  const observed = f.observation(id, "C02"); observed.answer.rowGroups[0].ids.pop();
  f.observations.set(id, observed);
  await assert.rejects(f.cycle.settle(id), /PART_COVERAGE_INVALID/);
  await f.restart();
  const status = await f.cycle.status();
  assert.equal(status.state.attempts[0].status, "FAILED");
  assert.deepEqual(status.state.attempts[0].observation, metadata(observed));
  assert.match(status.state.attempts[0].validationError, /PART_COVERAGE_INVALID/);
  assert.equal(status.accounting.completed, 0);
  assert.equal(status.accounting.reserved, 1);
  assert.equal(status.admission, "DENIED_NOT_INTEGRATED");
  const retry = await f.cycle.recover(id, f.decision(id));
  assert.notEqual(retry, id);
});

test("UNKNOWN requires explicit later STOPPED reconciliation and preserves its original observation", async t => {
  const f = await fixture(t), id = await f.run("C02", "FAILED", "UNKNOWN");
  const original = structuredClone(f.observations.get(id));
  await assert.rejects(f.cycle.reconcile(id), /STOPPED_OUTCOME_REQUIRED/);
  f.observations.set(id, f.observation(id, "C02", "FAILED", "STOPPED"));
  await f.restart();
  await f.cycle.reconcile(id);
  const status = await f.cycle.status();
  assert.equal(status.state.attempts[0].status, "FAILED");
  assert.deepEqual(status.state.attempts[0].observations[0], metadata(original));
  assert.equal(status.state.attempts[0].observations.length, 2);
  assert.equal(status.accounting.reserved, 1);
  assert.notEqual(await f.cycle.recover(id, f.decision(id)), id);
});

test("recovery expiry bounds both dispatch and accepted completion without losing known stop", async t => {
  const f = await fixture(t), b = await f.run("C02", "FAILED"), decision = f.decision(b);
  f.decisions.get(decision).expiresAt = "2026-10-09T10:01:00Z";
  const retry = await f.cycle.recover(b, decision); f.advance(60001);
  await assert.rejects(f.cycle.markDispatched(retry), /RECOVERY_EXPIRED/);
  assert.equal((await f.cycle.status()).accounting.dispatched, 1);
  assert.equal((await f.cycle.status()).state.attempts[1].status, "NOT_STARTED");
  assert.notEqual(await f.cycle.recover(retry, f.decision(retry)), retry);
  const late = await fixture(t), prior = await late.run("C02", "FAILED"), d = late.decision(prior);
  late.decisions.get(d).expiresAt = "2026-10-09T10:01:00Z";
  const attempt = await late.cycle.recover(prior, d); await late.cycle.markDispatched(attempt);
  late.advance(60001); late.observations.set(attempt, late.observation(attempt, "C02"));
  await assert.rejects(late.cycle.settle(attempt), /RECOVERY_EXPIRED/);
  const result = await late.cycle.status();
  assert.equal(result.state.attempts[1].status, "FAILED");
  assert.equal(result.state.attempts[1].observation.state, "STOPPED");
  assert.equal(result.accounting.completed, 0);
  assert.equal(result.accounting.reserved, 2);
});

test("basis drift across journal I/O denies permission and invalidation stays latched after byte restoration", async t => {
  const f = await fixture(t), id = await f.cycle.claim("C15"); let armed = true;
  await f.restart({readBasis: async () => {
    const observed = structuredClone(f.config.basis);
    if (armed) {armed = false; queueMicrotask(() => f.drift(b => b.action = "changed during await"));}
    else observed.action = "changed during await";
    return observed;
  }});
  await assert.rejects(f.cycle.markDispatched(id), /BASIS_INVALIDATED/);
  const status = await f.cycle.status();
  assert.equal(status.current, false);
  assert.equal(status.state.attempts[0].status, "NOT_STARTED");
  assert.equal(status.accounting.dispatched, 0);
  await f.restart(); f.drift(b => b.action = f.config.basis.action);
  assert.equal((await f.cycle.status()).current, false);
  await assert.rejects(f.cycle.claim("C02"), /BASIS_INVALIDATED/);
});

test("checkpoints retain source digests and answer identity, not repeated source-body context", async t => {
  const body = "synthetic-source-body".repeat(5000), digest = sha256(body);
  const f = await fixture(t, c => c.basis.sources.rows[0].sha256 = digest);
  const id = await f.cycle.claim("C15"); await f.cycle.markDispatched(id);
  const observed = f.observation(id, "C15"); observed.readbacks[0].text = body;
  f.observations.set(id, observed); await f.cycle.settle(id);
  const status = await f.cycle.status();
  assert.equal(status.state.receipts.C15.receiptKey, hash(observed));
  assert.equal(status.state.receipts.C15.observed.readbacks[0].sha256, digest);
  assert.equal(Object.hasOwn(status.state.receipts.C15.observed.readbacks[0], "text"), false);
  assert.equal(Object.hasOwn(status.state.attempts[0].observation.readbacks[0], "text"), false);
  assert.ok(Buffer.byteLength(canonicalJson(status.state)) < 20000);
  assert.equal((await f.cycle.settle(id)).receiptKey, hash(observed));
});

test("malformed readback metadata never discards a bound terminal observation", async t => {
  for (const outcome of ["COMPLETED", "FAILED"]) {
    const f = await fixture(t), id = await f.cycle.claim("C02"); await f.cycle.markDispatched(id);
    const observed = f.observation(id, "C02", outcome); observed.readbacks = [null];
    f.observations.set(id, observed);
    if (outcome === "COMPLETED") await assert.rejects(f.cycle.settle(id));
    else await f.cycle.settle(id);
    await f.restart(); const status = await f.cycle.status();
    assert.equal(status.state.attempts[0].status, "FAILED");
    assert.equal(status.state.attempts[0].observation.rawDigest, observed.rawDigest);
    assert.equal(status.accounting.completed, 0);
    assert.notEqual(await f.cycle.recover(id, f.decision(id)), id);
  }
});

test("last-await drift is rejected by custody epoch, not another asynchronous snapshot", async t => {
  for (const stage of ["dispatch", "completion"]) {
    const f = await fixture(t), id = await f.cycle.claim("C15"); let reads = 0;
    if (stage === "completion") {await f.cycle.markDispatched(id); f.observations.set(id, f.observation(id, "C15"));}
    const last = stage === "dispatch" ? 2 : 3;
    await f.restart({readBasis: async () => {
      const observed = structuredClone(f.config.basis);
      if (++reads === last) queueMicrotask(() => f.drift(b => b.action = "last-await drift"));
      else if (reads > last) observed.action = "last-await drift";
      return observed;
    }});
    await assert.rejects(stage === "dispatch" ? f.cycle.markDispatched(id) : f.cycle.settle(id), /BASIS_INVALIDATED/);
    await f.restart(); assert.equal((await f.cycle.status()).current, false);
  }
});
