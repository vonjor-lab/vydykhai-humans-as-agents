import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, realpath, rm, lstat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { canonicalJson, sha256 } from "../scripts/memory-brief.mjs";
import { stageComparisonPreflight, materializeComparisonScenario } from "../scripts/qualify-framework-comparison.mjs";
import { stageNativeComparison, verifyNativeComparison, neutralNativeSources, dispatchRole,
  validateNativeTrace, readCompletedRoleOutput, readTurnSources, publishTurnSources } from "../scripts/qualify-framework-comparison-native.mjs";
import { openReviewSources } from "../scripts/control-review-sources.mjs";
import { openComparisonLedger } from "../scripts/qualify-framework-comparison-ledger.mjs";
import { nativeProvider, codeItem, answerItem } from "./native-provider-fixture.mjs";

const sourceRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const binary = process.env.VYDYKHAI_CODEX_BINARY;
async function setup(t, options = {}) {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), "comparison-native-")));
  t.after(() => rm(base, { recursive: true, force: true }));
  const comparison = await stageComparisonPreflight({ sourceRoot, output: path.join(base, "comparison") });
  const scenario = await materializeComparisonScenario({ output: comparison.output, expectedDigest: comparison.digest });
  const staged = await stageNativeComparison({ comparisonOutput: comparison.output, expectedDigest: comparison.digest,
    scenarioDigest: scenario.scenarioDigest, output: path.join(base, "native"), candidateSourceRoot: sourceRoot, maxCalls: 6, ...options });
  const authHome = path.join(base, "empty-auth"); await mkdir(authHome, { mode: 0o700 });
  const sourceRevisions = {};
  for (const arm of ["baseline", "candidate", "control"]) sourceRevisions[arm] = (await readTurnSources({ ...staged, arm })).sourceRevision;
  return { ...staged, base, comparison, scenario, authHome, sourceRevisions,
    intent: { task: { id: "bundle-task", sha256: sha256("Fixture assignment, not a semantic solution") }, commands: [], context: null } };
}
const dispatch = ({ sourceRevisions, ...args }) => dispatchRole({ ...args, sourceRevision: args.sourceRevision ?? sourceRevisions?.[args.arm] });
const json = async file => JSON.parse(await readFile(file, "utf8"));
const stageArgs = (x, output, maxCalls) => ({ comparisonOutput: x.comparison.output, expectedDigest: x.comparison.digest,
  scenarioDigest: x.scenario.scenarioDigest, candidateSourceRoot: sourceRoot, output, maxCalls });

test("policy-free control exposes identical facts and legal provenance, not framework guidance; safety stays shared", async t => {
  const x = await setup(t), freeze = await verifyNativeComparison(x.directory, x.expectedDigest);
  assert.deepEqual(freeze.activePolicies.control, { owner: [], worker: [], "readiness-reviewer": [] });
  assert.deepEqual(freeze.selections.control.policies, {});
  assert.equal(freeze.selections.control.plumbing, "COMMON_FROZEN_READ_SOURCE_TRANSPORT_POLICY_FREE");
  assert.doesNotMatch(freeze.frame, /selected framework|selected-policy|ignore policy|adopt/i);
  assert.match(freeze.frame, /No network, producer-source inspection or modification, arbitrary commands, direct writes/);
  assert.match(freeze.frame, /Return one JSON object/);
  assert.match(freeze.frame, /do not claim application before its observed receipt/);
  const sources = await openReviewSources(path.join(x.directory, "control/sources.json"));
  const entries = await sources.list();
  assert.equal(entries.length, Object.keys(freeze.neutralization).length + 3);
  assert.ok(entries.every(row => row.path.startsWith("evidence/") || row.path.startsWith("legal/")));
  await assert.rejects(lstat(path.join(x.directory, "control/public/policy")), { code: "ENOENT" });
  for (const name of Object.keys(freeze.neutralization)) {
    const content = await readFile(path.join(x.directory, "control/public/evidence", name));
    assert.doesNotMatch(content.toString(), /selected framework|selected-policy|ignore policy/i);
    for (const arm of ["baseline", "candidate"])
      assert.deepEqual(content, await readFile(path.join(x.directory, arm, "public/evidence", name)));
  }
  for (const [name, expected] of Object.entries(freeze.selections.control.legal)) {
    const content = await readFile(path.join(x.directory, "control/public/legal", name));
    assert.equal(sha256(content), expected);
    assert.deepEqual(content, await readFile(path.join(x.comparison.output, "baseline", name)));
  }
  const { reviewCodexConfig } = await import(pathToFileURL(path.join(x.comparison.output, "candidate/scripts/control-codex-profile.mjs")));
  let common;
  for (const arm of ["baseline", "candidate", "control"]) {
    const workspace = path.join(x.directory, arm, "room"), endpointFile = path.join(x.directory, arm, "sources.json");
    const config = reviewCodexConfig({ workspace, endpointFile });
    assert.equal(config.project_doc_max_bytes, 0);
    assert.equal(config["features.skip_host_skill_discovery"], true);
    for (const key of ["features.shell_tool", "features.unified_exec", "features.plugins", "features.apps", "features.memories", "features.multi_agent"])
      assert.equal(config[key], false);
    assert.equal(config["permissions.controlled.network.enabled"], false);
    assert.equal(config.approval_policy, "never");
    assert.equal(config.web_search, "disabled");
    assert.deepEqual(config["mcp_servers.vydykhai_review"].enabled_tools, ["list_sources", "read_source"]);
    const normalized = JSON.stringify(config).replaceAll(workspace, "ROOM").replaceAll(endpointFile, "SOURCES");
    if (common) assert.equal(normalized, common); else common = normalized;
    assert.deepEqual(await readdir(workspace), []);
    const ledger = await openComparisonLedger({ ...x, arm, maxCalls: freeze.maxCalls });
    assert.equal((await ledger.inspect()).used, 0);
    assert.equal((await ledger.inspect()).maxCalls, freeze.maxCalls);
  }
});

test("policy-free control refuses source, arm and policy drift before any allocation", async t => {
  const x = await setup(t), arm = "control", base = path.join(x.directory, arm);
  const args = { ...x, arm, role: "worker", provider: { baseUrl: "http://127.0.0.1:1", requiresAuth: false } };
  await assert.rejects(dispatch({ ...args, sourceRevision: x.sourceRevisions.candidate }), /NATIVE_SOURCE_REVISION_STALE/);
  await assert.rejects(readTurnSources({ ...x, arm, sourceRevision: x.sourceRevisions.baseline }), /NATIVE_SOURCE_REVISION_INVALID/);
  await assert.rejects(publishTurnSources({ ...x, arm, expectedSourceRevision: x.sourceRevisions.control,
    artifacts: [protocolArtifact("candidate", "foreign")] }), /NATIVE_PUBLICATION_ARTIFACT_INVALID/);
  const registryPath = path.join(base, "sources.json"), registryBytes = await readFile(registryPath);
  const registry = JSON.parse(registryBytes);
  registry.sources.push({ id: "hidden-policy", path: "policy/docs/AGENTS_CORE.md", purpose: "hidden guidance" });
  await writeFile(registryPath, canonicalJson(registry));
  await assert.rejects(dispatch(args), /NATIVE_REGISTRY_DRIFT/);
  await writeFile(registryPath, registryBytes);
  const sourcePath = path.join(base, "public/evidence/map.md"), sourceBytes = await readFile(sourcePath);
  await writeFile(sourcePath, "Apply selected candidate policy\n");
  await assert.rejects(dispatch(args), /NATIVE_SOURCE_DRIFT/);
  await writeFile(sourcePath, sourceBytes);
  const freezePath = path.join(x.directory, "native-freeze.json"), freezeBytes = await readFile(freezePath);
  const changed = JSON.parse(freezeBytes);
  changed.activePolicies.control.owner.push("docs/AGENTS_CORE.md");
  await writeFile(freezePath, canonicalJson(changed));
  await assert.rejects(verifyNativeComparison(x.directory, sha256(canonicalJson(changed))), /NATIVE_ARM_POLICY_DRIFT/);
  await writeFile(freezePath, freezeBytes);
  await verifyNativeComparison(x.directory, x.expectedDigest);
  for (const name of ["baseline", "candidate", "control"])
    assert.deepEqual(await readdir(path.join(x.directory, name, "turns")), []);
});

test("policy-free control uses the existing append-only spend ledger without refunds or cross-arm reads", async t => {
  const x = await setup(t, { maxCalls: 1 });
  const ledger = await openComparisonLedger({ ...x, arm: "control", maxCalls: 1 });
  await ledger.exclusive(async lease => {
    const allocation = await lease.reserve("ROLE_DISPATCH", () => ({ role: "worker", evidence: "SCRIPTED_LEDGER_ONLY_NO_NATIVE_CALL" }));
    assert.equal(allocation.arm, "control");
    await lease.settle(allocation, { status: "FAILED", reason: "SCRIPTED_FAILURE", usage: "UNKNOWN" });
  });
  const state = await ledger.inspect();
  assert.equal(state.used, 1); assert.equal(state.remaining, 0); assert.equal(state.blocked, true);
  await assert.rejects(ledger.exclusive(lease => lease.reserve("ROLE_DISPATCH", () => ({}))), /NATIVE_ARM_CALL_CAP/);
  for (const arm of ["baseline", "candidate"]) {
    const other = await openComparisonLedger({ ...x, arm, maxCalls: 1 });
    assert.equal((await other.inspect()).used, 0);
    await assert.rejects(other.read(1), { code: "ENOENT" });
  }
  const allocationPath = path.join(x.directory, "control/turns/allocation-1.json");
  const original = await readFile(allocationPath), changed = JSON.parse(original);
  changed.arm = "baseline";
  await writeFile(allocationPath, canonicalJson(changed));
  await assert.rejects(ledger.read(1), /NATIVE_LEDGER_ALLOCATION_MISMATCH/);
  await writeFile(allocationPath, original);
  assert.equal((await ledger.inspect()).used, 1);
});

test("explicit frozen budgets permit seven through cap32, not implicit or invalid allocations", async t => {
  const x = await setup(t);
  for (const maxCalls of [7, 32]) {
    const staged = await stageNativeComparison(stageArgs(x, path.join(x.base, `budget-${maxCalls}`), maxCalls));
    const freeze = await verifyNativeComparison(staged.directory, staged.expectedDigest);
    assert.equal(freeze.maxCalls, maxCalls);
    assert.equal(freeze.wholeChainComparatorReady, false);
    for (const arm of ["baseline", "candidate"]) assert.deepEqual(await readdir(path.join(staged.directory, arm, "turns")), []);
  }
  for (const [i, maxCalls] of [undefined, 0, -1, 1.5, 33, NaN, Infinity, "7"].entries()) {
    const output = path.join(x.base, `invalid-${i}`);
    await assert.rejects(stageNativeComparison(stageArgs(x, output, maxCalls)), /NATIVE_BUDGET_INVALID/);
    await assert.rejects(lstat(output), { code: "ENOENT" });
  }
  const original = await verifyNativeComparison(x.directory, x.expectedDigest);
  assert.equal(original.maxCalls, 6);
  await assert.rejects(stageNativeComparison(stageArgs(x, x.directory, 7)), { code: "EEXIST" });
  assert.equal((await verifyNativeComparison(x.directory, x.expectedDigest)).maxCalls, 6);
});

test("completed record selectors obey their frozen arm budget, including turn seven", async t => {
  const x = await setup(t, { maxCalls: 1 });
  for (const number of [0, 1.5, 2, 7, 33])
    await assert.rejects(readCompletedRoleOutput({ ...x, arm: "baseline", number }), /NATIVE_RECORD_SELECTOR_INVALID/);
  await assert.rejects(readCompletedRoleOutput({ ...x, arm: "baseline", number: 1 }), { code: "ENOENT" });
  const larger = await stageNativeComparison(stageArgs(x, path.join(x.base, "seven"), 7));
  await assert.rejects(readCompletedRoleOutput({ ...larger, arm: "candidate", number: 7 }), { code: "ENOENT" });
  await assert.rejects(readCompletedRoleOutput({ ...larger, arm: "candidate", number: 8 }), /NATIVE_RECORD_SELECTOR_INVALID/);
});

test("explicit effort and duration stay frozen and reject unsupported escalation", async t => {
  const x = await setup(t, { effort: "high", timeoutMs: 300000 });
  const freeze = await verifyNativeComparison(x.directory, x.expectedDigest);
  assert.equal(freeze.effort, "high");
  assert.equal(freeze.timeoutMs, 300000);
  for (const [i, settings] of [{ effort: "max" }, { effort: "" }, { timeoutMs: 300001 },
    { timeoutMs: 0 }, { timeoutMs: 1.5 }].entries()) {
    const output = path.join(x.base, `bad-profile-${i}`);
    await assert.rejects(stageNativeComparison({ ...stageArgs(x, output, 1), ...settings }), /NATIVE_BUDGET_INVALID/);
    await assert.rejects(lstat(output), { code: "ENOENT" });
  }
});

test("partition review override is explicitly frozen and reader-validated, never a silent effort override", async t => {
  const reviewProfile = { partitionCount: 3, effort: "low", timeoutMs: 90000 };
  const x = await setup(t, { maxCalls: 14, effort: "high", timeoutMs: 300000, reviewProfile });
  const freeze = await verifyNativeComparison(x.directory, x.expectedDigest);
  assert.deepEqual(freeze.reviewProfile, reviewProfile);
  assert.equal(freeze.effort, "high"); assert.equal(freeze.maxCalls, 14);
  for (const [i, change] of [ { reviewProfile: null }, { reviewProfile: { ...reviewProfile, partitionCount: 2 } },
    { reviewProfile: { ...reviewProfile, effort: "high" } }, { reviewProfile: { ...reviewProfile, timeoutMs: 90001 } },
    { reviewProfile: { ...reviewProfile, waiver: true } }, { effort: "low" }, { timeoutMs: 120000 }, { maxCalls: 2 } ].entries()) {
    const output = path.join(x.base, `review-invalid-${i}`);
    await assert.rejects(stageNativeComparison({ ...stageArgs(x, output, 14), effort: "high", timeoutMs: 300000,
      reviewProfile, ...change }), /NATIVE_REVIEW_PROFILE_INVALID/);
    await assert.rejects(lstat(output), { code: "ENOENT" });
  }
  const file = path.join(x.directory, "native-freeze.json"), original = await readFile(file);
  const invalid = { ...freeze, reviewProfile: { ...reviewProfile, timeoutMs: 300000 } };
  await writeFile(file, canonicalJson(invalid));
  await assert.rejects(verifyNativeComparison(x.directory, sha256(canonicalJson(invalid))), /NATIVE_REVIEW_PROFILE_INVALID/);
  await writeFile(file, original);
});

test("native authorization is explicit, immutable, bounded and rejects transport substitution before spending", async t => {
  const x = await setup(t);
  const dummy = path.join(x.base, "never-executed-binary");
  await writeFile(dummy, "not executable: authorization tests never launch a process\n");
  const authorization = { id: "fresh-comparison", basis: "Fixture operator authorization, no inference permitted by this test",
    binary: dummy, authHome: x.authHome };
  const invalid = [ {}, { ...authorization, basis: "" }, { ...authorization, id: "../escape" },
    { ...authorization, fromModel: true }, { ...authorization, authHome: x.base } ];
  for (const [i, nativeAuthorization] of invalid.entries()) {
    const output = path.join(x.base, `bad-authorization-${i}`);
    await assert.rejects(stageNativeComparison({ ...stageArgs(x, output, 1), nativeAuthorization }), /NATIVE_AUTHORIZATION_INVALID/);
    await assert.rejects(lstat(output), { code: "ENOENT" });
  }
  const staged = await stageNativeComparison({ ...stageArgs(x, path.join(x.base, "authorized"), 1),
    nativeAuthorization: authorization, timeoutMs: 1000 });
  const freeze = await verifyNativeComparison(staged.directory, staged.expectedDigest);
  assert.equal(freeze.dispatch, "AUTHORIZED_NATIVE_BOUNDED");
  assert.equal(freeze.nativeAuthorization.maxCallsPerArm, 1);
  assert.equal(freeze.nativeAuthorization.timeoutMs, 1000);
  assert.equal(freeze.nativeAuthorization.authority, "TRUSTED_OPERATOR_ASSERTION_NOT_MODEL_PERMISSION");
  assert.equal(freeze.nativeAuthorization.binarySha256, sha256(await readFile(dummy)));
  const sourceRevision = (await readTurnSources({ ...staged, arm: "baseline" })).sourceRevision;
  const args = { ...staged, arm: "baseline", role: "worker", binary: dummy, authHome: x.authHome,
    sourceRevision, intent: x.intent };
  for (const replacement of [ { binary: dummy + "-other" }, { authHome: x.base },
    { provider: { baseUrl: "http://127.0.0.1:1", requiresAuth: false } } ]) {
    await assert.rejects(dispatchRole({ ...args, ...replacement }), /NATIVE_AUTHORIZED_TRANSPORT_MISMATCH/);
  }
  for (const arm of ["baseline", "candidate"])
    assert.deepEqual(await readdir(path.join(staged.directory, arm, "turns")), []);
  assert.equal((await verifyNativeComparison(x.directory, x.expectedDigest)).nativeAuthorization, null);
  await assert.rejects(stageNativeComparison({ ...stageArgs(x, x.directory, 1), nativeAuthorization: authorization }), { code: "EEXIST" });
  await writeFile(dummy, "changed after frozen authorization\n");
  await assert.rejects(dispatchRole(args), /NATIVE_AUTHORIZATION_CHANGED/);
  assert.deepEqual(await readdir(path.join(staged.directory, "baseline/turns")), []);
});

test("symlink output parent is rejected before any directory or byte is written outside", async t => {
  const x = await setup(t), outside = path.join(x.base, "outside"), alias = path.join(x.base, "alias");
  await mkdir(outside, { mode: 0o700 });
  const sentinel = path.join(outside, "sentinel.txt"); await writeFile(sentinel, "unchanged\n");
  await symlink(outside, alias);
  const before = await readdir(outside), bytes = await readFile(sentinel);
  let error;
  try { await stageNativeComparison(stageArgs(x, path.join(alias, "escaped"), 1)); }
  catch (e) { error = e; }
  assert.deepEqual(await readdir(outside), before);
  assert.deepEqual(await readFile(sentinel), bytes);
  assert.match(error?.message ?? "no refusal", /NATIVE_OUTPUT_PARENT_UNSAFE/);
  await assert.rejects(lstat(path.join(outside, "escaped")), { code: "ENOENT" });
});

test("native framing preserves facts without candidate phases, artifact schema hints or hidden oracle", async t => {
  const x = await setup(t), f = await verifyNativeComparison(x.directory, x.expectedDigest);
  assert.equal(f.wholeChainComparatorReady, false);
  assert.equal(f.dispatch, "LOOPBACK_PROVIDER_ONLY_PENDING_REVIEW");
  assert.equal(f.policyReadiness, "SELECTED_POLICY_BOUND_ADOPTION_UNPROVEN");
  assert.equal(f.controlledModeAdoption, "NOT_ESTABLISHED_NO_ACTIVATION_RECEIPTS");
  assert.deepEqual(f.activePolicies.baseline["readiness-reviewer"], ["docs/AGENTS_CORE.md", "docs/FRAMEWORK.md"]);
  for (const arm of ["baseline", "candidate"]) {
    const sources = await openReviewSources(path.join(x.directory, arm, "sources.json"));
    const entries = await sources.list();
    for (const entry of entries.filter(e => e.path.startsWith("evidence/"))) {
      const row = await sources.read({ id: entry.id });
      assert.doesNotMatch(row.text, /preparation-review|retained-memory|retained-custody|producerEdits|ASK_OWNER_NOT_IMPLEMENT|six native calls|preapproved grant/);
    }
    assert.ok(!entries.some(e => /candidate\.mjs|recipe\.json|oracle\.json|verify\.mjs/.test(e.path)));
    assert.ok(!f.frame.includes("s001") && !f.frame.includes("requiredRecall"));
    assert.match(f.frame, /separate trusted applicator may later validate and apply those exact inputs/);
    assert.match(f.frame, /do not claim application before its observed receipt/);
    for (const role of ["owner", "worker", "readiness-reviewer"])
      assert.equal(f.activePolicies[arm][role].includes("docs/workflows/independent-control.md"), arm === "candidate");
    assert.equal(entries.some(e => e.path === "policy/docs/workflows/independent-control.md"), arm === "candidate");
    for (const name of ["docs/VYDYKHAI_NOTICE.md", "LICENSE.md", "NOTICE.md"])
      assert.ok(entries.some(e => e.path === `policy/${name}`));
    for (const [name, digest] of Object.entries(f.selections[arm].policies)) {
      const copied = await readFile(path.join(x.directory, arm, "public/policy", name));
      assert.equal(sha256(copied), digest);
      const origin = arm === "candidate" && Object.hasOwn(f.candidateLegalSource.files, name)
        ? f.candidateLegalSource.root : path.join(x.comparison.output, arm);
      assert.deepEqual(copied, await readFile(path.join(origin, name)));
    }
    const originals = Object.fromEntries(await Promise.all(Object.keys(f.neutralization).map(async name =>
      [name, await readFile(path.join(x.comparison.output, "scenario", name), "utf8")])));
    const neutral = neutralNativeSources(originals);
    for (const name of ["goal.md", "decisions.md", "success.md", "sources.json", "consumer-input.json"])
      assert.equal(neutral[name], originals[name]);
    assert.match(neutral["ideas.md"], /requires|owner|checkpoint/);
    assert.match(neutral["ideas.md"], /deferred implementation/i);
    assert.match(neutral["ideas.md"], /Keep-last remains rejected/);
    assert.match(neutral["decisions.md"], /Supersedes D1/);
    assert.match(neutral["success.md"], /SL2.*SL0/s);
  }
  const policyFile = path.join(x.directory, "baseline/public/policy/docs/AGENTS_CORE.md");
  await writeFile(policyFile, "changed selected policy\n");
  await assert.rejects(verifyNativeComparison(x.directory, x.expectedDigest), /NATIVE_SOURCE_DRIFT/);
});

test("missing or remote provider and bad actor are refused before allocation, without certifying loopback inference", async t => {
  const x = await setup(t);
  await assert.rejects(dispatchRole({ ...x, arm: "baseline", role: "owner", binary, authHome: x.authHome }), /NATIVE_PAID_DISPATCH_NOT_REVIEWED/);
  await assert.rejects(dispatchRole({ ...x, arm: "candidate", role: "invented", provider: { baseUrl: "http://127.0.0.1:1", requiresAuth: false } }), /NATIVE_ROLE_OR_PROMPT_INVALID/);
  await assert.rejects(dispatchRole({ ...x, arm: "baseline", role: "owner", provider: { baseUrl: "https://example.com", requiresAuth: false } }), /NATIVE_FAKE_PROVIDER_NOT_LOOPBACK/);
  for (const arm of ["baseline", "candidate"]) assert.deepEqual(await readdir(path.join(x.directory, arm, "turns")), []);
});

test("trace validation binds acquisition bytes and role to allocation, not role text in JSON", () => {
  const row = { id: "s001", path: "evidence/source.md", text: "Original evidence", status: "AVAILABLE", sha256: sha256("Original evidence") };
  const allocation = { arm: "baseline", role: "worker", sourceSnapshot: { rows: [row] } };
  const events = [{ type: "item.completed", item: { id: "read-1", type: "mcp_tool_call", server: "vydykhai_review", tool: "read_source", arguments: { id: "s001" }, status: "completed",
    result: { content: [{ type: "text", text: JSON.stringify(row) }] } } },
  { type: "item.completed", item: { type: "agent_message", text: '{ "role":"owner", "recipe": {"format":"wrong"} }' } },
  { type: "turn.completed", usage: { input_tokens: 7, cached_input_tokens: 2, output_tokens: 3 } }];
  const raw = () => ({ status: "CLI_EXIT_OK", state: "CLOSED", code: 0, reason: null, output: events.map(e => JSON.stringify(e)).join("\n") });
  const result = validateNativeTrace(raw(), allocation);
  assert.equal(result.role, "worker"); assert.equal(result.modelOutput.role, "owner");
  assert.equal(result.modelOutput.recipe.format, "wrong");
  assert.equal(result.modelOutputText, events[1].item.text);
  assert.equal(result.acquiredSources[0].sha256, row.sha256);
  assert.deepEqual(result.usage, events[2].usage);
  allocation.role = "readiness-reviewer";
  assert.equal(validateNativeTrace(raw(), allocation).role, "readiness-reviewer");
  events[0].item.result.content[0].text = JSON.stringify({ ...row, text: "forged" });
  assert.throws(() => validateNativeTrace(raw(), allocation), /NATIVE_READ_SOURCE_MISMATCH/);
  events[0].item.tool = "execute_registered";
  assert.throws(() => validateNativeTrace(raw(), allocation), /NATIVE_UNEXPECTED_TOOL/);
  assert.throws(() => validateNativeTrace({ ...raw(), status: "OUTCOME_UNKNOWN" }, allocation), /NATIVE_TURN_NOT_COMPLETE/);
});

test("only the exact known pre-turn CLI startup warning is tolerated and retained", () => {
  const allocation = { arm: "candidate", role: "readiness-reviewer", authHome: "/private/tmp/empty-auth", sourceSnapshot: { rows: [] } };
  const warning = { type: "item.completed", item: { type: "error", message:
    "Under-development features enabled: skip_host_skill_discovery. Under-development features are incomplete and may behave unpredictably. " +
    "To suppress this warning, set `suppress_unstable_features_warning = true` in /private/tmp/empty-auth/config.toml." } };
  const events = [warning, { type: "turn.started" }, { type: "item.completed", item: { type: "agent_message", text: "{}" } }, { type: "turn.completed" }];
  const raw = () => ({ status: "CLI_EXIT_OK", state: "CLOSED", code: 0, output: events.map(e => JSON.stringify(e)).join("\n") });
  assert.deepEqual(validateNativeTrace(raw(), allocation).warnings, [warning.item.message]);
  [events[0], events[1]] = [events[1], events[0]];
  assert.throws(() => validateNativeTrace(raw(), allocation), /NATIVE_UNEXPECTED_TOOL/);
  [events[0], events[1]] = [events[1], events[0]];
  warning.item.message = "A real failure";
  assert.throws(() => validateNativeTrace(raw(), allocation), /NATIVE_UNEXPECTED_TOOL/);
});

test("real read-source harness, fake provider: exact JSON, policy submission, role provenance and accounting", {
  skip: !binary || process.platform !== "darwin", timeout: 60000
}, async t => {
  const x = await setup(t, { maxCalls: 1, timeoutMs: 20000 });
  const registry = await json(path.join(x.directory, "baseline/sources.json"));
  const id = registry.sources.find(s => s.path === "evidence/goal.md").id;
  const payload = { role: "owner", package: { schema: "context.package.v3", intentionallyIncomplete: true },
    recipe: { format: "incorrect-on-purpose" }, readback: "Unmodified authored text\n", retention: "No adapter completion claim." };
  const scriptedResponses = [];
  const fake = await nativeProvider(t, async n => {
    const response = n % 2 === 1
    ? codeItem(`const t=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));if(!t)throw Error('SOURCE_TOOL_ABSENT');text(await tools[t.name]({id:${JSON.stringify(id)}}));`, `read-${n}`)
    : answerItem(payload);
    scriptedResponses.push(response); return response;
  });
  for (const arm of ["baseline", "candidate", "control"]) {
    const intent = { task: x.intent.task, context: null, commands: ["resume", "accept", "continue"].map(requestId => ({ requestId,
      requestSha256: sha256(`pre-ack fixture ${requestId} with readback:null`), bindingSha256: sha256(`binding ${requestId}`),
      dependenciesSha256: sha256(canonicalJson([])) })) };
    const receipt = await dispatch({ ...x, arm, role: "worker", intent, binary, authHome: x.authHome, provider: fake.provider, prompt: "Read the ordinary task and provide your proposed inputs." }).catch(async error => {
      t.diagnostic(await readFile(path.join(x.directory, arm, "turns/trace-1.json"), "utf8"));
      throw error;
    });
    assert.equal(receipt.status, "RECORDED"); assert.equal(receipt.role, "worker");
    assert.equal(receipt.provenanceKind, "LOOPBACK_PROVIDER_INFERENCE_UNVERIFIED");
    assert.equal(receipt.protocolApplication, "NOT_APPLIED");
    assert.deepEqual(receipt.modelOutput, payload);
    assert.equal(receipt.modelOutputText, JSON.stringify(payload));
    assert.equal(receipt.acquiredSources.length, 1);
    assert.equal(receipt.nativeDispatchesUsed, 1);
    const bound = await readCompletedRoleOutput({ ...x, arm, number: 1 });
    assert.equal(bound.role, "worker"); assert.deepEqual(bound.modelOutput, payload);
    assert.deepEqual(bound.intent, intent);
    assert.equal(bound.provenanceKind, "LOOPBACK_PROVIDER_INFERENCE_UNVERIFIED");
    const allocation = await json(receipt.allocationRef);
    assert.equal(allocation.provenanceKind, "LOOPBACK_PROVIDER_INFERENCE_UNVERIFIED");
    assert.equal(allocation.harnessRole, "review"); assert.equal(allocation.model, "gpt-6.1-sol");
    assert.equal(Object.hasOwn(allocation.loadedPolicy, "docs/workflows/independent-control.md"), arm === "candidate");
    const prompt = await readFile(path.join(x.directory, arm, "turns/prompt-1.txt"), "utf8");
    if (arm === "control") {
      assert.deepEqual(allocation.loadedPolicy, {});
      assert.equal(allocation.policyEvidence, "NO_FRAMEWORK_POLICY_SUBMITTED");
      assert.doesNotMatch(prompt, /selected-policy|selected framework|ignore policy/i);
    } else assert.match(prompt, /Apply the selected framework policy/);
    for (const [name, digest] of Object.entries(allocation.loadedPolicy)) {
      assert.ok(prompt.includes(await readFile(path.join(x.comparison.output, arm, name), "utf8")));
      assert.ok(prompt.includes(digest));
    }
    if (arm !== "control")
      assert.deepEqual((await readdir(path.join(x.comparison.output, "workspaces", arm))).sort(), Object.keys(x.scenario.files).sort());
    await assert.rejects(dispatch({ ...x, arm, role: "owner", binary, authHome: x.authHome, provider: fake.provider }), /NATIVE_ARM_CALL_CAP/);
  }
  assert.equal(fake.requests.length, 6);
  assert.equal(scriptedResponses.length, fake.requests.length);
  assert.deepEqual(scriptedResponses.filter(r => r.type === "message"), [answerItem(payload), answerItem(payload), answerItem(payload)]);
  t.diagnostic("Fixture-only no-inference evidence: all six provider responses were supplied by this test's scripted local callback, not inferred from loopback address.");
  for (const request of fake.requests) {
    assert.equal(request.model, "gpt-6.1-sol");
    assert.equal(request.reasoning.effort, "low");
  }
  await writeFile(path.join(x.directory, "baseline/turns/model-output-1.json"), '{"role":"owner"}');
  await assert.rejects(readCompletedRoleOutput({ ...x, arm: "baseline", number: 1 }), /NATIVE_OUTPUT_BINDING_MISMATCH/);
});

test("completed native final JSON survives ordinary progress but ambiguous or post-final output refuses", () => {
  const allocation = { role: "owner", arm: "candidate", sourceSnapshot: { rows: [] } };
  const message = text => ({ type: "item.completed", item: { type: "agent_message", text } });
  const finalText = '{"preparation":{"decision":"approved","unchanged":"exact bytes"}}';
  const events = [{ type: "turn.started" }, message("I will inspect the public sources."),
    message("The accepted module remains unchanged."), message(finalText),
    { type: "turn.completed", usage: { input_tokens: 12, output_tokens: 8 } }];
  const raw = rows => ({ status: "CLI_EXIT_OK", state: "CLOSED", code: 0, reason: null,
    output: rows.map(JSON.stringify).join("\n") });
  const result = validateNativeTrace(raw(events), allocation);
  assert.equal(result.modelOutputText, finalText);
  assert.equal(result.modelOutputSha256, sha256(finalText));
  assert.deepEqual(result.usage, { input_tokens: 12, output_tokens: 8 });
  assert.throws(() => validateNativeTrace(raw([events[0], message('{"decision":"REPAIR"}'), ...events.slice(2)]), allocation), /NATIVE_AMBIGUOUS_PROPOSALS/);
  assert.throws(() => validateNativeTrace(raw([...events.slice(0, -1), message("Actually this did not finish."), events.at(-1)]), allocation));
  assert.throws(() => validateNativeTrace(raw([...events, message(finalText)]), allocation), /NATIVE_FINAL_OUTPUT_INVALID/);
  assert.throws(() => validateNativeTrace(raw([...events.slice(0, -1),
    { type: "item.completed", item: { type: "reasoning", text: "Work still happening" } }, events.at(-1)]), allocation), /NATIVE_FINAL_OUTPUT_INVALID/);
});

test("real fake-provider malformed output keeps spent usage and blocks silent retry", {
  skip: !binary || process.platform !== "darwin", timeout: 30000
}, async t => {
  const x = await setup(t, { timeoutMs: 15000 });
  const fake = await nativeProvider(t, async () => ({ type: "message", id: "bad", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: "not JSON", annotations: [] }] }));
  await assert.rejects(dispatch({ ...x, arm: "baseline", role: "owner", binary, authHome: x.authHome, provider: fake.provider }));
  const receipt = await json(path.join(x.directory, "baseline/turns/receipt-1.json"));
  assert.equal(receipt.status, "FAILED"); assert.equal(receipt.nativeDispatchesUsed, 1);
  assert.notEqual(receipt.usage, "UNKNOWN");
  await assert.rejects(dispatch({ ...x, arm: "baseline", role: "owner", binary, authHome: x.authHome, provider: fake.provider }), /NATIVE_PREVIOUS_TURN_FAILED/);
  assert.equal(fake.requests.length, 1);
});

const protocolArtifact = (arm, id, text = '{"status":"fixture-result"}\n') => ({ id, purpose: `Protocol fixture ${id}`, text,
  origin: { kind: "parent-protocol-result", arm, operation: "ack", sha256: sha256(text) } });
function afterRestart(method, args) {
  const url = new URL("../scripts/qualify-framework-comparison-native.mjs", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e",
    `import {${method}} from ${JSON.stringify(url)};process.stdout.write(JSON.stringify(await ${method}(${JSON.stringify(args)})));`],
  { encoding: "utf8", timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("append-only source publication survives restart without changing originals or the other arm", async t => {
  const x = await setup(t), arm = "baseline", original = await readTurnSources({ ...x, arm });
  const registryBytes = await readFile(original.registryRef.path);
  const scopeFile = path.join(x.directory, arm, "public/evidence/scope.md"), scopeBytes = await readFile(scopeFile);
  const publication = await publishTurnSources({ ...x, arm, expectedSourceRevision: original.sourceRevision,
    artifacts: [protocolArtifact(arm, "ack_result")] });
  assert.equal(publication.sourceRevision.sequence, 1);
  assert.deepEqual(publication.sourceSnapshot.rows.slice(0, -1), original.sourceSnapshot.rows);
  assert.equal(publication.sourceSnapshot.rows.at(-1).id, "ack_result");
  assert.deepEqual(await readFile(original.registryRef.path), registryBytes);
  assert.deepEqual(await readFile(scopeFile), scopeBytes);
  assert.deepEqual((await readTurnSources({ ...x, arm: "candidate" })).sourceRevision, x.sourceRevisions.candidate);
  assert.deepEqual(afterRestart("readTurnSources", { directory: x.directory, expectedDigest: x.expectedDigest, arm }), publication);
  assert.deepEqual(await readTurnSources({ ...x, arm, sourceRevision: original.sourceRevision }), original);
  const entry = await json(path.join(x.directory, arm, "publication-1.json"));
  assert.equal(entry.evidence, "TRUSTED_PARENT_PUBLICATION_NOT_SEMANTIC_PROOF");
  assert.equal(entry.artifacts[0].origin.kind, "parent-protocol-result");
});

test("stale revisions, duplicate IDs, arm crossover and invalid publication bytes fail before writes", async t => {
  const x = await setup(t), arm = "candidate", zero = x.sourceRevisions[arm];
  const one = await publishTurnSources({ ...x, arm, expectedSourceRevision: zero, artifacts: [protocolArtifact(arm, "first")] });
  const parent = path.join(x.directory, arm, "public/published"), before = await readdir(parent);
  for (const expectedSourceRevision of [zero, x.sourceRevisions.baseline])
    await assert.rejects(publishTurnSources({ ...x, arm, expectedSourceRevision, artifacts: [protocolArtifact(arm, "later")] }),
      { message: "NATIVE_SOURCE_REVISION_STALE" });
  const good = protocolArtifact(arm, "later");
  for (const artifact of [{ ...good, id: "first" }, { ...good, id: "s001" }, { ...good, id: "../escape" },
    protocolArtifact("baseline", "other_arm"), protocolArtifact(arm, "huge", "x".repeat(128 * 1024 + 1))])
    await assert.rejects(publishTurnSources({ ...x, arm, expectedSourceRevision: one.sourceRevision, artifacts: [artifact] }),
      { message: "NATIVE_PUBLICATION_ARTIFACT_INVALID" });
  await assert.rejects(publishTurnSources({ ...x, arm, expectedSourceRevision: one.sourceRevision,
    artifacts: [{ ...good, text: "not the asserted bytes" }] }), { message: "NATIVE_PUBLICATION_ORIGIN_INVALID" });
  await assert.rejects(readTurnSources({ ...x, arm, sourceRevision: x.sourceRevisions.baseline }), { message: "NATIVE_SOURCE_REVISION_INVALID" });
  await assert.rejects(dispatchRole({ ...x, arm, role: "worker", sourceRevision: zero,
    provider: { baseUrl: "http://127.0.0.1:1", requiresAuth: false } }), { message: "NATIVE_SOURCE_REVISION_STALE" });
  assert.deepEqual(await readdir(parent), before);
  assert.deepEqual(await readdir(path.join(x.directory, arm, "turns")), []);
});

test("historical source prefixes remain verifiable but their own source or registry drift fails closed", async t => {
  const x = await setup(t), arm = "baseline";
  const one = await publishTurnSources({ ...x, arm, expectedSourceRevision: x.sourceRevisions[arm], artifacts: [protocolArtifact(arm, "one")] });
  const two = await publishTurnSources({ ...x, arm, expectedSourceRevision: one.sourceRevision, artifacts: [protocolArtifact(arm, "two")] });
  await writeFile(path.join(x.directory, arm, "public/published/2/two.txt"), "later drift");
  await assert.rejects(readTurnSources({ ...x, arm }), { message: "NATIVE_PUBLICATION_SOURCE_DRIFT" });
  assert.deepEqual(await readTurnSources({ ...x, arm, sourceRevision: one.sourceRevision }), one);
  await writeFile(path.join(x.directory, arm, "public/published/1/one.txt"), "old drift");
  await assert.rejects(readTurnSources({ ...x, arm, sourceRevision: one.sourceRevision }), { message: "NATIVE_PUBLICATION_SOURCE_DRIFT" });
  await writeFile(path.join(x.directory, arm, "public/published/1/one.txt"), protocolArtifact(arm, "one").text);
  await writeFile(one.registryRef.path, (await readFile(one.registryRef.path, "utf8")) + "\n");
  await assert.rejects(readTurnSources({ ...x, arm, sourceRevision: one.sourceRevision }), { message: "NATIVE_PUBLICATION_REGISTRY_DRIFT" });
  assert.equal((await readTurnSources({ ...x, arm, sourceRevision: x.sourceRevisions[arm] })).sourceRevision.sequence, 0);
  assert.equal(two.sourceRevision.sequence, 2);
});

test("unfinished publication and symlink publication directory cannot redirect writes or advance dispatch", async t => {
  const x = await setup(t), arm = "baseline", published = path.join(x.directory, arm, "public/published");
  await mkdir(path.join(published, "1"), { mode: 0o700 });
  await assert.rejects(readTurnSources({ ...x, arm }), { message: "NATIVE_PUBLICATION_INCOMPLETE" });
  assert.equal((await readTurnSources({ ...x, arm, sourceRevision: x.sourceRevisions[arm] })).sourceRevision.sequence, 0);
  await rm(published, { recursive: true });
  const outside = path.join(x.base, "outside-publication"); await mkdir(outside, { mode: 0o700 });
  await symlink(outside, published);
  await assert.rejects(publishTurnSources({ ...x, arm, expectedSourceRevision: x.sourceRevisions[arm], artifacts: [protocolArtifact(arm, "escape")] }),
    { message: "NATIVE_DIRECTORY_UNSAFE" });
  assert.deepEqual(await readdir(outside), []);
});

test("missing artifact directory cannot silently roll latest registry back", async t => {
  const x = await setup(t), arm = "baseline";
  await publishTurnSources({ ...x, arm, expectedSourceRevision: x.sourceRevisions[arm], artifacts: [protocolArtifact(arm, "committed")] });
  await rm(path.join(x.directory, arm, "public/published/1"), { recursive: true });
  await assert.rejects(readTurnSources({ ...x, arm }), { message: "NATIVE_PUBLICATION_INCOMPLETE" });
  await assert.rejects(publishTurnSources({ ...x, arm, expectedSourceRevision: x.sourceRevisions[arm], artifacts: [protocolArtifact(arm, "replacement")] }),
    { message: "NATIVE_PUBLICATION_INCOMPLETE" });
  assert.equal((await readTurnSources({ ...x, arm, sourceRevision: x.sourceRevisions[arm] })).sourceRevision.sequence, 0);
});

test("dispatch intent must be explicit and structurally bound before allocation", async t => {
  const x = await setup(t), arm = "baseline", provider = { baseUrl: "http://127.0.0.1:1", requiresAuth: false };
  const context = { runtimeDigest: sha256("runtime"), sourceSnapshotDigest: sha256("host snapshot"),
    sourceRegistrySha256: sha256("host registry"), sourceRoot: x.base, transportSha256: sha256("transport") };
  const command = { requestId: "resume", requestSha256: sha256("request with readback:null"), bindingSha256: sha256("command"),
    dependenciesSha256: sha256(canonicalJson([])) };
  const { dependenciesSha256, ...withoutDependencies } = command;
  for (const intent of [undefined, null, {}, { ...x.intent, actor: "owner" },
    { ...x.intent, command },
    ...[null, [command, command], ["a", "b", "c", "d"].map(requestId => ({ ...command, requestId })),
      [withoutDependencies], ...[undefined, null, "bad", "A".repeat(64)].map(dependenciesSha256 => [{ ...command, dependenciesSha256 }]),
      [{ ...command, requestSha256: "bad" }], [{ ...command, readbackStage: "bound" }], [{ ...command, requestId: "../escape" }]]
      .map(commands => ({ ...x.intent, commands })),
    ...[undefined, {}, { ...context, actor: "owner" }, { ...context, sourceRoot: "relative" },
      { ...context, sourceSnapshotDigest: "unknown" }].map(context => ({ ...x.intent, context }))])
    await assert.rejects(dispatch({ ...x, arm, role: "owner", intent, provider }), { message: "NATIVE_INTENT_INVALID" });
  assert.deepEqual(await readdir(path.join(x.directory, arm, "turns")), []);
});

test("fresh role sees published output/result; restarted old dispatch keeps its original snapshot and trusted intent", {
  skip: !binary || process.platform !== "darwin", timeout: 60000
}, async t => {
  const x = await setup(t, { maxCalls: 2, timeoutMs: 20000 }), arm = "candidate";
  const ownerOutput = { authored: "Fixture protocol input", intent: "model text must not set trusted intent" };
  const fake = await nativeProvider(t, async n => n === 1 ? answerItem(ownerOutput) : n === 2
    ? codeItem("const t=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));for(const id of ['owner_output','ack_result'])text(await tools[t.name]({id}));", "read-published")
    : answerItem({ commands: ["resume", "accept"].map(requestId => ({ requestId, decision: "AUTHORIZE_SUPERVISOR_ACTION",
      readback: "Unchanged worker-authored fixture text" })), intent: { forged: true } }));
  const first = await dispatch({ ...x, arm, role: "owner", binary, provider: fake.provider });
  const initial = await readCompletedRoleOutput({ ...x, arm, number: 1 });
  const origin = { kind: "role-output", arm, number: 1, modelOutputSha256: first.modelOutputSha256 };
  await assert.rejects(publishTurnSources({ ...x, arm: "baseline", expectedSourceRevision: x.sourceRevisions.baseline,
    artifacts: [{ id: "wrong_arm", purpose: "Must refuse crossover", text: first.modelOutputText, origin }] }),
    { message: "NATIVE_PUBLICATION_ARTIFACT_INVALID" });
  await assert.rejects(publishTurnSources({ ...x, arm, expectedSourceRevision: x.sourceRevisions[arm],
    artifacts: [{ id: "wrong_bytes", purpose: "Must refuse adapter rewriting", text: "{}", origin }] }),
    { message: "NATIVE_PUBLICATION_OUTPUT_MISMATCH" });
  const one = await publishTurnSources({ ...x, arm, expectedSourceRevision: x.sourceRevisions[arm], artifacts: [
    { id: "owner_output", purpose: "Exact previous role output", text: first.modelOutputText, origin }, protocolArtifact(arm, "ack_result")
  ] });
  const context = { runtimeDigest: sha256("selected fixture runtime"), sourceSnapshotDigest: sha256("fixed host registry with future MISSING entries"),
    sourceRegistrySha256: sha256("separate fixed registry bytes"), sourceRoot: path.join(x.base, "separate-host-workspace"),
    transportSha256: sha256("neutral bounded transport") };
  const intent = { task: x.intent.task, context, commands: ["resume", "accept"].map(requestId => ({ requestId,
    requestSha256: sha256(`fixture pre-ack ${requestId} with readback:null`), bindingSha256: sha256(`fixture command binding ${requestId}`),
    dependenciesSha256: sha256(canonicalJson(requestId === "accept" ? ["resume"] : [])) })) };
  const beforeDispatch = Date.now();
  const second = await dispatch({ ...x, arm, role: "worker", sourceRevision: one.sourceRevision, intent, binary, provider: fake.provider });
  assert.deepEqual(second.acquiredSources.map(row => row.id), ["owner_output", "ack_result"]);
  const completed = await readCompletedRoleOutput({ ...x, arm, number: 2 });
  assert.deepEqual(completed.intent, intent);
  assert.deepEqual(completed.intent.context, context);
  assert.notEqual(completed.intent.context.sourceSnapshotDigest, completed.sourceSnapshot.digest);
  assert.notEqual(completed.intent.context.sourceRegistrySha256, completed.registryRef.sha256);
  assert.equal(completed.intent.commands.length, 2);
  assert.equal(completed.modelOutput.commands.length, 2);
  assert.ok(completed.allocatedAtMs >= beforeDispatch && completed.allocatedAtMs <= Date.now());
  assert.equal(completed.timeoutMs, 20000);
  assert.equal(second.allocatedAtMs, completed.allocatedAtMs);
  const expiresAt = completed.allocatedAtMs + completed.timeoutMs + 300000;
  assert.deepEqual(completed.modelOutput.intent, { forged: true });
  assert.equal(completed.registryRef.path, one.registryRef.path);
  assert.deepEqual(completed.sourceSnapshot, one.sourceSnapshot);
  await publishTurnSources({ ...x, arm, expectedSourceRevision: one.sourceRevision, artifacts: [protocolArtifact(arm, "future")] });
  await writeFile(path.join(x.directory, arm, "public/published/2/future.txt"), "future-only drift");
  assert.deepEqual(afterRestart("readCompletedRoleOutput", { directory: x.directory, expectedDigest: x.expectedDigest, arm, number: 1 }), initial);
  assert.deepEqual(await readCompletedRoleOutput({ ...x, arm, number: 2 }), completed);
  const reopened = afterRestart("readCompletedRoleOutput", { directory: x.directory, expectedDigest: x.expectedDigest, arm, number: 2 });
  assert.equal(reopened.allocatedAtMs + reopened.timeoutMs + 300000, expiresAt);
  assert.equal(fake.requests.length, 3);
  assert.equal(completed.provenanceKind, "LOOPBACK_PROVIDER_INFERENCE_UNVERIFIED");
  assert.equal(completed.wholeChainComparatorReady, false);
  await writeFile(path.join(x.directory, arm, "turns/prompt-2.txt"), "rewritten after dispatch");
  await assert.rejects(readCompletedRoleOutput({ ...x, arm, number: 2 }), { message: "NATIVE_RECORD_INTENT_MISMATCH" });
});
