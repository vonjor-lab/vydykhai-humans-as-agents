// Structural checks cannot establish semantic completeness or grant authority.
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { parseContextJson } from "./context-run.mjs";

const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v, expected) => object(v) && Object.keys(v).sort().join() === [...expected].sort().join();
const text = v => typeof v === "string" && v.trim().length > 0;
const list = v => Array.isArray(v) && v.length <= 256;
const need = (v, code) => { if (!v) throw new Error(code); };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const ref = v => keys(v, ["path", "sha256"]) && text(v.path) && /^[a-f0-9]{64}$/.test(v.sha256);

export async function checkPreparationAssignment(assignment, owner, task, read, moduleAccess = null, alignment = null, navigation = null) {
  need(keys(assignment, ["owner", "requestId", "question", "phase", "previous"]) && assignment.owner === owner &&
    text(assignment.requestId) && text(assignment.question) && ["initial", "supplement"].includes(assignment.phase), "PREPARATION_ASSIGNMENT_INVALID");
  if (assignment.phase === "initial") {
    need(assignment.previous === null, "PREPARATION_PARENT_INVALID"); return;
  }
  const previous = assignment.previous;
  need(keys(previous, ["plan", "approval"]) && ref(previous.plan) && ref(previous.approval), "PREPARATION_PARENT_INVALID");
  const planBytes = await read(previous.plan.path), approvalBytes = await read(previous.approval.path);
  need(hash(planBytes) === previous.plan.sha256 && hash(approvalBytes) === previous.approval.sha256, "PREPARATION_PARENT_CHANGED");
  const plan = parseContextJson(planBytes), approval = parseContextJson(approvalBytes);
  need(plan.schema === "context.preparation-plan.v1" && plan.owner === owner &&
    approval.schema === "context.package-approval.v1" && approval.owner === owner && approval.decision === "approved" &&
    approval.planSha256 === previous.plan.sha256 && isDeepStrictEqual(plan.semanticPackage?.task, task), "PREPARATION_PARENT_MISMATCH");
  if (plan.semanticPackage?.moduleAccess) need(isDeepStrictEqual(plan.semanticPackage.moduleAccess, moduleAccess), "MODULE_ACCESS_REBRIEF_REQUIRED");
  if (plan.semanticPackage?.navigation?.product) {
    need(isDeepStrictEqual(plan.semanticPackage.navigation.product, navigation?.product), "PRODUCT_REBRIEF_REQUIRED");
    const parentRef = plan.artifacts?.find(r => r.path === `${previous.plan.path.slice(0, -"plan.json".length)}navigation.json`);
    need(ref(parentRef), "PRODUCT_PARENT_NAVIGATION_MISSING");
    const parentBytes = await read(parentRef.path);
    need(hash(parentBytes) === parentRef.sha256, "PRODUCT_PARENT_NAVIGATION_CHANGED");
    const parent = parseContextJson(parentBytes);
    need(parent.outcome === navigation.outcome && parent.constraints.every(c => navigation.constraints.some(n => isDeepStrictEqual(c, n))), "PRODUCT_REBRIEF_REQUIRED");
    for (const id of new Set([...productReferenceIds(navigation.product), ...parent.constraints.flatMap(c => c.referenceIds)])) {
      need(isDeepStrictEqual(parent.references.find(r => r.id === id), navigation.references.find(r => r.id === id)), "PRODUCT_REBRIEF_REQUIRED");
    }
  }
  if (plan.semanticPackage?.schema === "context.package.v3") {
    const { review: oldReview, ...oldMeaning } = plan.semanticPackage.alignment;
    const { review, ...meaning } = alignment ?? {};
    need(isDeepStrictEqual(oldMeaning, meaning), "ALIGNMENT_REBRIEF_REQUIRED");
  }
}

export async function prepareNavigation(navigation, task, read, requiredContracts, modules = null) {
  const hasProduct = object(navigation) && Object.hasOwn(navigation, "product");
  need(keys(navigation, ["taskId", "worker", "preparedBy", "outcome", "references", "constraints", "gaps", "assignment", ...(hasProduct ? ["product"] : [])]) &&
    navigation.taskId === task.id && navigation.worker === task.worker &&
    text(navigation.preparedBy) && navigation.preparedBy !== task.worker && text(navigation.outcome), "NAVIGATION_IDENTITY_INVALID");
  need(list(navigation.references) && navigation.references.length > 0 && navigation.references.every(object) && list(navigation.constraints) &&
    list(navigation.gaps), "NAVIGATION_SCHEMA_INVALID");
  need(list(requiredContracts) && requiredContracts.length > 0 && requiredContracts.every(text), "NAVIGATION_CONTRACT_ROUTE_MISSING");
  need(requiredContracts.every(p => navigation.references.some(r => r.path === p && r.appliesTo === "task")), "NAVIGATION_CONTRACT_UNREAD");
  const ids = new Set(), references = [];
  for (const r of navigation.references) {
    const explicit = object(r) && (Object.hasOwn(r, "startLine") || Object.hasOwn(r, "endLine"));
    need(keys(r, ["id", "path", "quote", "purpose", "appliesTo", ...(explicit ? ["startLine", "endLine"] : [])]) && text(r.id) && !ids.has(r.id) &&
      text(r.path) && text(r.quote) && text(r.purpose) && ["task", "preparation"].includes(r.appliesTo), "NAVIGATION_REFERENCE_INVALID");
    const bytes = await read(r.path);
    const body = bytes.toString("utf8").replaceAll("\r\n", "\n"), quote = r.quote.replaceAll("\r\n", "\n");
    const lines = body.split("\n");
    if (lines.at(-1) === "") lines.pop();
    let { startLine, endLine } = r;
    if (!explicit) {
      // The model selects source meaning; exact coordinates come from file bytes.
      const offset = body.indexOf(quote);
      need(offset >= 0, "NAVIGATION_QUOTE_MISMATCH");
      need(body.indexOf(quote, offset + 1) < 0, "NAVIGATION_QUOTE_AMBIGUOUS");
      startLine = body.slice(0, offset).split("\n").length;
      endLine = body.slice(0, offset + quote.length).split("\n").length - (quote.endsWith("\n") ? 1 : 0);
    }
    need(Number.isSafeInteger(startLine) && Number.isSafeInteger(endLine) &&
      startLine >= 1 && endLine >= startLine && endLine <= lines.length, "NAVIGATION_LINE_RANGE_INVALID");
    if (explicit) {
      const selected = lines.slice(startLine - 1, endLine).join("\n") + (endLine < lines.length || body.endsWith("\n") ? "\n" : "");
      need(selected.includes(quote), "NAVIGATION_QUOTE_MISMATCH");
    }
    ids.add(r.id);
    references.push({ ...r, quote, startLine, endLine, sha256: hash(bytes) });
  }
  const constraints = [];
  for (const c of navigation.constraints) {
    need(keys(c, ["text", "appliesTo", "referenceIds"]) && text(c.text) &&
      ["task", "preparation"].includes(c.appliesTo) && list(c.referenceIds) && c.referenceIds.length > 0 &&
      c.referenceIds.every(id => ids.has(id)), "NAVIGATION_CONSTRAINT_INVALID");
    if (c.appliesTo === "task") {
      need(c.referenceIds.every(id => references.find(r => r.id === id).appliesTo === "task"), "NAVIGATION_ROLE_CONFLICT");
      constraints.push(c);
    }
  }
  for (const gap of navigation.gaps) {
    need(keys(gap, ["text", "critical"]) && text(gap.text) && typeof gap.critical === "boolean", "NAVIGATION_GAP_INVALID");
    need(!gap.critical, "NAVIGATION_CRITICAL_GAP");
  }
  const { owner, requestId, phase, previous } = navigation.assignment;
  if (hasProduct) checkProductNavigation(navigation.product, task, references, modules);
  return { schema: "context.navigation.v1", taskId: task.id, worker: task.worker,
    assignment: { owner, requestId, phase, previous }, outcome: navigation.outcome,
    references: references.filter(r => r.appliesTo === "task"), constraints, gaps: navigation.gaps,
    ...(hasProduct ? {product: navigation.product} : {}) };
}

// Project records own the meaning; navigation only binds the selected slice and
// refuses silent owner replacement. Evidence presence is not source authentication.
export function checkProductNavigation(product, task, references, modules) {
  need(keys(product, ["goalRef", "outcomeRef", "planRef", "capabilityRefs", "modules"]), "PRODUCT_NAVIGATION_INVALID");
  const use = id => {
    const r = references.find(r => r.id === id && r.appliesTo === "task");
    need(text(id) && r, "PRODUCT_SOURCE_MISSING");
    return r;
  };
  [product.goalRef, product.outcomeRef, product.planRef].forEach(use);
  need(list(product.capabilityRefs) && product.capabilityRefs.length > 0 &&
    new Set(product.capabilityRefs).size === product.capabilityRefs.length, "PRODUCT_CAPABILITY_INVALID");
  product.capabilityRefs.forEach(use);
  need(list(modules) && modules.length > 0 && list(product.modules) &&
    product.modules.length === modules.length &&
    new Set(product.modules.map(m => m?.id)).size === modules.length, "PRODUCT_MODULE_COVERAGE");
  for (const m of product.modules) {
    need(keys(m, ["id", "owner", "ownerContext", "ownerRef", "contractRef", "route", "authorityRef", "reason", "state"]) &&
      text(m.owner) && text(m.ownerContext) && text(m.reason), "PRODUCT_OWNER_INVALID");
    const declared = modules.find(d => d.id === m.id);
    need(declared, "PRODUCT_MODULE_COVERAGE");
    use(m.ownerRef);
    need(declared.contractFiles.includes(use(m.contractRef).path), "PRODUCT_CONTRACT_MISMATCH");
    need(["owner", "assist", "integrate", "transfer"].includes(m.route), "PRODUCT_ROUTE_INVALID");
    need(m.route !== "transfer", "PRODUCT_TRANSFER_PENDING");
    if (m.authorityRef !== null) use(m.authorityRef);
    if (declared.intent === "consume") {
      need(m.route === "integrate", "PRODUCT_CONSUMER_ROUTE");
    } else {
      need(m.route !== "integrate", "PRODUCT_PRODUCER_ROUTE");
      if (m.route === "owner") need(m.owner === task.worker, "PRODUCT_OWNER_MISMATCH");
      else need(m.owner !== task.worker && m.authorityRef !== null, "PRODUCT_DELEGATION_REQUIRED");
    }
    need(keys(m.state, ["needed", "implemented", "verified", "available"]), "PRODUCT_STATE_INVALID");
    for (const fact of Object.values(m.state)) {
      need(keys(fact, ["status", "referenceId"]) && ["YES", "NO", "UNKNOWN"].includes(fact.status), "PRODUCT_STATE_INVALID");
      if (fact.status !== "UNKNOWN" || fact.referenceId !== null) use(fact.referenceId);
    }
  }
}

export function productReferenceIds(product) {
  return [...new Set([product.goalRef,product.outcomeRef,product.planRef,...product.capabilityRefs,
    ...product.modules.flatMap(m => [m.ownerRef,m.contractRef,m.authorityRef,
      ...Object.values(m.state).map(f => f.referenceId)])].filter(id => id !== null))];
}
