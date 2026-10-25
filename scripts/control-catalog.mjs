// Candidate 2.0 operational criteria. Coverage is not proof of semantic truth.
// Existing workflow sources remain authority; this module enumerates review obligations.
const definitions = [
  ["C01", "Goals", "AGENTS_CORE.md", [
    "Task names its accepted parent goal and DOD contribution",
    "Current scope distinguishes required outcome from optional work",
    "Next action advances an observable accepted outcome"]],
  ["C02", "Ideas and recall", "workflows/framework-orchestrator.md", [
    "Relevant ideas and promised recall are retrieved",
    "New ideas have an explicit disposition rather than silent scope expansion",
    "Deferred commitments retain an owner and return condition"]],
  ["C03", "Authority", "AGENTS_CORE.md", [
    "Affected actions have current scoped permission",
    "Human pauses and conflicting instructions are reconciled before action",
    "Exceptions retain an authorized decision, scope and expiry or return condition"]],
  ["C04", "Prior work", "workflows/context-route.md", [
    "Applicable historical purpose and current decision corrections are traced to sources",
    "Accepted successes include exact artifact and entry conditions",
    "Rejected approaches are identified with their reasons",
    "Assisted demonstrations are distinguished from autonomous accepted capability"]],
  ["C05", "Preparation", "workflows/context-preparation.md", [
    "Source coverage includes relevant corrections and open obligations",
    "Worker packet is sufficient and confined to the affected boundary; adopted controlled actions have an independent readiness disposition bound to the current packet, permitted command and source revisions before execution, reused only while the authorized binding remains unchanged",
    "Worker readback and actual plan or tests demonstrate application"]],
  ["C06", "Modules", "workflows/module-contract-template.md", [
    "Work is explicitly classified as consume, change or create",
    "Public contract names version, inputs, outputs, limits and state ownership",
    "Ordinary consumption does not require producer implementation context",
    "New or changed boundaries have an approved decision and independent connection proof"]],
  ["C07", "Composites", "workflows/module-delivery.md", [
    "Composite ownership covers child interaction rather than bypassing child contracts",
    "Combined errors, state and persistence responsibilities are explicit",
    "The promised combined input-to-output behavior is exercised"]],
  ["C08", "Model routing", "workflows/context-routing.md", [
    "Selected model and effort have recorded capability and cost rationale",
    "Escalation and recovery preserve agreed limits and actual usage evidence"]],
  ["C09", "Work mode", "workflows/start-work.md", [
    "Known execution and unresolved Discovery questions are distinguished",
    "Lab work has a baseline, bounded changed variable and representative conditions",
    "Experimental results retain their transfer limits"]],
  ["C10", "Version identity", "workflows/accept-work.md", [
    "Accepted success revision is preserved and identifiable",
    "Current candidate and tested runtime match the claimed result",
    "Local and shared publication differences are explicit"]],
  ["C11", "Ownership", "workflows/framework-orchestrator.md", [
    "One current execution owner is retained without duplicate dispatch",
    "Assignment and dependencies are visible in the existing lease",
    "Resume uses current assignment and checkpoint rather than historical instructions"]],
  ["C12", "Custody", "workflows/accept-work.md", [
    "Inventory includes unowned and local-only artifacts, not just active tasks",
    "Unique work is preserved before authorized cleanup",
    "Remaining branches and worktrees have custody and a finite review condition",
    "Temporary runtimes and monitors are stopped or explicitly retained"]],
  ["C13", "Code structure", "workflows/module-delivery.md", [
    "Changed code respects responsibility and dependency boundaries",
    "Size outliers have a cohesion-based decision rather than arbitrary fragmentation"]],
  ["C14", "Maps and documentation", "workflows/module-contract-template.md", [
    "Whole-project map completeness is evidenced or remains explicitly owned work",
    "Affected module routes and consumer documentation match the candidate",
    "Algorithm rationale and preserved design choices are documented"]],
  ["C15", "Semantic memory", "workflows/project-memory-graph-template.md", [
    "Current assertions are reconciled without silent contradiction or duplicate meaning",
    "Supersession preserves sources and decision history",
    "Ordinary future-work retrieval finds and applies relevant decisions",
    "Shared meaning changes have an accountable integration owner"]],
  ["C16", "Memory storage", "workflows/memory-storage.md", [
    "Storage capacity limitations do not silently discard meaning",
    "Failed writes remain owned pending deltas rather than integrated knowledge",
    "Actual stored revision is read back after publication or expansion"]],
  ["C17", "Shared knowledge", "workflows/daily-alignment.md", [
    "Participant contributions retain source and scope",
    "Shared integration resolves conflicting versions",
    "Affected recipients retrieve and apply the integrated knowledge"]],
  ["C18", "Tracker", "workflows/project-launch.md", [
    "Issue and actual board membership and status are reconciled",
    "Dependencies and blockers match the current work",
    "Planning windows follow the accepted team convention"]],
  ["C19", "Behavior proof", "workflows/accept-work.md", [
    "New and retained behavior are tested on the exact candidate",
    "Independent public use exercises promised inputs and errors",
    "Manual corrections or mocks are not substituted for promised autonomy"]],
  ["C20", "Result delivery", "workflows/task-context-handoff-template.md", [
    "Exact producer Return is durably retained",
    "Consumer disposition refers to the actual returned result",
    "Next authorized action is observed or a concrete wait is retained"]],
  ["C21", "Failure recovery", "workflows/production-continuation.md", [
    "Stall decisions use current observable progress and the task envelope",
    "Unknown external outcomes reconcile before any replay",
    "Failure attempts and original incident survive renaming and restart"]],
  ["C22", "Context health", "workflows/framework-orchestrator.md", [
    "Recall or identity failures trigger an evidenced recovery decision",
    "Rotation preserves source coverage and pending obligations",
    "Context replacement uses the existing human-confirmed cutover"]],
  ["C23", "Updates", "workflows/framework-activation.md", [
    "Due update consideration and actual active version are recorded",
    "Changed capabilities have observed adoption beyond copied files",
    "Unfinished workers retain progress and apply changes at a safe boundary"]],
  ["C24", "System health", "workflows/module-delivery.md", [
    "Due integrity review is enrolled outside the active manager conversation",
    "Unknown project areas remain visible rather than being inferred healthy",
    "Findings retain criteria, owners, checkpoints and independently checked repairs",
    "Inherited, discovered and created debt are distinguished in progress assessment",
    "Deep review respects the agreed budget window without postponing urgent safety"]],
  ["C25", "Security", "FRAMEWORK.md", [
    "Protected operational knowledge uses authorized references and access routes",
    "Packets, memory and reports do not disclose secret values",
    "Current environment and permissions are checked before protected action"]],
  ["C26", "Mutation safety", "workflows/accept-work.md", [
    "Mutation identifies the exact target and actual scope authority",
    "Required human merge, deploy and deletion approvals are retained",
    "Data and recovery evidence are preserved before irreversible action",
    "Post-action readback establishes the actual result or preserves uncertainty"]],
  ["C27", "Effectiveness", "workflows/context-routing.md", [
    "Productivity uses retained comparable outcomes and all-stage cost rather than activity",
    "Lessons preserve confounders and distinguish observation from causal claims"]],
  ["C28", "Provenance", "AGENTS_CORE.md", [
    "Creator, license and required provenance remain intact",
    "Universal publication excludes private project history and protected artifacts"]],
];

export const controlCatalog = Object.freeze(definitions.map(([id, title, source, criteria]) =>
  Object.freeze({id, title, source: `docs/${source}`, checks: Object.freeze(criteria.map((criterion, i) =>
    Object.freeze({id: `${id}.${String(i + 1).padStart(2, "0")}`, criterion})))})));
export const controlCheckIds = Object.freeze(controlCatalog.flatMap(group => group.checks.map(check => check.id)));

// Phase ownership is policy, not an inferred PASS for another stage. HEALTH
// retains the whole catalog; task gates always retain acceptance/use/write checks.
const shared = ['C01','C03','C06','C07.03','C10.02','C11.01','C12.03','C14.02',
  'C16.03','C18.01','C19.01','C20.01','C20.02','C24.02','C25','C26.01','C26.02'];
const phaseSelectors = Object.freeze({
  PRE: [...shared,'C02','C04','C05.01','C05.02','C07.01','C07.02','C08.01','C09','C11.02','C15.01','C15.03','C26.03'],
  POST: [...shared,'C02.02','C02.03','C05.02','C05.03','C07.01','C07.02','C10.01','C10.03','C11.03',
    'C12.02','C12.04','C13','C14.03','C15','C16.01','C16.02','C17','C18.02','C18.03',
    'C19.02','C19.03','C20.03','C21.02','C21.03','C26.04','C28']
});
export function phaseControlIds(input = {}) {
  if (input.reviewPolicy === undefined) return controlCheckIds;
  if (input.reviewPolicy !== 'PHASED_V1' || !input.acceptance || !Array.isArray(input.previousFindings))
    throw Error('CONTROL_PHASE_POLICY_INVALID');
  const selectors = phaseSelectors[input.preparation ? 'PRE' : 'POST'];
  const retained = new Set(input.previousFindings.map(f => f.checkId));
  if ([...retained].some(id => !controlCheckIds.includes(id))) throw Error('CONTROL_PHASE_FINDING_INVALID');
  return controlCheckIds.filter(id => retained.has(id) || selectors.some(s => id === s || id.startsWith(s + '.')));
}
export const controlPhaseOwnership = Object.freeze(Object.fromEntries(controlCheckIds.map(id => [id,
  Object.freeze(['HEALTH', ...Object.keys(phaseSelectors).filter(phase =>
    phaseSelectors[phase].some(s => id === s || id.startsWith(s + '.')))])])));

// Compact wire representation only: no inferred PASS, ranges, defaults or omitted
// checks. The same complete per-criterion validator still owns admission.
export function expandControlRows(answer) {
  if (Array.isArray(answer?.rows) && answer.rowGroups === undefined) return answer.rows;
  if (answer?.rows !== undefined || !Array.isArray(answer?.rowGroups) || answer.rowGroups.length > controlCheckIds.length ||
      !answer.evidence || typeof answer.evidence !== "object" || Array.isArray(answer.evidence))
    throw Error("MODEL_REVIEW_ROWS_INVALID");
  const rows=[];
  for (const {ids, evidenceRef, ...body} of answer.rowGroups) {
    if (!Array.isArray(ids) || !ids.length || ids.length > controlCheckIds.length ||
        typeof evidenceRef !== "string" || !Object.hasOwn(answer.evidence,evidenceRef) || Object.hasOwn(body,"id") || Object.hasOwn(body,"evidence"))
      throw Error("MODEL_REVIEW_ROW_GROUP_INVALID");
    for (const id of ids) rows.push({...body,id,evidence:answer.evidence[evidenceRef]});
  }
  if (!checkControlCoverage(rows).ok) throw Error("MODEL_REVIEW_COVERAGE_INVALID");
  return rows;
}

// Check all operational rows, including a reason for exclusions. The independent
// source review establishes applicability/meaning; this function cannot infer it.
export function checkControlCoverage(rows, expectedIds = controlCheckIds) {
  const filled = v => typeof v === "string" && v.trim().length > 0;
  const fail = reason => ({ok: false, reason, semanticAcceptance: "NOT_ESTABLISHED"});
  if (!Array.isArray(expectedIds) || !expectedIds.length || new Set(expectedIds).size !== expectedIds.length ||
      expectedIds.some(id => !controlCheckIds.includes(id))) return fail('INVALID_COVERAGE_POLICY');
  if (!Array.isArray(rows) || rows.length !== expectedIds.length ||
      new Set(rows.map(r => r?.id)).size !== rows.length ||
      Array.from(rows).some(r => !expectedIds.includes(r?.id))) return fail("INCOMPLETE_CATALOG");
  for (const row of rows) {
    if (!["PASS", "FINDING", "UNKNOWN", "DEFERRED", "NOT_APPLICABLE"].includes(row.status))
      return fail(`INVALID_DISPOSITION:${row.id}`);
    if (!filled(row.evidence)) return fail(`MISSING_EVIDENCE:${row.id}`);
    if (row.status !== "PASS" && !filled(row.reason)) return fail(`MISSING_REASON:${row.id}`);
    if (["FINDING", "UNKNOWN", "DEFERRED"].includes(row.status) && !filled(row.findingId))
      return fail(`UNOWNED_DISPOSITION:${row.id}`);
  }
  return {ok: true, semanticAcceptance: "NOT_ESTABLISHED"};
}
