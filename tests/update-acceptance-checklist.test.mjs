import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { assessUpdateAcceptance } from "../scripts/adoption-plan.mjs";
const target = { version: "2.1.18", sourceRevision: "accepted-commit" };
const ids = assessUpdateAcceptance(target).checks.map(r => r.id);
function receipt() {
  return { schema: "vydykhai.update-acceptance.v1", ...target, stateEvidence: "state/readback",
    currentBindings: Object.fromEntries(ids.map(id => [id, "current-" + id])),
    checks: ids.map(id => ({ id, status: "CONFIRMED", binding: "current-" + id,
      evidence: "native/" + id, owner: "root" })) };
}
test("missing evidence leaves all eight obligations unconfirmed", () => {
  const r = assessUpdateAcceptance(target);
  assert.equal(r.status, "INCOMPLETE"); assert.equal(r.unowned.length, 8);
});
test("complete receipt is documentary, not host verification", () => {
  const r = assessUpdateAcceptance(target, receipt());
  assert.equal(r.status, "DOCUMENTED_COMPLETE"); assert.match(r.assurance, /NOT_HOST/);
});
test("drift and evidence-free ticks fail closed", () => {
  for (const mutate of [r => r.version = "2.1.17", r => r.sourceRevision = "old",
    r => r.checks[0].binding = "old", r => r.checks[0].evidence = "",
    r => r.checks[0].owner = "", r => r.stateEvidence = ""]) {
    const r = receipt(); mutate(r);
    assert.equal(assessUpdateAcceptance(target, r).status, "INCOMPLETE");
  }
});
test("waivers need reasons and cannot waive installation", () => {
  const r = receipt(); r.checks[0].status = "NOT_APPLICABLE"; r.checks[0].reason = "waive";
  assert.equal(assessUpdateAcceptance(target, r).status, "INCOMPLETE");
  const s = receipt(); s.checks[2].status = "NOT_APPLICABLE";
  assert.equal(assessUpdateAcceptance(target, s).status, "INCOMPLETE");
  s.checks[2].reason = "No other participants in current inventory";
  assert.equal(assessUpdateAcceptance(target, s).status, "DOCUMENTED_COMPLETE");
});
test("duplicates rejected and outstanding obligations remain owned", () => {
  const r = receipt(); r.checks.push(r.checks[0]);
  assert.throws(() => assessUpdateAcceptance(target, r), /Invalid/);
  const s = receipt(); s.checks[5].status = "NOT_DONE"; s.checks[5].next = "Owner delivery checkpoint";
  const out = assessUpdateAcceptance(target, s);
  assert.equal(out.status, "INCOMPLETE"); assert.deepEqual(out.unowned, []);
});
test("known broken integrity overrides a positive receipt; unknown revision cannot pass", () => {
  assert.equal(assessUpdateAcceptance({...target, integrity: false}, receipt()).checks[0].status, "NOT_DONE");
  assert.equal(assessUpdateAcceptance({...target, sourceRevision: "unknown"},
    {...receipt(), sourceRevision: "unknown"}).status, "INCOMPLETE");
});
test("installed doctor and adoption share the checklist without changing integrity exit semantics", () => {
  const dir = mkdtempSync(join(tmpdir(), "acceptance-cli-"));
  const cli = fileURLToPath(new URL("../scripts/vydykhai.mjs", import.meta.url));
  const run = args => spawnSync(process.execPath, [cli, ...args], {cwd: dir, encoding: "utf8"});
  try {
    assert.equal(run(["install", dir]).status, 0);
    const ordinary = run(["doctor", dir, "--offline", "--json"]);
    assert.equal(ordinary.status, 0);
    const d = JSON.parse(ordinary.stdout);
    assert.equal(d.ok, true);
    assert.equal(d.updateAcceptance.status, "INCOMPLETE");
    const r = {...receipt(), version: d.installedVersion, sourceRevision: d.sourceRevision};
    const file = join(dir, "receipt.json"); writeFileSync(file, JSON.stringify(r));
    assert.equal(run(["doctor", dir, "--offline", "--receipt", file, "--json"]).status, 0);
    const plan = run(["adoption-plan", dir, "--receipt", file, "--json"]);
    assert.equal(plan.status, 0);
    assert.equal(JSON.parse(plan.stdout).updateAcceptance.status, "DOCUMENTED_COMPLETE");
    r.checks[5].status = "NOT_DONE"; writeFileSync(file, JSON.stringify(r));
    const incomplete = run(["doctor", dir, "--offline", "--receipt", file, "--json"]);
    assert.equal(incomplete.status, 2); assert.equal(JSON.parse(incomplete.stdout).ok, true);
    assert.equal(run(["adoption-plan", dir, "--receipt", file, "--json"]).status, 2);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});
