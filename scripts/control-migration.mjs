// Journal prerequisite only, not service activation, installation or adoption.
// withSafeBoundary is a trusted launcher capability: it must exclude ALL old
// host/review writers for the entire callback. No worker-supplied attestation
// or this module's CAS can establish process quiescence across two journals.
import path from "node:path";
import {readFile} from "node:fs/promises";
import {openControlStore} from "./control-store.mjs";
import {initialHealth} from "./control-health.mjs";
import {openReviewSources} from "./control-review-sources.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";

const hash = value => sha256(canonicalJson(value));
const need = (value, code) => {if (!value) throw Error(code);};
const filled = value => typeof value === "string" && !!value.trim();
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const separate = (a, b) => a !== b && !a.startsWith(b + path.sep) && !b.startsWith(a + path.sep);
const exactKeys = (v, keys) => record(v) && Object.keys(v).sort().join() === [...keys].sort().join();

// Quiescence only, never success or execution permission. Validate the retained
// host receipt and its exact CAS transition in the already-validated journal.
export async function settledCommandHistory(store, journal, config) {
  const s = journal.state, failed = [];
  for (const [id, r] of Object.entries(s.reservations)) {
    if (!record(r)) return false;
    if (r.status === "COMPLETED") continue;
    if (r.status !== "FAILED_RECONCILED" || !digest(id) || r.reservationId !== id || r.grantId !== id ||
      r.bindingSha256 !== id || !digest(r.stateRevision) || !Array.isArray(r.dependencies) ||
      Object.hasOwn(r, "resultSha256") || Object.hasOwn(r, "continuationStatus")) return false;
    const g = s.grants?.[r.grantId], f = r.failure, c = r.reconciliation;
    if (!record(g) || g.id !== id || g.bindingSha256 !== id || !record(g.binding) || hash(g.binding) !== id ||
      r.nextTask !== g.binding.taskId || hash(r.dependencies) !== hash(g.dependencies ?? null) ||
      !exactKeys(f, ["exitCode", "signal", "reason", "commandSha256", "cwd", "executable", "process",
        "stdoutSha256", "stderrSha256", "stdoutBytes", "stderrBytes"]) ||
      !(f.exitCode === null || Number.isSafeInteger(f.exitCode)) ||
      !(f.signal === null || typeof f.signal === "string" && /^[A-Z][A-Z0-9]{0,31}$/.test(f.signal)) ||
      !["COMMAND_FAILED", "COMMAND_SIGNALLED", "COMMAND_TIMEOUT", "COMMAND_OUTPUT_LIMIT", "COMMAND_START_FAILED"].includes(f.reason) ||
      (f.exitCode === 0 && f.reason === "COMMAND_FAILED") ||
      ![f.commandSha256, f.stdoutSha256, f.stderrSha256].every(digest) || ![f.cwd, f.executable].every(filled) ||
      ![f.stdoutBytes, f.stderrBytes].every(n => Number.isSafeInteger(n) && n >= 0) ||
      f.commandSha256 !== g.binding.commandSha256 || f.cwd !== g.binding.cwd || f.executable !== g.binding.executable ||
      !exactKeys(f.process, ["launchId", "pid", "groupId", "startedAt", "closedAt", "launchExecutable", "launchArgsSha256"]) ||
      typeof f.process.launchId !== "string" || !/^[a-f0-9-]{36}$/.test(f.process.launchId) ||
      ![f.process.pid, f.process.groupId].every(n => n === null || Number.isSafeInteger(n) && n > 0) ||
      !Number.isFinite(Date.parse(f.process.startedAt)) || !Number.isFinite(Date.parse(f.process.closedAt)) ||
      Date.parse(f.process.closedAt) < Date.parse(f.process.startedAt) ||
      !filled(f.process.launchExecutable) || !digest(f.process.launchArgsSha256) ||
      !exactKeys(c, ["owner", "evidence", "previousJournalDigest", "failureSha256", "observation", "recordedAt"]) ||
      c.owner !== config.owner || !filled(c.evidence) || !digest(c.previousJournalDigest) ||
      c.failureSha256 !== hash(f) || !Number.isFinite(Date.parse(c.recordedAt))) return false;
    const o = c.observation, bound = p => p.reservationId === id && p.bindingSha256 === id &&
      p.failureSha256 === c.failureSha256 && filled(p.evidence);
    if (!exactKeys(o, ["termination", "effects"]) ||
      !exactKeys(o.termination, ["state", "reservationId", "bindingSha256", "failureSha256", "processSha256", "evidence"]) ||
      !bound(o.termination) || o.termination.state !== "STOPPED" || o.termination.processSha256 !== hash(f.process) ||
      !exactKeys(o.effects, ["state", "reservationId", "bindingSha256", "failureSha256", "scopeSha256", "evidence"]) ||
      !bound(o.effects) || o.effects.state !== "RECONCILED" ||
      o.effects.scopeSha256 !== hash({workspace: config.workspace, binding: g.binding}) ||
      o.effects.evidence === o.termination.evidence || Buffer.byteLength(canonicalJson(o)) > 16384) return false;
    failed.push({id, reservation: r, grant: g, receipt: c});
  }
  if (!failed.length) return true;
  const configKeys = new Set([hash(config)]), migration = s.controlMigration;
  if (record(migration?.sourceConfig) && record(migration.targetConfig) &&
    migration.sourceSchema === "control.host.v1" && migration.targetSchema === "control.host.v2" &&
    migration.targetConfigKey === hash(config) && hash(migration.targetConfig) === hash(config) &&
    migration.sourceConfigKey === hash(migration.sourceConfig)) {
    const base = {...config}; delete base.health;
    if (!Object.hasOwn(migration.sourceConfig, "evidenceRegistry") && migration.approval?.registryAddition === true)
      delete base.evidenceRegistry;
    if (hash(base) === migration.sourceConfigKey) configKeys.add(migration.sourceConfigKey);
  }
  const transitionMatches = (previous, next, {id, reservation, grant}) => {
    if (!configKeys.has(previous.state.configKey) ||
      !["control.host.v1", "control.host.v2"].includes(previous.state.schema) ||
      !record(previous.state.reservations?.[id]) || !record(previous.state.grants?.[id]) ||
      !record(next.state.reservations?.[id])) return false;
    const {reconciliation: _receipt, ...inFlight} = reservation;
    inFlight.status = "IN_FLIGHT";
    if (hash(previous.state.reservations[id]) !== hash(inFlight) || hash(previous.state.grants[id]) !== hash(grant) ||
      hash(next.state.reservations[id]) !== hash(reservation)) return false;
    const expected = structuredClone(previous.state); expected.reservations[id] = reservation;
    return hash(next.state) === hash(expected);
  };
  const pending = new Map();
  for (const row of failed) {
    const key = row.receipt.previousJournalDigest;
    pending.set(key, [...(pending.get(key) ?? []), row]);
  }
  let current = journal;
  while (current.revision > 0 && pending.size) {
    const previous = JSON.parse(await readFile(path.join(store.root,
      `${String(current.revision - 1).padStart(10, "0")}.json`), "utf8"));
    if (previous.revision !== current.revision - 1 || previous.digest !== current.parent ||
      previous.digest !== hash({revision: previous.revision, parent: previous.parent, state: previous.state})) return false;
    if (pending.has(previous.digest)) {
      if (!pending.get(previous.digest).every(row => transitionMatches(previous, current, row))) return false;
      pending.delete(previous.digest);
    }
    current = previous;
  }
  return pending.size === 0;
}

function validateConfig(config) {
  need(record(config) && filled(config.workspace) && digest(config.policy) &&
    [config.owner, config.executor, config.reviewer].every(filled) &&
    new Set([config.owner, config.executor, config.reviewer]).size === 3,
  "CONTROL_MIGRATION_CONFIG_INVALID");
}
function validateReview(row, review) {
  need(row, "CONTROL_MIGRATION_REVIEW_JOURNAL_MISSING");
  need(row.digest === review.expectedDigest && row.state.configKey === review.expectedConfigKey,
    "CONTROL_MIGRATION_REVIEW_CHANGED");
  const s = row.state;
  need(s.schema === "control.model-review.v1" && Number.isSafeInteger(s.calls) && s.calls >= 0 && record(s.runs),
    "CONTROL_MIGRATION_REVIEW_INVALID");
  need(Object.values(s.runs).every(run => record(run) && run.state === "STOPPED"),
    "CONTROL_MIGRATION_REVIEW_OUTCOME_UNKNOWN");
}
function validateSource(s, sourceKey) {
  need(s.schema === "control.host.v1" && s.configKey === sourceKey && !Object.hasOwn(s, "health") &&
    !Object.hasOwn(s, "controlMigration"), "CONTROL_MIGRATION_SOURCE_MISMATCH");
  need(s.paused === true, "CONTROL_MIGRATION_PAUSE_REQUIRED");
  need([s.acceptances, s.grants, s.reservations].every(record), "CONTROL_MIGRATION_STATE_INVALID");
  need(Object.values(s.acceptances).every(r => record(r) && r.reviewLease === null &&
    ["REVIEW_DUE", "CLOSED", "CONTINUATION_OR_REPAIR_DUE", "FINAL_READBACK_DUE",
      "OWNER_DISPOSITION_DUE"].includes(r.enrollment)), "CONTROL_MIGRATION_REVIEW_LEASE_ACTIVE_OR_UNKNOWN");
  need(Object.values(s.grants).every(g => record(g) && filled(g.id) && Number.isFinite(g.expiresAt)),
    "CONTROL_MIGRATION_GRANT_INVALID");
}

export async function migrateControlHost(options, {withSafeBoundary} = {}) {
  need(typeof withSafeBoundary === "function", "CONTROL_MIGRATION_TRUSTED_BOUNDARY_REQUIRED");
  // Freeze intent at entry, before any caller-controlled asynchronous operation.
  const o = structuredClone(options);
  const {directory, sourceConfig, targetConfig, expectedSourceConfigKey, expectedJournalDigest,
    review, actor, rationale, approval} = o;
  validateConfig(sourceConfig); validateConfig(targetConfig);
  need(!Object.hasOwn(sourceConfig, "health") && digest(expectedSourceConfigKey) &&
    hash(sourceConfig) === expectedSourceConfigKey && digest(expectedJournalDigest),
  "CONTROL_MIGRATION_SOURCE_CONFIG_MISMATCH");
  const targetKey = hash(targetConfig), health = initialHealth(targetConfig);
  need(filled(actor) && filled(rationale) && approval?.reviewer === sourceConfig.reviewer &&
    approval.targetConfigKey === targetKey && filled(approval.evidence), "CONTROL_MIGRATION_APPROVAL_REQUIRED");
  const {health: _health, ...targetBase} = targetConfig;
  const registryAdded = !Object.hasOwn(sourceConfig, "evidenceRegistry") && Object.hasOwn(targetBase, "evidenceRegistry");
  if (registryAdded) {
    need(approval.registryAddition === true, "CONTROL_MIGRATION_REGISTRY_ADDITION_NOT_APPROVED");
    delete targetBase.evidenceRegistry;
  }
  need(hash(targetBase) === hash(sourceConfig), "CONTROL_MIGRATION_CONFIG_CHANGE_FORBIDDEN");
  need(filled(directory) && path.isAbsolute(directory) && review && filled(review.directory) &&
    path.isAbsolute(review.directory) && separate(path.resolve(directory), path.resolve(review.directory)) &&
    digest(review.expectedDigest) && digest(review.expectedConfigKey), "CONTROL_MIGRATION_REVIEW_BINDING_REQUIRED");
  const intentKey = hash(o);
  let invoked = false;
  const result = await withSafeBoundary(async boundary => {
    need(!invoked, "CONTROL_MIGRATION_BOUNDARY_REUSED"); invoked = true;
    need(boundary?.actor === actor && boundary.state === "QUIESCENT" && boundary.oldHost === "STOPPED" &&
      boundary.directory === directory && boundary.reviewDirectory === review.directory && filled(boundary.evidence),
    "CONTROL_MIGRATION_BOUNDARY_UNPROVEN");
    const store = await openControlStore(directory), reviewStore = await openControlStore(review.directory);
    const before = await store.read();
    need(before, "CONTROL_MIGRATION_HOST_JOURNAL_MISSING");
    validateReview(await reviewStore.read(), review);
    if (before.state.schema === "control.host.v2") {
      need(before.state.configKey === targetKey && record(before.state.health) &&
        before.state.controlMigration?.intentKey === intentKey,
      "CONTROL_MIGRATION_INTENT_CONFLICT");
      return {status: "JOURNAL_MIGRATED_ONLY", reused: true, revision: before.revision, digest: before.digest,
        intentKey, paused: before.state.paused};
    }
    need(before.digest === expectedJournalDigest, "CONTROL_MIGRATION_JOURNAL_CHANGED");
    validateSource(before.state, expectedSourceConfigKey);
    need(await settledCommandHistory(store, before, sourceConfig), "CONTROL_MIGRATION_ACTION_OUTCOME_UNKNOWN");
    const registry = await openReviewSources(targetConfig.evidenceRegistry);
    const registryEntries = new Set((await registry.list()).map(entry => entry.id));
    need(registry.workspace === targetConfig.workspace && targetConfig.health.triggerSourceIds.every(id =>
      registryEntries.has(id)), "CONTROL_MIGRATION_HEALTH_REGISTRY_INVALID");
    validateReview(await reviewStore.read(), review);
    const evidence = {schema: "control.host-migration.v1", intentKey, actor, rationale, approval,
      sourceSchema: "control.host.v1", targetSchema: "control.host.v2", sourceConfig,
      sourceConfigKey: expectedSourceConfigKey, targetConfig, targetConfigKey: targetKey,
      sourceJournal: {revision: before.revision, digest: expectedJournalDigest}, reviewJournal: review,
      boundary: structuredClone(boundary), recordedAt: new Date().toISOString(), expiredGrants: []};
    const saved = await store.transact((s, currentDigest) => {
      // Concurrent identical intents may already have published; never reenroll.
      if (s.schema === "control.host.v2") {
        need(s.configKey === targetKey && s.controlMigration?.intentKey === intentKey,
          "CONTROL_MIGRATION_INTENT_CONFLICT"); return s;
      }
      need(currentDigest === expectedJournalDigest, "CONTROL_MIGRATION_JOURNAL_CHANGED");
      validateSource(s, expectedSourceConfigKey);
      const migration = structuredClone(evidence);
      for (const [key, grant] of Object.entries(s.grants)) {
        if (!Object.hasOwn(s.reservations, grant.id)) {
          migration.expiredGrants.push({key, previousExpiresAt: grant.expiresAt});
          grant.expiresAt = Math.min(0, grant.expiresAt);
        }
      }
      s.schema = "control.host.v2"; s.configKey = targetKey;
      s.health = structuredClone(health); s.controlMigration = migration;
      return s;
    });
    return {status: "JOURNAL_MIGRATED_ONLY", reused: false, revision: saved.revision,
      digest: saved.digest, intentKey, paused: true};
  });
  need(invoked, "CONTROL_MIGRATION_BOUNDARY_UNPROVEN");
  return result;
}

// This never switches runtimes, unpauses, rewrites config or restores a snapshot.
// A trusted compatibleReader must actually read the current journal using config.
export async function assessControlMigrationRollback({directory, config, expectedJournalDigest, compatibleReader}) {
  validateConfig(config);
  const store = await openControlStore(directory), row = await store.read();
  need(row?.state.schema === "control.host.v2" && record(row.state.health) && row.state.configKey === hash(config),
    "CONTROL_MIGRATION_CURRENT_CONFIG_REQUIRED");
  need(digest(expectedJournalDigest) && row.digest === expectedJournalDigest, "CONTROL_MIGRATION_JOURNAL_CHANGED");
  let compatible = false;
  if (typeof compatibleReader === "function") {
    try {compatible = hash(await compatibleReader(directory, structuredClone(config))) === hash(row.state);} catch {}
  }
  need((await store.read()).digest === row.digest, "CONTROL_MIGRATION_JOURNAL_CHANGED");
  return {status: "COMPATIBLE_RUNTIME_REQUIRED", action: compatible ? "COMPATIBLE_READER_CONFIRMED" : "HOLD_FOR_COMPATIBILITY",
    compatibleReader: compatible, stateRollbackAllowed: false, statePreserved: true,
    schema: row.state.schema, configKey: row.state.configKey, digest: row.digest, paused: row.state.paused};
}
