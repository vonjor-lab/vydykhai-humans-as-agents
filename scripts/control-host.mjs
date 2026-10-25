// Local trusted host capabilities. Never expose these mutation methods directly
// as worker tools. OS/process identity and sandbox setup belong to the launcher.
import {openControlStore} from "./control-store.mjs";
import {validProductAcceptance, observeRetention, observeAcceptanceSources, postAcceptKey, assessPostAccept, reviewedResultUse,
  observeTerminalDisposition, reviewedTerminalDisposition, terminalActions, confirmedControlActions} from "./post-accept.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";
import {randomUUID} from "node:crypto";
import {openReviewSources, validateReviewSourceScope} from "./control-review-sources.mjs";
import {initialHealth, healthControl, healthId} from "./control-health.mjs";
import {checkFindingLeases} from "./finding-history.mjs";
import {readCommandEffects} from "./control-health-domain.mjs";
import {readCommandEnvironment} from "./context-run.mjs";
import {reviewEpisodeDescriptor as episodeDescriptor,reviewEpisodeProgress as episodeProgress,
  validateReviewEpisodeSpec} from "./control-review-partitions.mjs";

const hash = value => sha256(canonicalJson(value));
const filled = v => typeof v === "string" && v.trim().length > 0;
const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const need = (v, code) => {if (!v) throw Error(code);};
const exactKeys = (v, names) => v && typeof v === "object" && !Array.isArray(v) &&
  Object.keys(v).sort().join() === [...names].sort().join();
const validCommandFailure = f => exactKeys(f, ["exitCode", "signal", "reason", "commandSha256", "cwd", "executable",
  "process", "stdoutSha256", "stderrSha256", "stdoutBytes", "stderrBytes"]) &&
  (f.exitCode === null || Number.isSafeInteger(f.exitCode)) &&
  (f.signal === null || typeof f.signal === "string" && /^[A-Z][A-Z0-9]{0,31}$/.test(f.signal)) &&
  ["COMMAND_FAILED", "COMMAND_SIGNALLED", "COMMAND_TIMEOUT", "COMMAND_OUTPUT_LIMIT", "COMMAND_START_FAILED"].includes(f.reason) &&
  (f.exitCode !== 0 || f.reason !== "COMMAND_FAILED") &&
  [f.commandSha256, f.stdoutSha256, f.stderrSha256].every(digest) && [f.cwd, f.executable].every(filled) &&
  [f.stdoutBytes, f.stderrBytes].every(n => Number.isSafeInteger(n) && n >= 0) &&
  exactKeys(f.process, ["launchId", "pid", "groupId", "startedAt", "closedAt", "launchExecutable", "launchArgsSha256"]) &&
  typeof f.process.launchId === "string" && /^[a-f0-9-]{36}$/.test(f.process.launchId) &&
  [f.process.pid, f.process.groupId].every(n => n === null || Number.isSafeInteger(n) && n > 0) &&
  Number.isFinite(Date.parse(f.process.startedAt)) && Number.isFinite(Date.parse(f.process.closedAt)) &&
  Date.parse(f.process.closedAt) >= Date.parse(f.process.startedAt) &&
  filled(f.process.launchExecutable) && digest(f.process.launchArgsSha256);
export const validPreparationAcceptanceIds = ids => Array.isArray(ids) && ids.length > 0 && ids.length <= 32 &&
  Array.from(ids).every(id => typeof id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(id) &&
    !["__proto__", "constructor", "prototype"].includes(id)) && new Set(ids).size === ids.length;

export async function openControlHost(directory, config, {createReturnSync, observeReviewRun, observeCommandFailure}) {
  need(config.reviewPolicy === undefined || config.reviewPolicy === 'PHASED_V1' &&
    config.health && config.requirePreparation === true && config.evidenceRegistry, 'CONTROL_PHASE_POLICY_INVALID');
  need(config.observationEvents === undefined || config.observationEvents &&
    exactKeys(config.observationEvents,['descriptorFile','mode','intervalSeconds']) &&
    typeof config.observationEvents.descriptorFile === 'string' && config.observationEvents.descriptorFile.startsWith('/') &&
    ['LOGIN','SESSION'].includes(config.observationEvents.mode) &&
    Number.isSafeInteger(config.observationEvents.intervalSeconds) && config.observationEvents.intervalSeconds >= 60 &&
    config.observationEvents.intervalSeconds <= 86400, 'CONTROL_EVENT_CONFIG_INVALID');
  need(config.requirePreparation === undefined || typeof config.requirePreparation === "boolean", "CONTROL_PREPARATION_POLICY_INVALID");
  need(config.reviewSourceScopes === undefined, "CONTROL_SCOPE_TABLE_UNSUPPORTED");
  need(filled(config.workspace) && digest(config.policy) && [config.owner, config.executor, config.reviewer].every(filled) &&
    new Set([config.owner, config.executor, config.reviewer]).size === 3, "CONTROL_CONFIG_INVALID");
  const store = await openControlStore(directory), configKey = hash(config);
  const schema = config.health ? "control.host.v2" : "control.host.v1";
  if(config.health)initialHealth(config);
  const retainedState = async () => {
    const row = await store.read();
    need(row?.state.schema === schema && row.state.configKey === configKey, "CONTROL_CONFIG_MISMATCH");
    return row;
  };
  const state = async () => (await retainedState()).state;
  const update = fn => store.transact(s => {
    need(s.schema === schema && s.configKey === configKey, "CONTROL_CONFIG_MISMATCH");
    fn(s); return s;
  });
  const health = config.health ? healthControl({state,update,config,observeReviewRun}) : null;
  const rowFor = (s, id) => {need(Object.hasOwn(s.acceptances, id), "ACCEPTANCE_NOT_FOUND"); return s.acceptances[id];};
  const executionFor = (s, id) => {
    const taskId = rowFor(s, id).acceptance.task;
    const scope = {taskId, authority: "HISTORICAL_EVIDENCE_NOT_EXECUTION_PERMISSION", outsideHost: "UNKNOWN"};
    if (!s.grants || !s.reservations) return {...scope, coverage: "HOST_REGISTRY_UNAVAILABLE",
      approvedCommands: null, reservations: null};
    const grants = Object.values(s.grants).filter(g => g.binding.taskId === taskId && !g.dependencies.includes(id));
    const grantIds = new Set(grants.map(g => g.id)), optionalDigest = value => digest(value) ? value : null;
    const preparations = [...new Set(grants.flatMap(g=>g.dependencies))].flatMap(id=>{
      const row=s.acceptances[id];
      if(!row?.preparationKey)return [];
      return [{id,acceptanceSha256:hash(row.acceptance),bindings:row.preparationBindings,
        review:row.review ? {sha256:hash(row.review),key:row.review.key,runId:row.review.runId,
          reviewer:row.review.reviewer,observedAt:row.review.observedAt,resultUse:row.review.resultUse,
          readiness:row.review.rows.find(r=>r.id==="C05.02")} : null,
        ownerDisposition:row.disposition}];
    });
    // A command depending on this immutable acceptance is later work, even for
    // the same task. Its unknown outcome is guarded separately by inputFor.
    return {...scope, coverage: "ACCEPTED_TASK_HOST_REGISTRY_ONLY",...(preparations.length?{preparations}:{}),
      approvedCommands: grants.map(g => ({id: g.id, taskId, bindingSha256: g.bindingSha256,
        recordSha256: hash(g), operation: ["resume", "accept"].includes(g.binding.operation) ? g.binding.operation : null,
        kind: ["dependent", "verification"].includes(g.binding.kind) ? g.binding.kind : null,
        taskSha256: optionalDigest(g.binding.taskSha256), capsuleSha256: optionalDigest(g.binding.capsuleSha256),
        sourceDigest: optionalDigest(g.binding.sourceDigest), dependencyDigest: optionalDigest(g.binding.dependencyDigest),
        commandSha256: optionalDigest(g.binding.commandSha256), reviewReceiptSha256: sha256(g.reviewReceipt),
        dependencies: [...g.dependencies], expiresAt: g.expiresAt})).sort((a, b) => a.id.localeCompare(b.id)),
      reservations: Object.values(s.reservations).filter(r => !r.dependencies.includes(id) &&
        (r.nextTask === taskId || grantIds.has(r.grantId)))
        .map(r => ({id: r.reservationId, grantId: r.grantId, taskId: r.nextTask, bindingSha256: r.bindingSha256,
          recordSha256: hash(r), status: r.status, dependencies: [...r.dependencies],
          resultSha256: optionalDigest(r.resultSha256),
          ...(r.commandEnvironment ? {commandEnvironment: r.commandEnvironment} : {})})).sort((a, b) => a.id.localeCompare(b.id))};
  };
  const reviewScope = (s, id) => hash({row: rowFor(s, id), paused: s.paused, execution: executionFor(s, id)});
  const overdue = row => row.findings.some(f => f.status === "OPEN" && Date.parse(f.reviewAt) <= Date.now());
  // Legacy closure is history, not permission to reuse. Missing result-use
  // proof alone must not spend review budget before an owned use request.
  const closedReviewDue = input => {
    const action = assessPostAccept(input).action;
    return !confirmedControlActions.includes(action) &&
      !(action === "RESULT_USE_UNPROVEN" && input.review?.resultUse === undefined);
  };
  const reviewPending = row => row.reviewLease || ["REVIEW_DUE", "REVIEW_EPISODE_DUE", "REVIEW_IN_FLIGHT", "REVIEW_RECONCILIATION_REQUIRED"].includes(row.enrollment);
  const episodeBasis = (key,input) => hash({key,input:{...input,review:null,disposition:null}});
  const assertEpisodeBasis = async (s,id,fresh,reject=true) => {
    const e=rowFor(s,id).reviewEpisode;
    if(!e)return;
    const reason=e.invalidated || (e.basisSha256!==episodeBasis(postAcceptKey(fresh),fresh)?
      "REVIEW_EPISODE_BASIS_CHANGED":Date.now()>=Date.parse(e.startedAt)+e.spec.maxDurationMs?
        "REVIEW_EPISODE_EXPIRED":null);
    if(!reason)return;
    await update(current=>{need(reviewScope(current,id)===reviewScope(s,id),"REVIEW_SOURCE_CHANGED");
      rowFor(current,id).reviewEpisode.invalidated=reason;
      rowFor(current,id).enrollment="REVIEW_RECONCILIATION_REQUIRED";});
    if(reject)throw Error(reason);
    return reason;
  };
  const sourceScopeFor = row => {
    let scope = row.reviewSourceScope;
    if(scope !== undefined) validateReviewSourceScope(scope,row.acceptance);
    need(row.reviewSourceScopeRevisions === undefined || Array.isArray(row.reviewSourceScopeRevisions),
      "REVIEW_SOURCE_SCOPE_INVALID");
    let previous = scope, reviewedExpansion = false;
    for(const revision of row.reviewSourceScopeRevisions ?? []) {
      validateReviewSourceScope(revision.scope,row.acceptance);
      const attempt = row.reviewAttempts?.find(a=>a.lease.runId === revision.stoppedRunId);
      const initial = revision.phase === "BEFORE_FIRST_REVIEW";
      const authorized = initial ? !reviewedExpansion && revision.stoppedRunId === undefined :
        revision.phase === undefined && attempt?.observation.state === "STOPPED" &&
        attempt.observation.runId === revision.stoppedRunId && attempt.decision.action === "RETRY" &&
        attempt.decision.reviewer === config.reviewer && filled(attempt.decision.evidence);
      need(scope && revision.owner === config.owner && filled(revision.evidence) &&
        Number.isFinite(Date.parse(revision.recordedAt)) && authorized &&
        revision.currentScopeSha256 === hash(scope) && revision.previous === hash(previous) &&
        revision.scope.sourceIds.length > scope.sourceIds.length &&
        scope.sourceIds.every(id=>revision.scope.sourceIds.includes(id)), "REVIEW_SOURCE_SCOPE_REVISION_INVALID");
      scope = revision.scope;previous = revision;reviewedExpansion ||= !initial;
    }
    return scope;
  };
  const inputFor = async (s, id, newReview = false, inspectRelated = false) => {
    const row = rowFor(s, id);
    const retentionRevision = row.retentionRevisions?.at(-1);
    const sourceScopeRevision = row.reviewSourceScopeRevisions?.at(-1);
    let sourceEvidence;
    const scope = sourceScopeFor(row);
    need(scope === undefined || config.evidenceRegistry !== undefined,
      "REVIEW_SOURCE_SCOPE_UNBOUND");
    if(config.evidenceRegistry!==undefined) {
      const sources=await openReviewSources(config.evidenceRegistry);
      need(sources.workspace===config.workspace,"CONTROL_EVIDENCE_WORKSPACE_MISMATCH");
      sourceEvidence=await sources.snapshot(scope);
    }
    // Source references locate related work; only the host supplies its actual
    // control outcome. An owner's prose or a terminal proposal is not that proof.
    const relatedAcceptances=[];
    for(const [relatedId,related] of Object.entries(s.acceptances)) {
      if(!(row.relatedControlEvidence || inspectRelated) || relatedId===id || !sourceEvidence?.rows.some(source=>source.status==="AVAILABLE" &&
        [related.acceptance.artifact,related.terminalArtifact].filter(Boolean)
          .some(ref=>ref.path===source.path && ref.sha256===source.sha256)))continue;
      relatedAcceptances.push({id:relatedId,authority:"HOST_HISTORY_NOT_NEW_EXECUTION_PERMISSION",
        acceptance:related.acceptance,acceptanceSha256:hash(related.acceptance),enrollment:related.enrollment,
        recordSha256:hash(related),review:related.review ? {sha256:hash(related.review),key:related.review.key,
          runId:related.review.runId,reviewer:related.review.reviewer,observedAt:related.review.observedAt,
          resultUse:related.review.resultUse} : null,ownerDisposition:related.disposition,
        sourceObservation:await observeAcceptanceSources(config.workspace,related.acceptance),
        retentionObservation:await observeRetention(config.workspace,{...related.acceptance,
          retention:related.retentionRevisions?.at(-1)?.retention ?? related.acceptance.retention})});
    }
    return {acceptance: row.acceptance, policy: config.policy, execution: executionFor(s, id),
      ...(config.reviewPolicy === undefined ? {} : {reviewPolicy:config.reviewPolicy}),
      ...(relatedAcceptances.length?{relatedAcceptances}:{}),
      ...(row.preparationKey ? {preparation:{kind:"PREPARED_PACKAGE_NOT_TASK_OUTPUT",
        bindings:row.preparationBindings, key:row.preparationKey}} : {}),
      ...(row.terminalArtifact ? {terminalObservation:
        await observeTerminalDisposition(config.workspace, row.acceptance, row.terminalArtifact)} : {}),
      ...(sourceEvidence?{sourceEvidence}:{}),
      sourceObservation: await observeAcceptanceSources(config.workspace,row.acceptance),
      previousFindings: newReview ? row.findings : row.previousFindings,
      ...(newReview ? {repairRequest:row.repairRequest ?? null} : {}),
      ...(newReview && row.review ? {previousReviewEvidence: {runId:row.review.runId,key:row.review.key,
        evidenceIndex:row.review.evidenceIndex??null}} : {}),
      ...(retentionRevision ? {retentionRevision} : {}),
      ...(sourceScopeRevision ? {sourceScopeRevision} : {}),
      observation: await observeRetention(config.workspace, {...row.acceptance,
        retention: retentionRevision?.retention ?? row.acceptance.retention}), repairLeases: row.repairLeases,
      review: row.review, disposition: row.disposition, paused: s.paused,
      externalUnknown: !s.grants || !s.reservations ||
        Object.values(s.reservations).some(r => r.status === "IN_FLIGHT" && r.dependencies.includes(id))};
  };
  const stableInputFor = async (s, id) => {
    // Two bounded source sweeps detect torn readback, not an atomic lock against
    // external writers. Later due/admission observations still re-read sources.
    const before = await inputFor(s, id);
    need(reviewScope(await state(), id) === reviewScope(s, id), "CONTROL_SOURCE_CHANGED");
    const after = await inputFor(s, id);
    need(hash(after) === hash(before), "CONTROL_SOURCE_CHANGED");
    return after;
  };
  const readiness = async (s, dependencies, nextTask) => {
    need(!s.paused, "CONTROL_PAUSED");
    if(health)await health.assertReady(nextTask);
    need(!Object.values(s.reservations).some(r => r.status === "IN_FLIGHT" && r.nextTask === nextTask),
      "TASK_OUTCOME_UNKNOWN");
    for (const id of dependencies) {
      need(!reviewPending(rowFor(s, id)), "REVIEW_PENDING");
      const input = await inputFor(s, id), assessed = assessPostAccept(input);
      need(["VERIFY_CONTINUATION", "CONTROL_CONFIRMED"].includes(assessed.action) &&
        input.disposition?.action === "CONTINUE" && input.disposition.nextAction === nextTask, "POST_ACCEPT_CONTROL_PENDING");
    }
  };
  const authorize = async binding => {
    const s = await state(), key = hash(binding), grant = s.grants[key];
    need(grant && grant.expiresAt > Date.now() && !s.reservations[grant.id], "COMMAND_NOT_APPROVED");
    assertPreparation(s, binding, grant.dependencies);
    await readiness(s, grant.dependencies, binding.taskId);
    return {...grant, decision: "ALLOW", stateRevision: hash(s)};
  };
  const preparationKey = binding => hash(binding);
  const assertPreparation = (s, binding, dependencies) => {
    if(!config.requirePreparation)return;
    need(dependencies.some(id => s.acceptances[id]?.preparationBindings?.some(b=>preparationKey(b)===preparationKey(binding))),
      "PREPARATION_REVIEW_REQUIRED");
  };
  return {
    health,
    async initialize() {
      return store.initialize({schema, configKey, paused: false,
        acceptances: {}, grants: {}, reservations: {}, ...(health ? {health:initialHealth(config)} : {})});
    },
    async snapshot() {return state();},
    async relatedAcceptanceEvidence(id) {
      return (await inputFor(await state(),id,false,true)).relatedAcceptances??[];
    },
    async relatedControlPolicy() {
      return Object.entries((await state()).acceptances).filter(([,row])=>row.relatedControlEvidence===true)
        .map(([id])=>id).sort();
    },
    async eventControlPolicy() {
      const s=await state(), preparations={};
      for(const [id,row] of Object.entries(s.acceptances))if(row.preparationKey) {
        need(Array.isArray(row.preparationBindings) && hash(row.preparationBindings)===row.preparationKey,
          "PREPARATION_BINDING_INVALID");
        preparations[id]=row.preparationKey;
      }
      return {schema:"control.event-policy.v1",requirePreparation:config.requirePreparation===true,
        periodicReview:config.health ? config.health.periodicReview!==false : null,preparations};
    },
    async reviewSourceScope(id) {
      return structuredClone(sourceScopeFor(rowFor(await state(), id)));
    },
    async preparationStatus(acceptanceIds, {expectedDigest} = {}) {
      need(validPreparationAcceptanceIds(acceptanceIds), "PREPARATION_ACCEPTANCE_IDS_INVALID");
      need(expectedDigest === undefined || digest(expectedDigest), "PREPARATION_DIGEST_INVALID");
      const s = await state(), inputs = [], rows = [];
      const scope = current => {
        const selected = acceptanceIds.map(id => rowFor(current, id));
        const tasks = selected.map(row => row.disposition?.nextAction).filter(filled);
        const related = row => row.dependencies.some(id => acceptanceIds.includes(id)) ||
          tasks.includes(row.binding?.taskId ?? row.nextTask);
        return hash({paused: current.paused, policy: config.policy, selected,
          grants: Object.values(current.grants).filter(related).map(grant => ({...grant, expired: grant.expiresAt <= Date.now()})),
          reservations: Object.values(current.reservations).filter(related)});
      };
      const scopeDigest = scope(s);
      // Read every selected record before returning anything; never enumerate
      // other tasks or expose acceptance paths, grants or raw evidence strings.
      for (const id of acceptanceIds) rowFor(s, id);
      for (const id of acceptanceIds) {
        const row = rowFor(s, id), input = await inputFor(s, id), assessed = assessPostAccept(input);
        // A previously consumed verdict can still assess as confirmed while a
        // newer review is claimed or unresolved. Match admission's live holds.
        const assessedAction = s.paused ? "PRESERVE_PAUSE" : reviewPending(row) ? "REVIEW_PENDING" :
          input.externalUnknown ? "RECONCILE_EXTERNAL_OUTCOME" : assessed.action;
        inputs.push(input);
        const retained = input.retentionRevision?.retention ?? row.acceptance.retention;
        const findings = row.findings.filter(f => f.status === "OPEN").map(f => ({
          id: f.id, checkId: f.checkId, owner: f.owner, work: f.work, status: f.status,
          blocksResume: f.blocksResume, attempts: f.attempts, reviewAt: f.reviewAt}));
        const repairLeases = row.repairLeases.filter(l => findings.some(f => f.owner === l.owner && f.work === l.work))
          .map(l => ({owner: l.owner, work: l.work, state: l.state, reviewAt: l.reviewAt}));
        rows.push({id, historicalAcceptance: {status: row.acceptance.status, acceptedAt: row.acceptance.acceptedAt,
          digest: hash(row.acceptance), temporalScope: "AT_ACCEPTANCE_NOT_CURRENT_CONTROL"},
          currentControl: {enrollment: row.enrollment, assessedAction,
            ...(row.closure ? {historicalClosure: row.closure} : {}),
            productAcceptance: assessed.productAcceptance, reviewInFlight: Boolean(row.reviewLease),
            externalOutcomeUnknown: input.externalUnknown, repairReviewOverdue: overdue(row),
            disposition: row.disposition?.action ?? null,
            continuationObserved: Boolean(row.disposition?.continuationEvidence)},
          retention: {temporalScope: "CURRENT_READBACK", revisionDigest: hash(input.retentionRevision ?? null),
            complete: input.observation.every(o => ["MATCH", "NOT_REQUIRED"].includes(o.status)),
            rows: input.observation.map(o => ({id: o.id, status: o.status,
              ...(o.sha256 ? {sha256: o.sha256} : {}),
              ...(retained.find(r => r.id === o.id)?.required ?
                {expectedSha256: retained.find(r => r.id === o.id).expected.sha256} : {})}))},
          sources: input.sourceObservation.map(o => ({...o, expectedSha256: row.acceptance[o.id].sha256})),
          findings, repairLeases});
      }
      // A receipt is an observation, not a lock. Unrelated host journal churn
      // is outside this selection; a later read reobserves the selected bytes.
      for (let i = 0; i < acceptanceIds.length; i++)
        need(hash(await inputFor(s, acceptanceIds[i])) === hash(inputs[i]), "PREPARATION_STATUS_CHANGED");
      need(scope(await state()) === scopeDigest, "PREPARATION_STATUS_CHANGED");
      const sourceDigest = hash(inputs.map(input => ({observation: input.observation,
        sourceObservation: input.sourceObservation, sourceEvidence: input.sourceEvidence ?? null})));
      const body = {schema: "control.preparation-status.v1", receipt: "DOES_NOT_GRANT_EXECUTION",
        mutationAuthorized: false, acceptanceIds: [...acceptanceIds], paused: s.paused,
        scopeDigest, sourceDigest, rows};
      const currentDigest = hash(body);
      need(expectedDigest === undefined || expectedDigest === currentDigest, "PREPARATION_STATUS_STALE");
      return {...body, digest: currentDigest, observedAt: new Date().toISOString()};
    },
    async acceptPreparation(acceptance, {binding, reviewSourceIds} = {}) {
      need(binding !== undefined, "PREPARATION_BINDING_INVALID");
      return this.accept(acceptance, {preparationBinding:binding, reviewSourceIds});
    },
    async accept(acceptance, {reviewSourceIds, terminalArtifact, preparationBinding} = {}) {
      const preparationBindings = preparationBinding === undefined ? null :
        structuredClone(Array.isArray(preparationBinding) ? preparationBinding : [preparationBinding]);
      if(preparationBinding !== undefined) {
        need(preparationBindings.length > 0 && preparationBindings.length <= 16 &&
          new Set(preparationBindings.map(hash)).size === preparationBindings.length &&
          preparationBindings.every(b=>filled(b.taskId) && ["taskSha256","capsuleSha256","sourceDigest","dependencyDigest","commandSha256"]
            .every(key=>digest(b[key])) && ["resume","accept"].includes(b.operation) && filled(b.cwd) && filled(b.executable)),
          "PREPARATION_BINDING_INVALID");
        need(Array.isArray(reviewSourceIds) && reviewSourceIds.length > 0, "PREPARATION_SOURCES_REQUIRED");
      }
      const preparedKey = preparationBindings === null ? null : hash(preparationBindings);
      need(validProductAcceptance(acceptance) && acceptance.owner === config.owner &&
        acceptance.executor === config.executor, "PRODUCT_ACCEPTANCE_IDENTITY_INVALID");
      const record = structuredClone(acceptance), id = record.id;
      need(!["__proto__", "constructor", "prototype"].includes(id), "ACCEPTANCE_ID_INVALID");
      // This is a trusted host capability, never a worker endpoint selection.
      let reviewSourceScope;
      if(reviewSourceIds !== undefined) {
        reviewSourceScope = validateReviewSourceScope({schema:"control.review-source-scope.v1",
          acceptanceSha256:hash(record),sourceIds:structuredClone(reviewSourceIds)}, record);
        need(config.evidenceRegistry !== undefined, "REVIEW_SOURCE_SCOPE_UNBOUND");
        const registry = await openReviewSources(config.evidenceRegistry);
        need(registry.workspace === config.workspace, "CONTROL_EVIDENCE_WORKSPACE_MISMATCH");
        const evidence = await registry.snapshot(reviewSourceScope);
        need(evidence.rows.every(row=>row.status === "AVAILABLE"), "REVIEW_SOURCE_SCOPE_MISSING");
      }
      const sources = await observeAcceptanceSources(config.workspace,record);
      need(sources.every(s => s.status === "MATCH"), "ACCEPTANCE_SOURCE_MISMATCH");
      if (terminalArtifact !== undefined) {
        terminalArtifact = structuredClone(terminalArtifact);
        need((await observeTerminalDisposition(config.workspace, record, terminalArtifact)).status === "MATCH",
          "TERMINAL_RECORD_NOT_OBSERVED");
      }
      const returnSync = createReturnSync({status: "CHECKPOINT_READY", returnReceiptId: `post-accept-${hash(record)}`,
        taskContextArtifact: `Accepted ${record.task}; record ${hash(record)}`,
        memoryCandidates: "Read actual retention before closing control",
        artifactDisposition: "Product accepted; independent control pending",
        recommendedNextAction: "Fresh post-accept review then observed owner disposition"});
      await update(s => {
        if (Object.hasOwn(s.acceptances, id)) {
          if(s.acceptances[id].reviewSourceScope !== undefined)
            validateReviewSourceScope(s.acceptances[id].reviewSourceScope,s.acceptances[id].acceptance);
          need(hash(s.acceptances[id].acceptance) === hash(record) &&
            (s.acceptances[id].preparationKey ?? null) === preparedKey &&
            hash(s.acceptances[id].reviewSourceScope ?? null) === hash(reviewSourceScope ?? null) &&
            (terminalArtifact === undefined || hash(s.acceptances[id].terminalArtifact ?? null) === hash(terminalArtifact)),
            "ACCEPTANCE_ID_CONFLICT"); return;
        }
        s.acceptances[id] = {acceptance: record, relatedControlEvidence:true, ...(reviewSourceScope ? {reviewSourceScope} : {}),
          ...(preparedKey ? {preparationKey:preparedKey, preparationBindings} : {}),
          ...(terminalArtifact ? {terminalArtifact} : {}),
          returnSync, previousFindings: [], findings: [],
          review: null, disposition: null, repairLeases: [], reviewLease: null, enrollment: "REVIEW_DUE"};
      });
      if(config.observationEvents) {
        const {requestScheduledObservation}=await import('./control-schedule.mjs');
        return {eventPersisted:true,wake:await requestScheduledObservation(config.observationEvents,{directory,config})};
      }
    },
    async recordTerminalDisposition(id, terminalArtifact) {
      terminalArtifact = structuredClone(terminalArtifact);
      const s = await state(), row = rowFor(s, id);
      need(!s.paused, "CONTROL_PAUSED");
      need(!row.reviewLease && !row.repairRequest, "REVIEW_PENDING");
      const observation = await observeTerminalDisposition(config.workspace, row.acceptance, terminalArtifact);
      need(observation.status === "MATCH", "TERMINAL_RECORD_NOT_OBSERVED");
      const same = row.terminalArtifact && hash(row.terminalArtifact) === hash(terminalArtifact);
      if (row.terminalArtifact && !same) {
        const prior = await inputFor(s, id);
        // One monotone terminal transition, never an automatic wait renewal or
        // self-certified retry. The existing store retains the prior snapshots.
        need(row.enrollment === "CLOSED" && row.disposition?.action === "WAIT" &&
          row.disposition.terminalEvidence === `host-terminal:${row.disposition.recordSha256}` &&
          reviewedTerminalDisposition(prior, "WAIT", row.disposition.recordSha256) &&
          observation.record.action === "DONE", "TERMINAL_RECORD_CONFLICT");
      }
      await update(current => {
        need(reviewScope(current, id) === reviewScope(s, id), "CONTROL_SOURCE_CHANGED");
        const record = rowFor(current, id);
        if (same) return;
        record.terminalArtifact = terminalArtifact; record.enrollment = "REVIEW_DUE";
      });
    },
    async due() {
      const s = await state();
      if (s.paused) return [];
      const pending = health ? await health.due().catch(() => [{id:healthId,action:"OBSERVATION_UNKNOWN",kind:"HEALTH"}]) : [];
      for (const [id, row] of Object.entries(s.acceptances)) {
        if(!row.review && !row.reviewLease && !["REVIEW_DUE","REVIEW_EPISODE_DUE","REVIEW_RECONCILIATION_REQUIRED"].includes(row.enrollment)) {
          pending.push({id,action:"OBSERVATION_UNKNOWN",reason:"REVIEW_REGISTRATION_MISSING"});continue;
        }
        if (row.reviewLease) {
          pending.push({id, action: ["REVIEW_RECONCILIATION_REQUIRED","REVIEW_EPISODE_DUE"].includes(row.enrollment) ? row.enrollment : "REVIEW_IN_FLIGHT"}); continue;
        }
        try {
          const input = await inputFor(s,id);
          if(row.review && row.review.key !== postAcceptKey(input)) {
            pending.push({id,action:"REVIEW_DUE"});continue;
          }
          if (row.enrollment !== "CLOSED") {pending.push({id, action: row.enrollment}); continue;}
          if (closedReviewDue(input)) pending.push({id, action: "REVIEW_DUE"});
          else if (overdue(row))
            pending.push({id, action: "REPAIR_REVIEW_DUE"});
        } catch {pending.push({id, action: "OBSERVATION_UNKNOWN"});}
      }
      return pending;
    },
    async reviewInput(id) {
      const s = await state();
      const input = await inputFor(s, id, true);
      await assertEpisodeBasis(s,id,input);
      return {input: {...input, review: null, disposition: null}, stateRevision: reviewScope(s, id), key: postAcceptKey(input),
        ...(rowFor(s,id).reviewEpisode?{episode:episodeDescriptor(rowFor(s,id).reviewEpisode)}:{})};
    },
    async claimReview(id, {episode} = {}) {
      if(id === healthId && health)return health.claimReview({episode});
      const runId = randomUUID();
      const s = await state(), row = rowFor(s, id);
      const continuing=row.enrollment==="REVIEW_EPISODE_DUE" && row.reviewEpisode;
      need(!s.paused && (!row.reviewLease || continuing), "REVIEW_ALREADY_CLAIMED_OR_PAUSED");
      if(episode)validateReviewEpisodeSpec(episode);
      const input = await stableInputFor(s,id), fresh=await inputFor(s,id,true), key=postAcceptKey(fresh);
      if(continuing) {
        const reason=row.reviewEpisode.invalidated || row.reviewEpisode.basisSha256!==episodeBasis(key,fresh) ?
          "REVIEW_EPISODE_BASIS_CHANGED" : episode && hash(episode)!==row.reviewEpisode.planSha256 ?
            "REVIEW_EPISODE_PLAN_CHANGED" : Date.now()>=Date.parse(row.reviewEpisode.startedAt)+row.reviewEpisode.spec.maxDurationMs ?
              "REVIEW_EPISODE_EXPIRED" : null;
        if(reason) {
          await update(current=>{need(reviewScope(current,id)===reviewScope(s,id),"REVIEW_SOURCE_CHANGED");
            rowFor(current,id).reviewEpisode.invalidated=reason;
            rowFor(current,id).enrollment="REVIEW_RECONCILIATION_REQUIRED";});
          throw Error(reason);
        }
      }
      const drift = (row.review && row.review.key !== postAcceptKey(input)) ||
        (row.enrollment === "CLOSED" && closedReviewDue(input));
      need(continuing || row.enrollment === "REVIEW_DUE" || drift || (row.enrollment === "CLOSED" && overdue(row)), "REVIEW_NOT_DUE");
      await update(current => {
        need(reviewScope(current, id) === reviewScope(s, id), "REVIEW_SOURCE_CHANGED");
        const record = rowFor(current, id);
        if(episode && !continuing)record.reviewEpisode={id:runId,planSha256:hash(episode),
          basisSha256:episodeBasis(key,fresh),key,startedAt:new Date().toISOString(),previousRunId:null,
          spec:structuredClone(episode),progress:null};
        record.reviewLease = {runId, reviewer: config.reviewer, startedAt: new Date().toISOString()};
        record.enrollment = "REVIEW_IN_FLIGHT";
      });
      return {...await this.reviewInput(id), runId};
    },
    async deferReview(id, offer) {
      if(id === healthId && health)return health.deferReview(offer);
      const s=await state(),row=rowFor(s,id),fresh=await inputFor(s,id,true);
      await assertEpisodeBasis(s,id,fresh);
      need(!s.paused && ["REVIEW_IN_FLIGHT","REVIEW_RECONCILIATION_REQUIRED"].includes(row.enrollment) && row.reviewLease?.runId===offer.runId &&
        row.reviewEpisode && !row.reviewEpisode.invalidated && offer.stateRevision===reviewScope(s,id) &&
        row.reviewEpisode.basisSha256===episodeBasis(postAcceptKey(fresh),fresh) &&
        hash(episodeDescriptor(row.reviewEpisode))===hash(offer.episode),"REVIEW_EPISODE_BASIS_CHANGED");
      need(typeof observeReviewRun==="function","REVIEW_OBSERVER_REQUIRED");
      const observed=await observeReviewRun(offer.runId);
      need(observed?.runId===offer.runId && observed.state==="STOPPED" && filled(observed.evidence) &&
        observed.deferred===true && !observed.reason && !observed.verdict && !observed.invalidated &&
        !observed.usageUnknown && Number.isSafeInteger(observed.spentTokens) && observed.spentTokens>=0 &&
        observed.spentTokens<=row.reviewEpisode.spec.maxUsageTokens &&
        Number.isSafeInteger(observed.completedParts) && observed.completedParts>0 &&
        observed.completedParts<row.reviewEpisode.spec.partitions.length &&
        observed.completedParts===(row.reviewEpisode.progress?.completedParts??0)+1 &&
        observed.parts?.length===observed.completedParts &&
        observed.parts.every((p,i)=>p.index===i && hash(p.ids)===hash(row.reviewEpisode.spec.partitions[i])) &&
        observed.sourceDigest===fresh.sourceEvidence?.digest &&
        hash(observed.episode)===hash(offer.episode),"REVIEW_EPISODE_PROGRESS_INVALID");
      await update(current=>{need(reviewScope(current,id)===reviewScope(s,id),"REVIEW_SOURCE_CHANGED");
        const record=rowFor(current,id);record.reviewEpisode.previousRunId=offer.runId;
        record.reviewEpisode.progress=episodeProgress(observed);
        record.enrollment="REVIEW_EPISODE_DUE";});
      return {action:"REVIEW_EPISODE_DUE"};
    },
    async review(id, offer, verdict) {
      if(id === healthId && health)return health.review(id,offer,verdict);
      need(verdict?.reviewer === config.reviewer, "REVIEW_IDENTITY_INVALID");
      const s = await state(), fresh = await inputFor(s, id, true);
      await assertEpisodeBasis(s,id,fresh);
      need(!s.paused && offer.stateRevision === reviewScope(s, id) && offer.key === postAcceptKey(fresh), "REVIEW_SOURCE_CHANGED");
      need(rowFor(s, id).reviewLease?.runId === verdict.runId && offer.runId === verdict.runId, "REVIEW_LEASE_MISMATCH");
      const row = rowFor(s, id), v = structuredClone(verdict);
      if(row.reviewEpisode)need(!row.reviewEpisode.invalidated &&
        hash(episodeDescriptor(row.reviewEpisode))===hash(offer.episode) &&
        row.reviewEpisode.basisSha256===episodeBasis(offer.key,fresh) &&
        Date.now()<Date.parse(row.reviewEpisode.startedAt)+row.reviewEpisode.spec.maxDurationMs,
        "REVIEW_EPISODE_BASIS_CHANGED");
      need(Date.parse(v.observedAt) >= Date.parse(row.reviewLease.startedAt), "REVIEW_INVALID");
      // Only an explicit submitted finding can acquire a checked failed attempt.
      // Legacy evidence strings and ordinary follow-up reviews remain unbound.
      for(const old of row.findings) {
        const f = v.findings?.find(f=>f.id===old.id);
        need(f && hash(f.retryDecisions??[]) === hash(old.retryDecisions??[]), "REVIEW_INVALID");
        if(row.repairRequest?.findingIds.includes(old.id)) {
          if(f?.status === "OPEN") {f.attempts=old.attempts+1;f.lastResult="FAILED";}
          else need(f?.status === "CLOSED" && f.attempts === old.attempts+1 && f.lastResult === "PASSED", "REVIEW_INVALID");
        } else if(old.status === "CLOSED" || f?.status === "OPEN") {
          need(f.attempts === old.attempts && f.lastResult === old.lastResult, "REVIEW_INVALID");
        }
        if(old.lastResult === "FAILED" && f.attempts > old.attempts)
          need((old.retryDecisions??[]).some(d=>d.fromAttempt===old.attempts &&
            d.toAttempt===f.attempts && d.reviewedBy===config.reviewer), "FAILED_REPAIR_NEEDS_DECISION");
      }
      const result = assessPostAccept({...fresh, review: v, disposition: null});
      need(result.action === "AWAIT_ORCHESTRATOR_DISPOSITION", "REVIEW_INVALID");
      await update(current => {
        need(reviewScope(current, id) === offer.stateRevision, "REVIEW_SOURCE_CHANGED");
        const row = rowFor(current, id);
        if(row.repairRequest) {
          (row.repairHistory??=[]).push({request:row.repairRequest,review:v,
            previousReview:row.review,disposition:row.disposition,repairLeases:row.repairLeases});
          row.repairRequest=null;
        }
        row.previousFindings = structuredClone(row.findings); row.findings = v.findings;
        if(row.reviewEpisode){(row.reviewEpisodeHistory??=[]).push({...row.reviewEpisode,completedRunId:v.runId});
          row.reviewEpisode=null;}
        row.review = v; row.disposition = null; row.reviewLease = null; row.enrollment = "OWNER_DISPOSITION_DUE";
      });
    },
    async reviewFailure(id, runId) {
      if(id === healthId && health)return health.reviewFailure(id,runId);
      const before=await state(),prior=rowFor(before,id);
      const fresh=prior.reviewEpisode?await inputFor(before,id,true):null;
      await update(s => {
        const row = rowFor(s, id); need(row.reviewLease?.runId === runId, "REVIEW_LEASE_MISMATCH");
        if(row.reviewEpisode && fresh && row.reviewEpisode.basisSha256!==episodeBasis(postAcceptKey(fresh),fresh))
          row.reviewEpisode.invalidated="REVIEW_EPISODE_BASIS_CHANGED";
        row.enrollment = "REVIEW_RECONCILIATION_REQUIRED";
      });
    },
    async resumeReview(id, offer) {
      if(id === healthId && health)return health.resumeReview(offer);
      const s=await state(),row=rowFor(s,id);
      need(!s.paused && row.enrollment==="REVIEW_RECONCILIATION_REQUIRED" &&
        row.reviewLease?.runId===offer?.runId && typeof observeReviewRun==="function",
        "REVIEW_CONTINUATION_NOT_AVAILABLE");
      const observed=await observeReviewRun(offer.runId);
      need(observed.runId===offer.runId && observed.state==="STOPPED" && observed.resumable===true && !observed.verdict &&
        observed.offerSha256===hash(offer) && filled(observed.evidence) &&
        Date.now()<Date.parse(observed.deadline),"REVIEW_CONTINUATION_NOT_PROVED");
      const restored=structuredClone(s);rowFor(restored,id).enrollment="REVIEW_IN_FLIGHT";
      const fresh=await inputFor(s,id);
      need(reviewScope(restored,id)===offer.stateRevision && postAcceptKey(fresh)===offer.key,
        "REVIEW_SOURCE_CHANGED");
      await update(current=>{
        need(reviewScope(current,id)===reviewScope(s,id),"REVIEW_SOURCE_CHANGED");
        rowFor(current,id).enrollment="REVIEW_IN_FLIGHT";
      });
      return {action:"REVIEW_IN_FLIGHT",runId:offer.runId,resumed:true};
    },
    async reconcileReview(id, decision) {
      if(id === healthId && health)return health.reconcile(decision);
      let s = await state(), row = rowFor(s, id);
      const lease = row.reviewLease;
      need(!s.paused && lease && typeof observeReviewRun === "function", "REVIEW_OBSERVER_REQUIRED");
      // Only the trusted process transport can establish termination. A timeout,
      // caller verdict or manager explanation is not a stopped-run observation.
      const observed = await observeReviewRun(lease.runId);
      need(observed?.runId === lease.runId && observed.state === "STOPPED" && filled(observed.evidence), "REVIEW_OUTCOME_UNKNOWN");
      need(reviewScope(await state(), id) === reviewScope(s, id), "REVIEW_SOURCE_CHANGED");
      const episodeInput=row.reviewEpisode?await inputFor(s,id,true):null;
      const currentEpisodeBasis=episodeInput?episodeBasis(postAcceptKey(episodeInput),episodeInput):null;
      if(episodeInput && await assertEpisodeBasis(s,id,episodeInput,false)) {
        s=await state();row=rowFor(s,id);
        need(row.reviewLease?.runId===lease.runId,"REVIEW_LEASE_MISMATCH");
      }
      const episodeCurrent=!row.reviewEpisode || (!row.reviewEpisode.invalidated && !observed.invalidated &&
        row.reviewEpisode.basisSha256===currentEpisodeBasis &&
        Date.now()<Date.parse(row.reviewEpisode.startedAt)+row.reviewEpisode.spec.maxDurationMs);
      if(observed.deferred && !observed.reason && episodeCurrent) {
        const offer={...await this.reviewInput(id),runId:lease.runId};
        try {await this.deferReview(id,offer);return {action:"REVIEW_EPISODE_DUE",reused:true};} catch {}
      }
      if (observed.verdict && episodeCurrent) {
        const offer = {...await this.reviewInput(id), runId: lease.runId};
        const verdict = observed.verdict;
        const reusable = verdict.reviewer === config.reviewer && verdict.runId === lease.runId &&
          verdict.key === offer.key && assessPostAccept({...offer.input, review: verdict}).action === "AWAIT_ORCHESTRATOR_DISPOSITION";
        if (reusable) {
          await this.review(id, offer, verdict);
          return {action: "OWNER_DISPOSITION_DUE", reused: true};
        }
      }
      need(decision?.reviewer === config.reviewer && decision.action === "RETRY" && filled(decision.evidence),
        "INDEPENDENT_RETRY_DECISION_REQUIRED");
      await update(current => {
        need(reviewScope(current, id) === reviewScope(s, id), "REVIEW_SOURCE_CHANGED");
        const record = rowFor(current, id);
        record.reviewAttempts ??= [];
        record.reviewAttempts.push({lease, observation: structuredClone(observed), decision: structuredClone(decision)});
        if(record.reviewEpisode) {
          const e=record.reviewEpisode;
          if(e.invalidated || observed.invalidated || !observed.episode ||
            e.basisSha256!==currentEpisodeBasis || Date.now()>=Date.parse(e.startedAt)+e.spec.maxDurationMs) {
            (record.reviewEpisodeHistory??=[]).push({...e,invalidated:e.invalidated??"REVIEW_EPISODE_INVALIDATED"});
            record.reviewEpisode=null;
          } else {
            need(hash(observed.episode)===hash(episodeDescriptor(e)) &&
              Number.isSafeInteger(observed.completedParts) && observed.completedParts>=0 &&
              observed.completedParts<=e.spec.partitions.length && observed.parts?.length===observed.completedParts &&
              observed.parts.every((p,i)=>p.index===i && hash(p.ids)===hash(e.spec.partitions[i])),
              "REVIEW_EPISODE_PROGRESS_INVALID");
            e.progress=episodeProgress(observed);
            e.previousRunId=lease.runId;record.enrollment="REVIEW_EPISODE_DUE";return;
          }
        }
        record.reviewLease = null; record.enrollment = "REVIEW_DUE";
      });
      return {action: rowFor(await state(),id).enrollment, reused: false};
    },
    async requestRepairReview(id, evidence, findingIds) {
      need(filled(evidence), "REPAIR_EVIDENCE_REQUIRED");
      need(Array.isArray(findingIds) && findingIds.every(filled) &&
        new Set(findingIds).size === findingIds.length, "REPAIR_FINDING_IDS_REQUIRED");
      findingIds=[...findingIds];
      await update(s => {
        const row = rowFor(s, id);
        need(!s.paused && !row.reviewLease && row.review && row.disposition?.action === "REPAIR", "REPAIR_NOT_OWNED");
        // A legacy verdict can lack a result-use decision without having an OPEN
        // finding. Reuse the bounded review request; do not invent product repairs.
        need(findingIds.length || row.review.resultUse === undefined, "REPAIR_FINDING_IDS_REQUIRED");
        need(!row.repairRequest, "REPAIR_ALREADY_PENDING");
        for(const findingId of findingIds) {
          const f=row.findings.find(f=>f.id===findingId);
          need(f?.status === "OPEN" && !checkFindingLeases([f],row.repairLeases) &&
            row.repairLeases.find(l=>l.owner===f.owner && l.work===f.work).state !== "WAITING", "REPAIR_NOT_OWNED");
          need(f.lastResult !== "FAILED" || (f.retryDecisions??[]).some(d=>d.fromAttempt===f.attempts &&
            d.toAttempt===f.attempts+1 && d.reviewedBy===config.reviewer), "FAILED_REPAIR_NEEDS_DECISION");
        }
        row.relatedControlEvidence=true;
        row.repairRequest={owner:config.owner,evidence,findingIds,reviewKey:hash(row.review)};
        row.repairEvidence = evidence; row.enrollment = "REVIEW_DUE";
      });
    },
    async authorizeRepairRetry(id, {reviewer,findingId,fromAttempt,reviewKey,evidence,decision}) {
      need(reviewer === config.reviewer && filled(evidence) && filled(decision), "REPAIR_RETRY_DECISION_REQUIRED");
      await update(s=>{
        const row=rowFor(s,id), f=row.findings.find(f=>f.id===findingId);
        need(!s.paused && !reviewPending(row) && !row.repairRequest && row.disposition?.action === "REPAIR" &&
          reviewKey===hash(row.review) && f?.status==="OPEN" && f.owner!==reviewer &&
          fromAttempt===f.attempts && f.lastResult==="FAILED" && !checkFindingLeases([f],row.repairLeases) &&
          row.repairLeases.find(l=>l.owner===f.owner && l.work===f.work).state!=="WAITING" &&
          !(f.retryDecisions??[]).some(d=>d.fromAttempt===f.attempts), "REPAIR_RETRY_INVALID");
        (f.retryDecisions??=[]).push({fromAttempt:f.attempts,toAttempt:f.attempts+1,previousResult:"FAILED",
          reviewedBy:reviewer,reviewKey,evidence,decision});
      });
    },
    async recordSourceScopeExpansion(id, {owner, currentScopeSha256, sourceIds, evidence}) {
      const s = await state(), row = rowFor(s,id), before = sourceScopeFor(row);
      need(owner === config.owner && filled(evidence), "SOURCE_SCOPE_OWNER_INVALID");
      const attempt = row.reviewAttempts?.at(-1);
      // Preparation may discover evidence before any review exists. It must not
      // manufacture a failed review merely to append that evidence to the scope.
      const initial = !row.review && !row.disposition && !row.reviewEpisode && !row.repairRequest &&
        !row.reviewAttempts?.length && !row.reviewEpisodeHistory?.length && !row.repairHistory?.length &&
        !row.findings.length && !row.previousFindings.length;
      const reconciled = attempt?.observation.state === "STOPPED" &&
        attempt.observation.runId === attempt.lease.runId && attempt.decision.action === "RETRY" &&
        attempt.decision.reviewer === config.reviewer &&
        (!row.review || Date.parse(row.review.observedAt) <= Date.parse(attempt.lease.startedAt));
      need(!s.paused && !row.reviewLease && row.enrollment === "REVIEW_DUE" &&
        (initial || reconciled) &&
        s.reservations && !Object.values(s.reservations).some(r=>r.status === "IN_FLIGHT" && r.dependencies.includes(id)),
        "SOURCE_SCOPE_STOPPED_RECONCILIATION_REQUIRED");
      need(before && digest(currentScopeSha256) && currentScopeSha256 === hash(before), "SOURCE_SCOPE_CAS_MISMATCH");
      const scope = validateReviewSourceScope({schema:"control.review-source-scope.v1",
        acceptanceSha256:hash(row.acceptance),sourceIds:structuredClone(sourceIds)},row.acceptance);
      need(scope.sourceIds.length > before.sourceIds.length && before.sourceIds.every(id=>scope.sourceIds.includes(id)),
        "SOURCE_SCOPE_ADDITIVE_REQUIRED");
      need(config.evidenceRegistry !== undefined, "REVIEW_SOURCE_SCOPE_UNBOUND");
      const sources = await openReviewSources(config.evidenceRegistry);
      need(sources.workspace === config.workspace, "CONTROL_EVIDENCE_WORKSPACE_MISMATCH");
      need((await sources.snapshot(scope)).rows.every(r=>r.status === "AVAILABLE"), "REVIEW_SOURCE_SCOPE_MISSING");
      await update(current => {
        need(reviewScope(current,id) === reviewScope(s,id), "REVIEW_SOURCE_CHANGED");
        const record = rowFor(current,id);
        need(hash(sourceScopeFor(record)) === currentScopeSha256, "SOURCE_SCOPE_CAS_MISMATCH");
        record.reviewSourceScopeRevisions ??= [];
        record.reviewSourceScopeRevisions.push({owner,evidence,currentScopeSha256,scope,
          previous:hash(record.reviewSourceScopeRevisions.at(-1) ?? record.reviewSourceScope),
          ...(initial ? {phase:"BEFORE_FIRST_REVIEW"} : {stoppedRunId:attempt.lease.runId}),
          recordedAt:new Date().toISOString()});
      });
    },
    async recordRetentionRepair(id, {owner, reviewKey, retention, evidence}) {
      const s = await state(), row = rowFor(s, id);
      need(owner === config.owner && filled(evidence), "RETENTION_REPAIR_IDENTITY_INVALID");
      need(!s.paused && !reviewPending(row) && row.review && row.disposition?.action === "REPAIR" &&
        reviewKey === hash(row.review), "REPAIR_NOT_OWNED");
      need(validProductAcceptance({...row.acceptance, retention}), "RETENTION_REPAIR_INVALID");
      const before = row.retentionRevisions?.at(-1)?.retention ?? row.acceptance.retention;
      // This is a version of the same writes, not permission to drop obligations,
      // relocate custody or rewrite the accepted product and its original proof.
      need(retention.every(item => {
        const old = before.find(r => r.id === item.id);
        return item.required === old.required && (item.required ? item.expected.path === old.expected.path : item.reason === old.reason);
      }) && hash(retention) !== hash(before), "RETENTION_CONTRACT_CHANGE_NOT_AUTHORIZED");
      const observed = await observeRetention(config.workspace, {...row.acceptance, retention});
      need(observed.every(r => ["MATCH", "NOT_REQUIRED"].includes(r.status)), "RETENTION_REPAIR_NOT_OBSERVED");
      await update(current => {
        need(reviewScope(current, id) === reviewScope(s, id), "REVIEW_SOURCE_CHANGED");
        const record = rowFor(current, id);
        record.retentionRevisions ??= [];
        record.retentionRevisions.push({owner, reviewKey, evidence, retention: structuredClone(retention),
          previous: hash(record.retentionRevisions.at(-1) ?? record.acceptance), recordedAt: new Date().toISOString()});
        record.enrollment = "REVIEW_DUE";
      });
    },
    async disposition(id, disposition, repairLeases = []) {
      disposition = structuredClone(disposition); repairLeases = structuredClone(repairLeases);
      need(disposition?.owner === config.owner, "OWNER_IDENTITY_INVALID");
      need(!Object.hasOwn(disposition, "continuationEvidence") && !Object.hasOwn(disposition, "terminalEvidence"), "HOST_OBSERVATION_REQUIRED");
      const terminal = terminalActions.includes(disposition.action);
      need(filled(disposition.evidence) && ["CONTINUE", "REPAIR", ...terminalActions].includes(disposition.action) &&
        (!terminal || exactKeys(disposition, ["owner", "reviewKey", "action", "evidence", "recordSha256"]) && digest(disposition.recordSha256)) &&
        (disposition.action !== "CONTINUE" || filled(disposition.nextAction)), "OWNER_DISPOSITION_INVALID");
      const observed = await state();
      need(!observed.paused, "CONTROL_PAUSED");
      // REPAIR can own actual source drift; every non-repair outcome needs fresh sources.
      const fresh = disposition.action !== "REPAIR" ? await inputFor(observed, id) : null;
      await update(s => {
        need(!s.paused, "CONTROL_PAUSED");
        const row = rowFor(s, id);
        need(!reviewPending(row), "REVIEW_PENDING");
        need(row.review && disposition.reviewKey === hash(row.review), "VERDICT_NOT_CONSUMED");
        need(!checkFindingLeases(row.findings, repairLeases), "POST_ACCEPT_REPAIR_OWNER_REQUIRED");
        if (["CONTINUE", "DONE"].includes(disposition.action)) {
          const use = reviewedResultUse(row.review, row.acceptance);
          need(use === "ALLOW", use === "REJECT" ? "RESULT_USE_REJECTED" : "RESULT_USE_UNPROVEN");
        }
        need(disposition.action === "REPAIR" || !row.findings.some(f => f.status === "OPEN" && f.blocksResume),
          "POST_ACCEPT_REPAIR_REQUIRED");
        if (fresh) need(reviewScope(s, id) === reviewScope(observed, id) && row.review.key === postAcceptKey(fresh),
          "POST_ACCEPT_SOURCE_CHANGED");
        if (terminal) {
          need(reviewedTerminalDisposition(fresh, disposition.action, disposition.recordSha256), "TERMINAL_VERDICT_REQUIRED");
          need(!fresh.externalUnknown && fresh.execution.coverage === "ACCEPTED_TASK_HOST_REGISTRY_ONLY" &&
            !fresh.execution.reservations.some(r => r.status === "IN_FLIGHT"), "TERMINAL_OUTCOME_UNKNOWN");
          need(fresh.sourceObservation.every(r => r.status === "MATCH") &&
            fresh.observation.every(r => ["MATCH", "NOT_REQUIRED"].includes(r.status)), "TERMINAL_SOURCE_NOT_OBSERVED");
          need(disposition.action !== "WAIT" || Date.parse(fresh.terminalObservation.record.reviewAt) > Date.now(), "TERMINAL_WAIT_OVERDUE");
          disposition.terminalEvidence = `host-terminal:${disposition.recordSha256}`;
        }
        row.disposition = structuredClone(disposition); row.repairLeases = structuredClone(repairLeases);
        row.enrollment = terminal ? "FINAL_READBACK_DUE" : "CONTINUATION_OR_REPAIR_DUE";
      });
      if (terminal) await this.close(id);
    },
    async assess(id, {expectedRecordSha256} = {}) {
      const s = await state();
      need(expectedRecordSha256 === undefined || digest(expectedRecordSha256) &&
        hash(rowFor(s, id)) === expectedRecordSha256, "CONTROL_SOURCE_CHANGED");
      return assessPostAccept(await stableInputFor(s, id));
    },
    async approveCommand(binding, {reviewer, reviewReceipt, dependencies, expiresAt, executionRequest}) {
      // Dormant exact continuations can wait for PRE + owner delivery. They
      // remain unusable until authorize/reserve recheck the current verdict.
      const conditional = config.requirePreparation && executionRequest !== undefined;
      need(reviewer === config.reviewer && filled(reviewReceipt) && filled(binding.taskId) &&
        Array.isArray(dependencies) && dependencies.every(filled) && new Set(dependencies).size === dependencies.length &&
        Number.isFinite(expiresAt) && expiresAt > Date.now() && expiresAt <= Date.now() + (conditional ? 3600000 : 300000), "COMMAND_REVIEW_INVALID");
      if(executionRequest!==undefined)need(executionRequest?.schema==="context.request.v1"&&
        executionRequest.operation==="resume"&&binding.operation==="resume"&&executionRequest.workspace===config.workspace&&
        executionRequest.task?.sha256===binding.taskSha256&&executionRequest.capsule?.sha256===binding.capsuleSha256&&
        Buffer.byteLength(canonicalJson(executionRequest))<=256*1024,"CONTINUATION_REQUEST_INVALID");
      const key = hash(binding);
      const before = await state();
      assertPreparation(before, binding, dependencies);
      if(config.requirePreparation && !conditional)await readiness(before, dependencies, binding.taskId);
      await update(s => {
        if(config.requirePreparation)need(hash(s) === hash(before), "CONTROL_SOURCE_CHANGED");
        need(!s.reservations[key], "COMMAND_ALREADY_RESERVED");
        dependencies.forEach(id => rowFor(s, id));
        s.grants[key] = {id: key, bindingSha256: key, binding: structuredClone(binding),
          reviewReceipt, dependencies: [...dependencies], expiresAt,
          ...(executionRequest!==undefined?{executionRequest:structuredClone(executionRequest)}:{})};
      });
    },
    async pause(paused) {
      need(typeof paused === "boolean", "PAUSE_INVALID");
      await update(s => {
        s.paused = paused;
        if(paused)for(const row of Object.values(s.acceptances))if(row.reviewEpisode) {
          row.reviewEpisode.invalidated="REVIEW_EPISODE_PAUSED";
          row.enrollment="REVIEW_RECONCILIATION_REQUIRED";
        }
        if(paused && s.health?.reviewEpisode) {
          s.health.reviewEpisode.invalidated="REVIEW_EPISODE_PAUSED";
          s.health.enrollment="REVIEW_RECONCILIATION_REQUIRED";
        }
      });
    },
    // Trusted SDK only. Neither worker requests nor owner verdicts supply these observations.
    async reconcileCommand(request) {
      request = structuredClone(request);
      need(exactKeys(request, ["reservationId", "expectedJournalDigest", "owner", "evidence"]) &&
        request.owner === config.owner && filled(request.evidence) && digest(request.reservationId) &&
        digest(request.expectedJournalDigest), "COMMAND_RECONCILIATION_INVALID");
      need(typeof observeCommandFailure === "function", "COMMAND_OBSERVER_REQUIRED");
      const before = await retainedState();
      need(before.digest === request.expectedJournalDigest, "COMMAND_RECONCILIATION_STALE");
      const reservation = before.state.reservations[request.reservationId];
      need(reservation?.status === "IN_FLIGHT" && validCommandFailure(reservation.failure),
        "COMMAND_RECONCILIATION_CONFLICT");
      const grant = before.state.grants[reservation.grantId];
      need(grant && grant.bindingSha256 === reservation.bindingSha256 && hash(grant.binding) === reservation.bindingSha256,
        "RESERVATION_NOT_FOUND");
      const failureSha256 = hash(reservation.failure), processSha256 = hash(reservation.failure.process);
      const scopeSha256 = hash({workspace: config.workspace, binding: grant.binding});
      const observation = structuredClone(await observeCommandFailure({journalDigest: before.digest,
        reservation: structuredClone(reservation), binding: structuredClone(grant.binding), failureSha256, scopeSha256}));
      const bound = proof => proof?.reservationId === request.reservationId &&
        proof.bindingSha256 === reservation.bindingSha256 && proof.failureSha256 === failureSha256 && filled(proof.evidence);
      need(exactKeys(observation, ["termination", "effects"]) &&
        exactKeys(observation.termination, ["state", "reservationId", "bindingSha256", "failureSha256", "processSha256", "evidence"]) &&
        bound(observation.termination) && observation.termination.state === "STOPPED" &&
        observation.termination.processSha256 === processSha256, "COMMAND_TERMINATION_UNPROVEN");
      need(exactKeys(observation.effects, ["state", "reservationId", "bindingSha256", "failureSha256", "scopeSha256", "evidence"]) &&
        bound(observation.effects) && observation.effects.state === "RECONCILED" && observation.effects.scopeSha256 === scopeSha256 &&
        observation.effects.evidence !== observation.termination.evidence, "COMMAND_EFFECTS_UNRECONCILED");
      need(Buffer.byteLength(canonicalJson(observation)) <= 16384, "COMMAND_OBSERVATION_CAPACITY");
      const saved = await store.transact((current, journalDigest) => {
        need(current.schema === schema && current.configKey === configKey, "CONTROL_CONFIG_MISMATCH");
        need(journalDigest === before.digest, "COMMAND_RECONCILIATION_STALE");
        const row = current.reservations[request.reservationId];
        need(row?.status === "IN_FLIGHT" && hash(row) === hash(reservation), "COMMAND_RECONCILIATION_CONFLICT");
        row.status = "FAILED_RECONCILED";
        row.reconciliation = {owner: request.owner, evidence: request.evidence, previousJournalDigest: before.digest,
          failureSha256, observation, recordedAt: new Date().toISOString()};
        return current;
      });
      return {status: "FAILED_RECONCILED", reservationId: request.reservationId, journalDigest: saved.digest};
    },
    control: {
      authorize,
      async reserve(grant) {
        // Reobserve required bytes and compare the same durable state before CAS.
        const s = await state(), stored = s.grants[grant.bindingSha256];
        need(stored && hash(s) === grant.stateRevision && stored.id === grant.id &&
          stored.expiresAt > Date.now() && !s.reservations[grant.id], "STALE_OR_USED_ADMISSION");
        assertPreparation(s, stored.binding, stored.dependencies);
        await readiness(s, stored.dependencies, stored.binding.taskId);
        const claim = {status: "RESERVED", grantId: grant.id, bindingSha256: grant.bindingSha256,
          stateRevision: grant.stateRevision, reservationId: grant.id};
        await update(current => {
          need(hash(current) === grant.stateRevision && !current.reservations[grant.id], "STALE_OR_USED_ADMISSION");
          current.reservations[grant.id] = {...claim, status: "IN_FLIGHT", dependencies: stored.dependencies,
            nextTask: stored.binding.taskId, dispositions: Object.fromEntries(stored.dependencies.map(id =>
              [id, hash(rowFor(current, id).disposition)]))};
        });
        return claim;
      },
      async captureFailure(claim, observed) {
        claim = structuredClone(claim); observed = structuredClone(observed);
        need(exactKeys(observed, ["bindingSha256", "failure"]) && validCommandFailure(observed.failure),
          "COMMAND_FAILURE_INVALID");
        await update(s => {
          const row = s.reservations[claim.reservationId], grant = row && s.grants[row.grantId];
          need(row && grant && row.grantId === claim.grantId && row.stateRevision === claim.stateRevision &&
            row.bindingSha256 === claim.bindingSha256 && row.bindingSha256 === observed.bindingSha256 &&
            observed.failure.commandSha256 === grant.binding.commandSha256 && observed.failure.cwd === grant.binding.cwd &&
            observed.failure.executable === grant.binding.executable, "RESERVATION_NOT_FOUND");
          need(row.status === "IN_FLIGHT" && (!row.failure || hash(row.failure) === hash(observed.failure)),
            "COMMAND_FAILURE_CONFLICT");
          row.failure = structuredClone(observed.failure);
        });
        return {reservationId: claim.reservationId, evidence: `host-failure:${hash(observed.failure)}`};
      },
      async observe(claim, observed) {
        need(observed?.outcome === "COMPLETED" && digest(observed.resultSha256), "ACTION_OBSERVATION_INVALID");
        need(!Object.hasOwn(observed,"effects"),"ACTION_EFFECTS_NOT_CALLER_SUPPLIED");
        need(!Object.hasOwn(observed,"commandEnvironment"),"ACTION_ENVIRONMENT_NOT_CALLER_SUPPLIED");
        const effects=readCommandEffects(observed);
        const commandEnvironment=readCommandEnvironment(observed);
        await update(s => {
          const row = s.reservations[claim.reservationId];
          need(row && row.bindingSha256 === observed.bindingSha256 && row.grantId === claim.grantId, "RESERVATION_NOT_FOUND");
          if (row.status === "COMPLETED") {need(row.resultSha256 === observed.resultSha256, "OBSERVATION_CONFLICT"); return;}
          need(row.status === "IN_FLIGHT" && !row.failure, "FAILED_COMMAND_NOT_COMPLETED");
          const grant=s.grants[row.grantId];
          if(commandEnvironment) {
            const {environment:e,process:p}=commandEnvironment;
            need(e.commandSha256===grant.binding.commandSha256 && e.cwd===grant.binding.cwd &&
              e.executable===grant.binding.executable && e.workspace===config.workspace &&
              e.contextBindings==="RECHECKED_BEFORE_EXECUTION" &&
              Date.parse(e.checkedAt)<=Date.parse(p.startedAt),"ACTION_ENVIRONMENT_UNBOUND");
          }
          if(grant.binding.confined)need(effects && effects.grantSha256===hash(grant) &&
            effects.bindingSha256===row.bindingSha256 && effects.resultSha256===observed.resultSha256,"ACTION_EFFECTS_REQUIRED");
          row.status = "COMPLETED"; row.resultSha256 = observed.resultSha256;
          if(commandEnvironment)row.commandEnvironment=commandEnvironment;
          if(effects)row.effects=effects;
          for (const id of row.dependencies) {
            const acceptance = rowFor(s, id);
            if (reviewPending(acceptance) || hash(acceptance.disposition) !== row.dispositions[id]) {
              row.continuationStatus = "STALE_DISPOSITION"; continue;
            }
            acceptance.disposition.continuationEvidence = `host-observation:${claim.reservationId}:${observed.resultSha256}`;
            acceptance.enrollment = "FINAL_READBACK_DUE";
          }
          if(effects)row.completionSha256=hash(row);
        });
        return {reservationId: claim.reservationId, bindingSha256: observed.bindingSha256,
          evidence: `host-observation:${claim.reservationId}:${observed.resultSha256}`};
      }
    },
    async close(id) {
      const s = await state(), row = rowFor(s, id);
      need(!reviewPending(row), "REVIEW_PENDING");
      const input = await stableInputFor(s, id), assessed = assessPostAccept(input);
      need(confirmedControlActions.includes(assessed.action), "CONTROL_NOT_COMPLETE");
      const closure = {temporalScope: "HISTORICAL_CLOSURE_AT_READBACK_NOT_CURRENT_CONTROL",
        reviewKey: hash(row.review), sourceKey: postAcceptKey(input), observedAt: new Date().toISOString()};
      await update(current => {
        need(hash(current) === hash(s), "CONTROL_SOURCE_CHANGED");
        const record = rowFor(current, id);
        if (record.enrollment === "CLOSED" && record.closure?.reviewKey === closure.reviewKey &&
            record.closure.sourceKey === closure.sourceKey) return;
        record.enrollment = "CLOSED"; record.closure = closure;
      });
    }
  };
}
