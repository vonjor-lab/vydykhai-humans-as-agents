import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, realpath, writeFile, readFile, readdir, rm, symlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {openControlHost} from "../scripts/control-host.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {openModelReview} from "../scripts/control-model-review.mjs";
import {initialHealth} from "../scripts/control-health.mjs";
import {migrateControlHost, assessControlMigrationRollback} from "../scripts/control-migration.mjs";
import {canonicalJson, sha256} from "../scripts/memory-brief.mjs";

const hash = value => sha256(canonicalJson(value));
const services = {createReturnSync: () => ({evidence: "fixture:return-sync"})};
async function fixture(t, {noRegistry = false} = {}) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "control-migration-")));
  t.after(() => rm(root, {recursive: true, force: true}));
  const workspace = path.join(root, "workspace"), privateRoot = path.join(root, "private"),
    directory = path.join(privateRoot, "host"), reviewDirectory = path.join(privateRoot, "review");
  for (const dir of [workspace, privateRoot, directory, reviewDirectory]) await mkdir(dir, {mode: 0o700});
  const sourceFile = path.join(privateRoot, "sources.json");
  await writeFile(path.join(workspace, "policy.md"), "Synthetic policy; no model calls");
  await writeFile(sourceFile, JSON.stringify({schema: "control.review-sources.v1", workspace,
    sources: [{id: "policy", path: "policy.md", purpose: "Migration fixture"}]}), {mode: 0o600});
  const sourceConfig = {workspace, policy: sha256("policy"), owner: "owner", executor: "executor", reviewer: "reviewer",
    ...(noRegistry ? {} : {evidenceRegistry: sourceFile})};
  const targetConfig = {...sourceConfig, evidenceRegistry: sourceFile,
    health: {scope: "Fixture health", intervalMs: 60000, maxBranches: 1, maxWorktrees: 1,
      triggerSourceIds: ["policy"], repairTasks: ["maintenance"]}};
  const host = await openControlHost(directory, sourceConfig, services); await host.initialize();
  const binding = {taskId: "maintenance"};
  await host.approveCommand(binding, {reviewer: "reviewer", reviewReceipt: "fixture:reviewed-command",
    dependencies: [], expiresAt: Date.now() + 120000});
  const authorization = await host.control.authorize(binding);
  await host.pause(true);
  const store = await openControlStore(directory);
  await store.transact(s => {
    s.acceptances.previous = {acceptance: {id: "previous", status: "ACCEPTED"}, enrollment: "CLOSED",
      reviewLease: null, findings: [{id: "retained-finding", status: "OPEN", attempts: 2}],
      review: {runId: "old-review"}, disposition: {action: "REPAIR"},
      repairLeases: [{owner: "owner"}], history: [{evidence: "original-history"}]};
    s.grants.consumed = {id: "consumed", expiresAt: Date.now() + 120000, evidence: "prior grant"};
    s.reservations.consumed = {status: "COMPLETED", resultSha256: sha256("completed"), dependencies: []};
    s.historicalExtension = {evidence: "must not drop unknown retained fields"};
    return s;
  });
  const modelReview = await openModelReview({directory: reviewDirectory, controlRoot: privateRoot,
    reviewer: "reviewer", sourceFile, native: {}, maxCalls: 2,
    expiresAt: new Date(Date.now() + 3600000).toISOString(), scope: {kind: "fixture"}});
  await modelReview.initialize();
  const reviewStore = await openControlStore(reviewDirectory);
  await reviewStore.transact(s => {s.calls = 2; s.runs.spent = {runId: "spent", state: "STOPPED", evidence: "spent budget"}; return s;});
  const before = await store.read(), reviewBefore = await reviewStore.read();
  const options = {directory, sourceConfig, targetConfig, expectedSourceConfigKey: hash(sourceConfig),
    expectedJournalDigest: before.digest, review: {directory: reviewDirectory,
      expectedDigest: reviewBefore.digest, expectedConfigKey: reviewBefore.state.configKey},
    actor: "trusted-host", rationale: "Approved health enrollment only",
    approval: {reviewer: "reviewer", targetConfigKey: hash(targetConfig), evidence: "fixture:exact-config-approved",
      ...(noRegistry ? {registryAddition: true} : {})}};
  const boundary = {actor: options.actor, directory, reviewDirectory, state: "QUIESCENT", oldHost: "STOPPED",
    evidence: "fixture:supervisor-held-exclusive-boundary"};
  const trusted = {withSafeBoundary: async run => run(boundary)};
  const migrate = (o = options, cap = trusted) => migrateControlHost(o, cap);
  const bindCurrent = async () => {options.expectedJournalDigest = (await store.read()).digest;
    options.review.expectedDigest = (await reviewStore.read()).digest;};
  return {root, directory, reviewDirectory, sourceFile, sourceConfig, targetConfig, host, store, reviewStore,
    before, reviewBefore, modelReview, options, boundary, trusted, migrate, bindCurrent, binding, authorization};
}
const restartProgram = `
  import {openControlHost} from ${JSON.stringify(new URL("../scripts/control-host.mjs", import.meta.url).href)};
  import {migrateControlHost} from ${JSON.stringify(new URL("../scripts/control-migration.mjs", import.meta.url).href)};
  const {options,boundary}=JSON.parse(process.argv[1]);
  const result=await migrateControlHost(options,{withSafeBoundary:async run=>run(boundary)});
  const modern=await openControlHost(options.directory,options.targetConfig,{});
  const old=await openControlHost(options.directory,options.sourceConfig,{});
  let refused=false;try{await old.snapshot();}catch(e){refused=e.message==='CONTROL_CONFIG_MISMATCH';}
  console.log(JSON.stringify({result,state:await modern.snapshot(),refused}));
`;
function restart(x) {
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", restartProgram,
    JSON.stringify({options: x.options, boundary: x.boundary})], {encoding: "utf8", timeout: 10000});
  assert.equal(child.status, 0, child.stderr); return JSON.parse(child.stdout);
}

test("disk migration appends once, retains prior evidence, invalidates grants and survives process restart", async t => {
  const x = await fixture(t), names = (await readdir(x.directory)).filter(n => /^\d.*json$/.test(n));
  const bytes = await Promise.all(names.map(n => readFile(path.join(x.directory, n), "utf8")));
  const result = await x.migrate(), row = await x.store.read(), s = row.state;
  assert.equal(result.status, "JOURNAL_MIGRATED_ONLY"); assert.equal(result.paused, true);
  assert.equal(row.revision, x.before.revision + 1); assert.equal(row.parent, x.before.digest);
  assert.equal(s.schema, "control.host.v2"); assert.equal(s.configKey, hash(x.targetConfig));
  assert.deepEqual(s.health, initialHealth(x.targetConfig)); assert.equal(s.paused, true);
  assert.deepEqual(s.acceptances, x.before.state.acceptances); assert.deepEqual(s.reservations, x.before.state.reservations);
  assert.deepEqual(s.historicalExtension, x.before.state.historicalExtension);
  assert.deepEqual(s.grants.consumed, x.before.state.grants.consumed);
  const key = x.authorization.id;
  assert.deepEqual(s.grants[key], {...x.before.state.grants[key], expiresAt: 0});
  assert.deepEqual(s.controlMigration.targetConfig, x.targetConfig);
  assert.equal(s.controlMigration.actor, x.options.actor); assert.equal(s.controlMigration.rationale, x.options.rationale);
  assert.equal(s.controlMigration.sourceJournal.digest, x.before.digest);
  assert.equal(s.controlMigration.expiredGrants[0].previousExpiresAt, x.before.state.grants[key].expiresAt);
  for (let i = 0; i < names.length; i++) assert.equal(await readFile(path.join(x.directory, names[i]), "utf8"), bytes[i]);
  const restarted = restart(x); assert.equal(restarted.result.reused, true); assert.equal(restarted.refused, true);
  assert.deepEqual(restarted.state, s); assert.deepEqual(await x.store.read(), row);
  assert.deepEqual(await x.reviewStore.read(), x.reviewBefore);
  assert.deepEqual(await x.modelReview.capacity(), {used: 2, remaining: 0});
  await assert.rejects(x.host.snapshot(), /CONFIG_MISMATCH/);
  const modern = await openControlHost(x.directory, x.targetConfig, {});
  assert.deepEqual(await modern.due(), []); await modern.pause(false);
  await assert.rejects(modern.control.reserve(x.authorization), /STALE_OR_USED_ADMISSION/);
  await assert.rejects(modern.control.authorize(x.binding), /COMMAND_NOT_APPROVED/);
  await assert.rejects(modern.health.assertReady("ordinary-product"), /HEALTH_CONTROL_PENDING/);
});

test("same intent never reinitializes advanced health or appends; changed intent is refused", async t => {
  const x = await fixture(t); await x.migrate();
  await x.store.transact(s => {s.health.history.push({evidence: "later-health-evidence"}); s.health.nextDueAt = 1234; return s;});
  const current = await x.store.read(); assert.equal(restart(x).result.reused, true);
  assert.deepEqual(await x.store.read(), current);
  await assert.rejects(x.migrate({...x.options, rationale: "different intent"}), /INTENT_CONFLICT/);
  assert.deepEqual(await x.store.read(), current);
});

test("legacy without registry can add only an explicitly approved health prerequisite", async t => {
  const x = await fixture(t, {noRegistry: true});
  const unapproved = structuredClone(x.options); delete unapproved.approval.registryAddition;
  await assert.rejects(x.migrate(unapproved), /REGISTRY_ADDITION_NOT_APPROVED/);
  assert.deepEqual(await x.store.read(), x.before); await x.migrate();
  assert.equal((await x.store.read()).state.configKey, hash(x.targetConfig));
});

for (const field of ["workspace", "owner", "executor", "reviewer", "policy", "evidenceRegistry", "extraAuthority"])
  test(`approved target still cannot change ${field}`, async t => {
    const x = await fixture(t), o = structuredClone(x.options);
    o.targetConfig[field] = field === "policy" ? sha256("other-policy") : "different";
    o.approval.targetConfigKey = hash(o.targetConfig);
    await assert.rejects(x.migrate(o), /CONFIG_CHANGE_FORBIDDEN/);
    assert.deepEqual(await x.store.read(), x.before);
  });

for (const [name, mutate, code] of [
  ["unpaused host", s => {s.paused = false;}, /PAUSE_REQUIRED/],
  ["unknown schema", s => {s.schema = "control.host.v9";}, /SOURCE_MISMATCH/],
  ["health already present in v1", s => {s.health = {};}, /SOURCE_MISMATCH/],
  ["missing reservations", s => {delete s.reservations;}, /STATE_INVALID/],
  ["in-flight action", s => {s.reservations.pending = {status: "IN_FLIGHT"};}, /ACTION_OUTCOME_UNKNOWN/],
  ["unknown action", s => {s.reservations.pending = {status: "UNKNOWN"};}, /ACTION_OUTCOME_UNKNOWN/],
  ["forged failed status", s => {s.reservations.pending = {status: "FAILED_RECONCILED"};}, /ACTION_OUTCOME_UNKNOWN/],
  ["owner-only reconciliation", s => {s.reservations.pending = {status: "FAILED_RECONCILED",
    reconciliation: {owner: "owner", evidence: "claimed stop and reconciliation"}};}, /ACTION_OUTCOME_UNKNOWN/],
  ["active lease", s => {s.acceptances.previous.reviewLease = {runId: "active"};}, /REVIEW_LEASE/],
  ["unknown review without lease", s => {s.acceptances.previous.enrollment = "REVIEW_RECONCILIATION_REQUIRED";}, /REVIEW_LEASE/],
]) test(`fail closed for ${name}`, async t => {
  const x = await fixture(t); await x.store.transact(s => {mutate(s); return s;}); await x.bindCurrent();
  const before = await x.store.read(); await assert.rejects(x.migrate(), code);
  assert.deepEqual(await x.store.read(), before); assert.deepEqual(await x.reviewStore.read(), x.reviewBefore);
});

for (const state of ["IN_FLIGHT", "UNKNOWN", "UNRECOGNIZED"])
  test(`review outcome ${state} is retained and blocks migration`, async t => {
    const x = await fixture(t); await x.reviewStore.transact(s => {s.runs.spent.state = state; return s;});
    await x.bindCurrent(); const before = await x.reviewStore.read();
    await assert.rejects(x.migrate(), /REVIEW_OUTCOME_UNKNOWN/);
    assert.deepEqual(await x.store.read(), x.before); assert.deepEqual(await x.reviewStore.read(), before);
  });

test("missing budget journal is never initialized and an unknown budget schema is refused", async t => {
  const x = await fixture(t);
  await x.reviewStore.transact(s => {s.schema = "control.model-review.v9"; return s;}); await x.bindCurrent();
  await assert.rejects(x.migrate(), /REVIEW_INVALID/);
  for (const name of await readdir(x.reviewDirectory)) await rm(path.join(x.reviewDirectory, name));
  await assert.rejects(x.migrate(), /REVIEW_JOURNAL_MISSING/);
  assert.deepEqual(await readdir(x.reviewDirectory), []); assert.deepEqual(await x.store.read(), x.before);
});

test("a missing retained budget counter is never treated as a fresh allocation", async t => {
  const x = await fixture(t);
  await x.reviewStore.transact(s => {delete s.calls; return s;}); await x.bindCurrent();
  const before = await x.reviewStore.read(); await assert.rejects(x.migrate(), /REVIEW_INVALID/);
  assert.deepEqual(await x.store.read(), x.before); assert.deepEqual(await x.reviewStore.read(), before);
});

test("self-consistent supplied hashes cannot substitute for the journal's actual current config", async t => {
  const x = await fixture(t), o = structuredClone(x.options);
  o.sourceConfig.policy = sha256("different-current-policy");
  o.targetConfig.policy = o.sourceConfig.policy;
  o.expectedSourceConfigKey = hash(o.sourceConfig); o.approval.targetConfigKey = hash(o.targetConfig);
  await assert.rejects(x.migrate(o), /SOURCE_MISMATCH/);
  assert.deepEqual(await x.store.read(), x.before); assert.deepEqual(await x.reviewStore.read(), x.reviewBefore);
});

test("missing host history fails closed instead of initializing a new host", async t => {
  const x = await fixture(t);
  await rm(path.join(x.directory, "0000000000.json"));
  const files = await readdir(x.directory); await assert.rejects(x.migrate(), /CONTROL_HISTORY_GAP/);
  assert.deepEqual(await readdir(x.directory), files); assert.deepEqual(await x.reviewStore.read(), x.reviewBefore);
  for (const name of files) await rm(path.join(x.directory, name));
  await assert.rejects(x.migrate(), /HOST_JOURNAL_MISSING/); assert.deepEqual(await readdir(x.directory), []);
});

test("exact config, both journal digests and explicit approval are mandatory", async t => {
  const x = await fixture(t);
  for (const amend of [
    o => {o.sourceConfig.extra = "not-current";}, o => {o.expectedJournalDigest = sha256("stale");},
    o => {o.review.expectedDigest = sha256("stale-review");}, o => {o.review.expectedConfigKey = sha256("wrong-budget");},
    o => {o.approval.targetConfigKey = sha256("unapproved");}, o => {o.approval.reviewer = "executor";},
    o => {delete o.review;}, o => {o.targetConfig.health.intervalMs = 1; o.approval.targetConfigKey = hash(o.targetConfig);},
    o => {o.targetConfig.health.triggerSourceIds = ["missing"]; o.approval.targetConfigKey = hash(o.targetConfig);},
  ]) {
    const o = structuredClone(x.options); amend(o); await assert.rejects(x.migrate(o));
    assert.deepEqual(await x.store.read(), x.before); assert.deepEqual(await x.reviewStore.read(), x.reviewBefore);
  }
});

test("caller-held trusted boundary is required and drift at boundary entry is refused", async t => {
  const x = await fixture(t); await assert.rejects(x.migrate(x.options, {}), /TRUSTED_BOUNDARY_REQUIRED/);
  await assert.rejects(x.migrate(x.options, {withSafeBoundary: async () => null}), /BOUNDARY_UNPROVEN/);
  for (const amend of [b => {b.oldHost = "RUNNING";}, b => {b.actor = "worker";}, b => {b.state = "UNKNOWN";}]) {
    const b = {...x.boundary}; amend(b);
    await assert.rejects(x.migrate(x.options, {withSafeBoundary: async run => run(b)}), /BOUNDARY_UNPROVEN/);
  }
  await assert.rejects(x.migrate(x.options, {withSafeBoundary: async run => {
    await x.host.pause(false); return run(x.boundary);
  }}), /JOURNAL_CHANGED/);
  assert.equal((await x.store.read()).state.schema, "control.host.v1");
});

test("unsafe or aliased journal paths cannot cross the trusted boundary", async t => {
  const x = await fixture(t), alias = path.join(x.root, "host-alias"); await symlink(x.directory, alias);
  const o = {...x.options, directory: alias}, b = {...x.boundary, directory: alias};
  await assert.rejects(x.migrate(o, {withSafeBoundary: async run => run(b)}), /STORAGE_NOT_PRIVATE/);
  await assert.rejects(x.migrate({...x.options, review: {...x.options.review, directory: x.directory}}), /REVIEW_BINDING_REQUIRED/);
  assert.deepEqual(await x.store.read(), x.before);
});

test("rollback assessment never discards v2 health, budgets or state and needs an actual compatible reader", async t => {
  const x = await fixture(t); await x.migrate(); const current = await x.store.read();
  const request = {directory: x.directory, config: x.targetConfig, expectedJournalDigest: current.digest};
  const hold = await assessControlMigrationRollback(request);
  assert.equal(hold.status, "COMPATIBLE_RUNTIME_REQUIRED"); assert.equal(hold.action, "HOLD_FOR_COMPATIBILITY");
  assert.equal(hold.stateRollbackAllowed, false);
  const legacy = await assessControlMigrationRollback({...request, compatibleReader: async dir =>
    (await openControlHost(dir, x.sourceConfig, {})).snapshot()});
  assert.equal(legacy.action, "HOLD_FOR_COMPATIBILITY");
  const falseReader = await assessControlMigrationRollback({...request, compatibleReader: async () => ({schema: "control.host.v2"})});
  assert.equal(falseReader.action, "HOLD_FOR_COMPATIBILITY");
  const compatible = await assessControlMigrationRollback({...request, compatibleReader: async (dir, config) =>
    (await openControlHost(dir, config, {})).snapshot()});
  assert.equal(compatible.action, "COMPATIBLE_READER_CONFIRMED"); assert.equal(compatible.stateRollbackAllowed, false);
  await assert.rejects(assessControlMigrationRollback({...request, config: x.sourceConfig}), /CURRENT_CONFIG_REQUIRED/);
  await assert.rejects(assessControlMigrationRollback({...request, expectedJournalDigest: x.before.digest}), /JOURNAL_CHANGED/);
  assert.deepEqual(await x.store.read(), current); assert.deepEqual(await x.reviewStore.read(), x.reviewBefore);
});
