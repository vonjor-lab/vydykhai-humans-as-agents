import test from "node:test";
import assert from "node:assert/strict";
import { prepareNavigation as validateNavigation, checkPreparationAssignment } from "../scripts/context-navigation.mjs";
import { createHash } from "node:crypto";
const prepareNavigation = (p, task, read, contracts = ["contract.md"]) => validateNavigation(p, task, read, contracts);

const task = { id: "task-1", worker: "worker-1" };
const read = async () => Buffer.from("Keep accepted output.\nPreparation is read-only.\n");
const packet = () => ({ taskId: task.id, worker: task.worker, preparedBy: "preparer-1", outcome: "Extend without losing accepted output",
  assignment: { owner: "owner", requestId: "request-1", question: "Find retained invariants", phase: "initial", previous: null },
  references: [
    { id: "contract", path: "contract.md", startLine: 1, endLine: 1, quote: "Keep accepted output.", purpose: "Invariant", appliesTo: "task" },
    { id: "local", path: "contract.md", startLine: 2, endLine: 2, quote: "Preparation is read-only.", purpose: "Local authority", appliesTo: "preparation" },
  ], constraints: [
    { text: "Keep accepted output.", appliesTo: "task", referenceIds: ["contract"] },
    { text: "Do not implement.", appliesTo: "preparation", referenceIds: ["local"] },
  ], gaps: [] });

const moduleDeclarations = [{id:"module",intent:"change",contractFiles:["contract.md"]}];
const productPacket = () => {
  const p = packet();
  p.product = {goalRef:"contract",outcomeRef:"contract",planRef:"contract",capabilityRefs:["contract"],
    modules:[{id:"module",owner:task.worker,ownerContext:"external-visible-context",ownerRef:"contract",
      contractRef:"contract",route:"owner",authorityRef:null,reason:"Continue at the existing producer.",
      state:{needed:{status:"YES",referenceId:"contract"},implemented:{status:"YES",referenceId:"contract"},
        verified:{status:"UNKNOWN",referenceId:null},available:{status:"NO",referenceId:"contract"}}}]};
  return p;
};
const productCheck = (p, modules = moduleDeclarations) => validateNavigation(p,task,read,["contract.md"],modules);

test("product navigation keeps independent readiness facts and external owner context", async () => {
  const p = productPacket(), result = await productCheck(p);
  assert.deepEqual(result.product,p.product);
  assert.equal(result.product.modules[0].state.verified.status,"UNKNOWN");
  assert.equal(result.product.modules[0].state.available.status,"NO");
  assert.equal((await prepareNavigation(packet(),task,read)).product,undefined);
});

for (const [name, mutate, code] of [
  ["missing plan",p=>p.product.planRef="missing","PRODUCT_SOURCE_MISSING"],
  ["preparer-only authority",p=>p.product.modules[0].ownerRef="local","PRODUCT_SOURCE_MISSING"],
  ["owner changed silently",p=>p.product.modules[0].owner="other","PRODUCT_OWNER_MISMATCH"],
  ["helper without delegation",p=>{p.product.modules[0].owner="other";p.product.modules[0].route="assist";},"PRODUCT_DELEGATION_REQUIRED"],
  ["lost module",p=>p.product.modules=[],"PRODUCT_MODULE_COVERAGE"],
  ["missing availability",p=>delete p.product.modules[0].state.available,"PRODUCT_STATE_INVALID"],
  ["readiness without evidence",p=>p.product.modules[0].state.verified.status="YES","PRODUCT_SOURCE_MISSING"],
  ["integration used to rewrite producer",p=>p.product.modules[0].route="integrate","PRODUCT_PRODUCER_ROUTE"],
]) test(`product navigation rejects ${name}`, async () => {
  const p=productPacket(); mutate(p);
  await assert.rejects(productCheck(p),{message:code});
});

test("assistance needs its source and transfer stays pending while consumption retains producer ownership", async () => {
  const p=productPacket(), m=p.product.modules[0];
  m.owner="original-owner";m.authorityRef="contract";
  m.route="assist";await productCheck(p);
  m.route="transfer";await assert.rejects(productCheck(p),/PRODUCT_TRANSFER_PENDING/);
  m.route="integrate";m.authorityRef=null;
  await productCheck(p,[{...moduleDeclarations[0],intent:"consume"}]);
  m.route="owner";m.owner=task.worker;
  await assert.rejects(productCheck(p,[{...moduleDeclarations[0],intent:"consume"}]),/PRODUCT_CONSUMER_ROUTE/);
});

test("product supplements cannot drop or change the approved routing", async () => {
  const product=productPacket().product;
  const sha=v=>createHash("sha256").update(v).digest("hex");
  const navigation=await productCheck(productPacket());
  const parent=Buffer.from(JSON.stringify(navigation));
  const bytes=Buffer.from(JSON.stringify({schema:"context.preparation-plan.v1",owner:"owner",semanticPackage:{task,navigation:{product}},artifacts:[{path:"navigation.json",sha256:sha(parent)}]}));
  const approval=Buffer.from(JSON.stringify({schema:"context.package-approval.v1",owner:"owner",decision:"approved",planSha256:sha(bytes)}));
  const a={...packet().assignment,phase:"supplement",previous:{plan:{path:"plan",sha256:sha(bytes)},approval:{path:"approval",sha256:sha(approval)}}};
  const files={plan:bytes,approval,"navigation.json":parent},readParent=async p=>files[p];
  // Match the production plan filename used to locate its pinned navigation.
  a.previous.plan.path="plan.json";files["plan.json"]=bytes;
  await checkPreparationAssignment(a,"owner",task,readParent,null,null,navigation);
  await assert.rejects(checkPreparationAssignment(a,"owner",task,readParent),/PRODUCT_REBRIEF_REQUIRED/);
  const changed=structuredClone(navigation);changed.product.modules[0].ownerContext="other-context";
  await assert.rejects(checkPreparationAssignment(a,"owner",task,readParent,null,null,changed),/PRODUCT_REBRIEF_REQUIRED/);
  const redirected=structuredClone(navigation);redirected.references[0].path="replacement.md";
  await assert.rejects(checkPreparationAssignment(a,"owner",task,readParent,null,null,redirected),/PRODUCT_REBRIEF_REQUIRED/);
  for (const mutate of [n=>n.outcome="Unrelated direction",n=>n.constraints=[]]) {
    const replacement=structuredClone(navigation);mutate(replacement);
    await assert.rejects(checkPreparationAssignment(a,"owner",task,readParent,null,null,replacement),/PRODUCT_REBRIEF_REQUIRED/);
  }
  const additive=structuredClone(navigation);additive.constraints.push({...additive.constraints[0],text:"Additional bounded fact"});
  await checkPreparationAssignment(a,"owner",task,readParent,null,null,additive);
});

test("preparation authority is reviewed but not forwarded as executor authority", async () => {
  const p = packet(); p.assignment.question = "Preparation is read-only. Do not implement.";
  const result = await prepareNavigation(p, task, read);
  assert.deepEqual(result.references.map(r => r.id), ["contract"]);
  assert.equal(result.constraints.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /read-only|Do not implement/);
  assert.match(result.references[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.assignment.question, undefined);
  assert.equal(result.assignment.requestId, p.assignment.requestId);
});

test("quote-only references derive exact coordinates without model-written line numbers", async () => {
  const p = packet();
  for (const r of p.references) { delete r.startLine; delete r.endLine; }
  const result = await prepareNavigation(p, task, read);
  assert.equal(result.references[0].startLine, 1);
  assert.equal(result.references[0].endLine, 1);
});

test("quote resolution handles multiline CRLF, Unicode and final newline without exceeding EOF", async () => {
  const p = packet(); p.references = [{ ...p.references[0], quote: "Accepted \u03b1.\r\nSecond line.\r\n" }];
  delete p.references[0].startLine; delete p.references[0].endLine;
  p.constraints = [p.constraints[0]];
  const result = await prepareNavigation(p, task, async () => Buffer.from("Heading\r\nAccepted \u03b1.\r\nSecond line.\r\n"));
  assert.equal(result.references[0].startLine, 2); assert.equal(result.references[0].endLine, 3);
  assert.equal(result.references[0].quote, "Accepted \u03b1.\nSecond line.\n");
  p.references[0].startLine = 2; p.references[0].endLine = 3;
  assert.deepEqual((await prepareNavigation(p, task, async () => Buffer.from("Heading\r\nAccepted \u03b1.\r\nSecond line.\r\n"))).references, result.references);
});

test("ambiguous or missing quotes require source selection, never fuzzy correction", async () => {
  const p = packet(); p.references = [p.references[0]]; p.constraints = [p.constraints[0]];
  delete p.references[0].startLine; delete p.references[0].endLine;
  await assert.rejects(prepareNavigation(p, task, async () => Buffer.from("Keep accepted output.\nKeep accepted output.\n")), /NAVIGATION_QUOTE_AMBIGUOUS/);
  await assert.rejects(prepareNavigation(p, task, async () => Buffer.from("Changed meaning.\n")), /NAVIGATION_QUOTE_MISMATCH/);
});

test("real task-wide read-only authority is preserved, not removed by keyword filtering", async () => {
  const p = packet(); p.constraints[0].text = "Task is read-only under human authority.";
  assert.match((await prepareNavigation(p, task, read)).constraints[0].text, /read-only/);
});

for (const [name, mutate, code] of [
  ["wrong task", p => p.taskId = "other", "NAVIGATION_IDENTITY_INVALID"],
  ["same preparer and worker", p => p.preparedBy = task.worker, "NAVIGATION_IDENTITY_INVALID"],
  ["out-of-range citation", p => p.references[0].endLine = 3, "NAVIGATION_LINE_RANGE_INVALID"],
  ["unsupported quote", p => p.references[0].quote = "Invented rationale", "NAVIGATION_QUOTE_MISMATCH"],
  ["duplicate reference", p => p.references[1].id = "contract", "NAVIGATION_REFERENCE_INVALID"],
  ["unscoped rule", p => delete p.constraints[0].appliesTo, "NAVIGATION_CONSTRAINT_INVALID"],
  ["local rule relabeled for executor", p => p.constraints[1].appliesTo = "task", "NAVIGATION_ROLE_CONFLICT"],
  ["unknown reference", p => p.constraints[0].referenceIds = ["missing"], "NAVIGATION_CONSTRAINT_INVALID"],
  ["critical missing history", p => p.gaps.push({ text: "Missing accepted decision", critical: true }), "NAVIGATION_CRITICAL_GAP"],
]) test(name, async () => {
  const p = packet(); mutate(p);
  await assert.rejects(prepareNavigation(p, task, read), { message: code });
});

test("noncritical evidence limits stay visible", async () => {
  const p = packet(); p.gaps.push({ text: "No comparative quota measurement", critical: false });
  assert.deepEqual((await prepareNavigation(p, task, read)).gaps, p.gaps);
});

test("found code is not proof of an independently required module contract", async () => {
  await assert.rejects(prepareNavigation(packet(), task, read, []), { message: "NAVIGATION_CONTRACT_ROUTE_MISSING" });
  await assert.rejects(prepareNavigation(packet(), task, read, ["unread-contract.md"]), { message: "NAVIGATION_CONTRACT_UNREAD" });
});

test("only the assigned owner can request preparation; initial work has no parent", async () => {
  const a = packet().assignment;
  await checkPreparationAssignment(a, "owner", task, read);
  await assert.rejects(checkPreparationAssignment(a, "other", task, read), /PREPARATION_ASSIGNMENT_INVALID/);
  await assert.rejects(checkPreparationAssignment({ ...a, previous: {} }, "owner", task, read), /PREPARATION_PARENT_INVALID/);
});

test("supplements pin an approved parent and retain exact task, worker, scope and action", async () => {
  const sha = data => createHash("sha256").update(data).digest("hex");
  const fullTask = { ...task, scope: ["module"], action: { executable: "node", args: ["check.mjs"] } };
  const plan = Buffer.from(JSON.stringify({ schema: "context.preparation-plan.v1", owner: "owner", semanticPackage: { task: fullTask } }));
  const approval = Buffer.from(JSON.stringify({ schema: "context.package-approval.v1", owner: "owner", decision: "approved", planSha256: sha(plan) }));
  const files = { plan, approval };
  const a = { ...packet().assignment, phase: "supplement", previous: {
    plan: { path: "plan", sha256: sha(plan) }, approval: { path: "approval", sha256: sha(approval) } } };
  const readParent = async p => files[p];
  await checkPreparationAssignment(a, "owner", fullTask, readParent);
  for (const changed of [{ ...fullTask, worker: "other" }, { ...fullTask, id: "other" }, { ...fullTask, scope: ["wider"] }, { ...fullTask, action: {} }]) {
    await assert.rejects(checkPreparationAssignment(a, "owner", changed, readParent), /PREPARATION_PARENT_MISMATCH/);
  }
  files.approval = Buffer.from(approval.toString().replace("approved", "revoked"));
  await assert.rejects(checkPreparationAssignment(a, "owner", fullTask, readParent), /PREPARATION_PARENT_CHANGED/);
  a.previous.approval.sha256 = sha(files.approval);
  await assert.rejects(checkPreparationAssignment(a, "owner", fullTask, readParent), /PREPARATION_PARENT_MISMATCH/);
});
