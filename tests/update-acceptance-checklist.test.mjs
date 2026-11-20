import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { assessUpdateAcceptance, managerRoleBinding } from "../scripts/adoption-plan.mjs";
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
  assert.equal(r.checks.find(r=>r.id==="manager").roleCoverage,"NOT_REQUESTED");
});

function roleReceipt() {
  const r=receipt();r.manager="manager";
  const row=r.checks.find(c=>c.id==="manager");
  row.roleObservationRequired=true;
  row.roleObservation={binding:row.binding,manager:r.manager,work:"retained-work",revision:"accepted-revision",
    turn:"manager-turn",worker:"existing-worker",workerTurn:"worker-turn",evidence:"native-turns-and-retained-return",
    coverage:"COMPLETE",result:"APPLIED",applicationEvidence:"owner-state-readback"};
  row.roleObservation.binding=row.binding=r.currentBindings.manager=managerRoleBinding(row.roleObservation);
  return r;
}
test("manager acceptance distinguishes observed application from a dispatch or installed kit", () => {
  const r=roleReceipt(), row=r.checks.find(c=>c.id==="manager");
  assert.equal(assessUpdateAcceptance(target,r).checks.find(c=>c.id==="manager").roleCoverage,"OBSERVED");
  for(const mutate of [o=>o.result="DISPATCHED",o=>o.result="UNKNOWN",o=>o.coverage="PARTIAL",
    o=>delete o.applicationEvidence,o=>delete o.workerTurn,o=>o.worker="manager",o=>o.workerTurn="manager-turn"]) {
    const s=roleReceipt();mutate(s.checks.find(c=>c.id==="manager").roleObservation);
    const out=assessUpdateAcceptance(target,s);
    assert.equal(out.status,"INCOMPLETE");assert.equal(out.checks.find(c=>c.id==="manager").status,"NOT_CHECKED");
  }
  delete row.roleObservation;
  assert.equal(assessUpdateAcceptance(target,r).checks.find(c=>c.id==="manager").status,"NOT_CHECKED");
  row.status="NOT_DONE";
  assert.equal(assessUpdateAcceptance(target,r).checks.find(c=>c.id==="manager").status,"NOT_DONE");
});
test("current contrary role evidence overrides success or waiver without touching memory or independent review", () => {
  for(const coverage of ["COMPLETE","PARTIAL"])for(const claimed of ["CONFIRMED","NOT_APPLICABLE"]) {
    const r=roleReceipt(), row=r.checks.find(c=>c.id==="manager");
    row.status=claimed;row.reason="claimed ready";row.roleObservationRequired=false;
    row.roleObservation.result="ROLE_VIOLATION";row.roleObservation.coverage=coverage;
    const out=assessUpdateAcceptance(target,r);
    assert.equal(out.status,"INCOMPLETE");
    assert.equal(out.checks.find(c=>c.id==="manager").status,"NOT_DONE");
    assert.equal(out.checks.find(c=>c.id==="manager").reason,"OBSERVED_ROLE_VIOLATION");
    for(const id of ["installation","memory","independence"])assert.equal(out.checks.find(c=>c.id===id).status,"CONFIRMED");
  }
});
test("fresh bindings cannot make the same actor or placeholder identities into applied delegation", () => {
  for(const mutate of [o=>o.worker=o.manager,o=>o.workerTurn=o.turn,o=>o.worker=o.manager+" ",
    o=>o.workerTurn=o.turn+" ",o=>o.worker="unknown",o=>o.workerTurn="UNKNOWN",
    o=>o.applicationEvidence="pending",o=>o.evidence="TBD"]) {
    const r=roleReceipt(), row=r.checks.find(c=>c.id==="manager");
    mutate(row.roleObservation);
    row.binding=row.roleObservation.binding=r.currentBindings.manager=managerRoleBinding(row.roleObservation);
    const out=assessUpdateAcceptance(target,r);
    assert.equal(out.status,"INCOMPLETE");
    assert.equal(out.checks.find(c=>c.id==="manager").status,"NOT_CHECKED");
  }
});
test("a correctly bound old observation cannot satisfy the current adoption scope", () => {
  const r=roleReceipt(), row=r.checks.find(c=>c.id==="manager");
  const currentScope={...row.roleObservation,revision:"next-adoption-revision",turn:"current-manager-turn"};
  r.currentBindings.manager=managerRoleBinding(currentScope);
  assert.equal(assessUpdateAcceptance(target,r).checks.find(c=>c.id==="manager").status,"NOT_CHECKED");
});
test("missing or stale manager scope never certifies repair; old turn evidence cannot be reused under a new binding", () => {
  for(const mutate of [r=>r.manager="different-manager",r=>delete r.manager,
    r=>r.checks.find(c=>c.id==="manager").roleObservation.binding="old-turn-binding",
    r=>r.checks.find(c=>c.id==="manager").roleObservationRequired="true",
    r=>delete r.checks.find(c=>c.id==="manager").roleObservation.work,
    r=>r.checks.find(c=>c.id==="manager").roleObservation=null]) {
    const r=roleReceipt();mutate(r);
    assert.equal(assessUpdateAcceptance(target,r).checks.find(c=>c.id==="manager").status,"NOT_CHECKED");
  }
});
test("role binding covers exact manager and worker work/turn identities, independently of JSON field order", () => {
  const original=roleReceipt().checks.find(c=>c.id==="manager").roleObservation;
  assert.equal(managerRoleBinding(original),managerRoleBinding(Object.fromEntries(Object.entries(original).reverse())));
  for(const field of ["manager","work","revision","turn","worker","workerTurn"]) {
    const r=roleReceipt(), o=r.checks.find(c=>c.id==="manager").roleObservation;
    o[field]="different";
    assert.equal(assessUpdateAcceptance(target,r).checks.find(c=>c.id==="manager").status,"NOT_CHECKED",field);
  }
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
    const r = {...receipt(), version: d.installedVersion, sourceRevision: d.sourceRevision, workspace: realpathSync(dir)};
    const file = join(dir, "receipt.json"); writeFileSync(file, JSON.stringify(r));
    assert.equal(run(["doctor", dir, "--offline", "--receipt", file, "--json"]).status, 0);
    const plan = run(["adoption-plan", dir, "--receipt", file, "--json"]);
    assert.equal(plan.status, 0);
    assert.equal(JSON.parse(plan.stdout).updateAcceptance.status, "DOCUMENTED_COMPLETE");
    r.manager="root";
    const manager=r.checks.find(c=>c.id==="manager");
    manager.roleObservationRequired=true;
    manager.roleObservation={binding:manager.binding,manager:"root",work:"current-work",revision:"current-revision",
      turn:"observed-turn",evidence:"actual duplicate inspection",coverage:"PARTIAL",result:"ROLE_VIOLATION"};
    manager.roleObservation.binding=manager.binding=r.currentBindings.manager=managerRoleBinding(manager.roleObservation);
    writeFileSync(file,JSON.stringify(r));
    const contradicted=run(["doctor",dir,"--offline","--receipt",file,"--json"]);
    assert.equal(contradicted.status,2);assert.equal(JSON.parse(contradicted.stdout).ok,true);
    assert.equal(JSON.parse(contradicted.stdout).updateAcceptance.checks.find(c=>c.id==="manager").status,"NOT_DONE");
    const disputedPlan=run(["adoption-plan",dir,"--receipt",file,"--json"]);
    assert.equal(disputedPlan.status,2);
    assert.equal(JSON.parse(disputedPlan.stdout).updateAcceptance.checks.find(c=>c.id==="manager").roleCoverage,"MISMATCH");
    delete manager.roleObservationRequired;delete manager.roleObservation;
    r.checks[5].status = "NOT_DONE"; writeFileSync(file, JSON.stringify(r));
    const incomplete = run(["doctor", dir, "--offline", "--receipt", file, "--json"]);
    assert.equal(incomplete.status, 2); assert.equal(JSON.parse(incomplete.stdout).ok, true);
    assert.equal(run(["adoption-plan", dir, "--receipt", file, "--json"]).status, 2);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test("operational repair: checkout scope invalidates only local acceptance evidence", () => {
  const scoped = {...target, workspace: "/actual/current"}, r = receipt();
  r.workspace = "/previous/current";
  const out = assessUpdateAcceptance(scoped, r);
  assert.equal(out.status, "INCOMPLETE");
  for (const id of ["installation", "manager", "productive-resumption"]) {
    const row = out.checks.find(r => r.id === id);
    assert.equal(row.status, "NOT_CHECKED");
    assert.equal(row.reason, "MISSING_OR_STALE_WORKSPACE");
  }
  assert.equal(out.checks.find(r => r.id === "memory").status, "CONFIRMED");
  assert.equal(out.checks.find(r => r.id === "work-hygiene").status, "CONFIRMED");
  r.workspace = scoped.workspace;
  assert.equal(assessUpdateAcceptance(scoped, r).status, "DOCUMENTED_COMPLETE");
});

test("operational repair: absent checkout scope is not a current-workspace readback", () => {
  assert.equal(assessUpdateAcceptance({...target, workspace: "/current"}, receipt()).status, "INCOMPLETE");
  assert.equal(assessUpdateAcceptance(target, receipt()).status, "DOCUMENTED_COMPLETE");
});

test("operational repair: observed worker mismatch overrides documentary participants success", () => {
  for (const status of ["UPDATE_REQUIRED", "REVIEW_REQUIRED", "BLOCKED"]) {
    const out = assessUpdateAcceptance({...target, workerCheck:{status, reason:"actual mismatch"}}, receipt());
    assert.equal(out.status, "INCOMPLETE");
    assert.equal(out.checks.find(r => r.id === "participants").status, "NOT_DONE");
    assert.equal(out.checks.find(r => r.id === "installation").status, "CONFIRMED");
  }
  for (const workerCheck of [null, {}, {status:"LIMITED"}]) {
    const out = assessUpdateAcceptance({...target, workerCheck}, receipt());
    assert.equal(out.checks.find(r => r.id === "participants").status, "NOT_CHECKED");
  }
  assert.equal(assessUpdateAcceptance({...target, workerCheck:{status:"KIT_MATCH"}}, receipt()).status, "DOCUMENTED_COMPLETE");
});

test("operational repair: actual CLI rejects another checkout receipt and accepts current scope", () => {
  const dir = mkdtempSync(join(tmpdir(), "workspace-acceptance-"));
  const cli = fileURLToPath(new URL("../scripts/vydykhai.mjs", import.meta.url));
  const run = args => spawnSync(process.execPath, [cli, ...args], {cwd:dir, encoding:"utf8"});
  try {
    assert.equal(run(["install", dir]).status, 0);
    const d = JSON.parse(run(["doctor", dir, "--offline", "--json"]).stdout);
    const r = {...receipt(), version:d.installedVersion, sourceRevision:d.sourceRevision, workspace:"/another-checkout"};
    const file = join(dir, "receipt.json"); writeFileSync(file, JSON.stringify(r));
    const stale = run(["doctor", dir, "--offline", "--receipt", file, "--json"]);
    assert.equal(stale.status, 2);
    assert.equal(JSON.parse(stale.stdout).ok, true);
    assert.equal(JSON.parse(stale.stdout).updateAcceptance.checks.find(r=>r.id==="manager").reason, "MISSING_OR_STALE_WORKSPACE");
    assert.equal(run(["adoption-plan", dir, "--receipt", file, "--json"]).status, 2);
    r.workspace = realpathSync(dir); writeFileSync(file, JSON.stringify(r));
    assert.equal(run(["doctor", dir, "--offline", "--receipt", file, "--json"]).status, 0);
    assert.equal(run(["adoption-plan", dir, "--receipt", file, "--json"]).status, 0);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});
