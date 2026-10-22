import test from "node:test";
import assert from "node:assert/strict";
import {reviewPartitions, validateReviewPart, mergeReviewParts} from "../scripts/control-review-partitions.mjs";
import {controlCatalog, controlCheckIds, checkControlCoverage} from "../scripts/control-catalog.mjs";
import {decodeReviewAnswer} from "../scripts/control-review-wire.mjs";
import {validateControlFindings} from "../scripts/control-findings.mjs";
import {sha256,canonicalJson} from "../scripts/memory-brief.mjs";

const options = () => ({readbacks: [{id: "contract", status: "AVAILABLE", sha256: "a".repeat(64)},
  {id: "memory", status: "MISSING"}], offer: {key: "b".repeat(64), input: {previousFindings: []}},
  reviewer: "independent-reviewer", observedAt: "2026-10-07T10:00:00Z"});
const answer = ids => ({schema: "control.review-answer.v2", rowGroups: [
  {ids: [...ids], status: "PASS", sourceIds: ["contract"]}], newFindings: [], resolutions: []});
const newFinding = (checkId, id = "retained-problem") => ({id, checkId, sourceIds: ["contract"],
  evidence: "Observed missing bounded evidence", owner: "repair-owner", work: "repair-work",
  reviewAt: "2026-10-08T10:00:00Z", blocksResume: true});

test("result-use survives decode and partition merge, cannot be invented by an unassigned or HEALTH part", () => {
  const opts=options(),ref={path:"fixture.md",sha256:"a".repeat(64)};
  opts.offer.input.acceptance={schema:"work.product-acceptance.v1",id:"a",project:"p",task:"t",
    owner:"owner",executor:"executor",status:"ACCEPTED",acceptedAt:"2026-10-07T09:00:00Z",
    producerReturn:ref,artifact:ref,technicalProof:ref,goal:ref,
    retention:["memory","map","tracker","custody"].map(id=>({id,required:true,expected:ref}))};
  const parts=reviewPartitions(2),raw=parts.map(answer),index=parts.findIndex(ids=>ids.includes("C20.02"));
  raw[index].resultUse={status:"ALLOW",sourceIds:["contract"],evidence:"Result contract proven",findingIds:[]};
  const decoded=validateReviewPart(raw[index],parts[index],opts);
  assert.equal(decoded.resultUse.acceptanceSha256,sha256(canonicalJson(opts.offer.input.acceptance)));
  const merged=mergeReviewParts(raw,parts);
  assert.deepEqual(decodeReviewAnswer(merged,opts).resultUse,decoded.resultUse);
  assert.throws(()=>decodeReviewAnswer(merged,{...opts,offer:{...opts.offer,phase:"HEALTH"}}),/RESULT_USE_INVALID/);
  const bad=structuredClone(raw[index]);bad.resultUse.sourceIds=["not-read"];
  assert.throws(()=>validateReviewPart(bad,parts[index],opts),/UNREAD_EVIDENCE/);
  raw[1-index].resultUse=raw[index].resultUse;
  assert.throws(()=>mergeReviewParts(raw,parts),/RESULT_USE_UNASSIGNED/);
  const conflict=answer(controlCheckIds),f=newFinding("C19.01");f.blocksResume=false;
  conflict.newFindings=[f];conflict.resultUse=raw[index].resultUse;
  conflict.rowGroups=[{ids:controlCheckIds.filter(id=>id!==f.checkId),status:"PASS",sourceIds:["contract"]},
    {ids:[f.checkId],status:"FINDING",sourceIds:["contract"],reason:f.evidence,findingId:f.id}];
  assert.throws(()=>validateReviewPart(conflict,controlCheckIds,opts),/RESULT_USE_INVALID/);
  conflict.resultUse={...conflict.resultUse,status:"REJECT",findingIds:[f.id]};
  assert.equal(validateReviewPart(conflict,controlCheckIds,opts).resultUse.status,"REJECT");
});
function ownedAnswer(ids, status = "UNKNOWN", id = "retained-problem") {
  const a = answer(ids), checkId = ids[0];
  a.rowGroups = [{ids: [checkId], status, sourceIds: ["memory"], reason: "Relevant evidence is missing", findingId: id},
    {ids: ids.slice(1), status: "PASS", sourceIds: ["contract"]}];
  a.newFindings = [newFinding(checkId, id)];
  return a;
}
function previous(checkId, id = "retained-problem") {
  const a = answer(controlCheckIds);
  a.newFindings = [newFinding(checkId, id)];
  return decodeReviewAnswer(a, options()).findings[0];
}
function freeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

test("partitions cover exactly 87 ordered criteria with whole deterministic balanced groups", () => {
  assert.equal(controlCheckIds.length, 87);
  assert.deepEqual(reviewPartitions(), [[...controlCheckIds]]);
  const sizes = [[87], [44, 43], [29, 30, 28], [22, 22, 22, 21]];
  const anchors = [
    ["C01", "C05", "C09", "C13", "C16", "C20", "C24"],
    ["C02", "C06", "C12", "C17", "C21", "C25", "C28"],
    ["C03", "C07", "C10", "C14", "C18", "C22", "C26"],
    ["C04", "C08", "C11", "C15", "C19", "C23", "C27"]];
  for (let count = 1; count <= 4; count++) {
    const parts = reviewPartitions(count), all = parts.flat();
    assert.deepEqual(parts, reviewPartitions(count));
    assert.deepEqual(parts.map(ids => ids.length), sizes[count - 1]);
    assert.equal(all.length, 87);
    assert.equal(new Set(all).size, 87);
    assert.deepEqual([...all].sort(), [...controlCheckIds]);
    for (const ids of parts) {
      assert.deepEqual(ids, controlCheckIds.filter(id => ids.includes(id)));
      assert.ok(Object.isFrozen(ids));
    }
    for (const group of controlCatalog) {
      const indices = group.checks.map(c => parts.findIndex(ids => ids.includes(c.id)));
      assert.ok(indices.every(i => i === indices[0]));
    }
    assert.ok(Object.isFrozen(parts));
  }
  assert.deepEqual(reviewPartitions(4).map(ids => ids.filter(id => id.endsWith(".01")).map(id => id.split(".")[0])), anchors);
});

test("partition count is bounded and rejects coercion, fractional and nonfinite values", () => {
  for (const count of [0, -1, 5, 1.5, NaN, Infinity, "2", null, true, {}, []])
    assert.throws(() => reviewPartitions(count), /PART_COUNT_INVALID/);
});

test("every partition validates independently and merges into complete globally valid original v2", () => {
  for (let count = 1; count <= 4; count++) {
    const parts = reviewPartitions(count), raw = parts.map(ids => answer(ids)), opts = options();
    for (let i = 0; i < count; i++) {
      const decoded = validateReviewPart(raw[i], parts[i], opts);
      assert.deepEqual(decoded.rows.map(row => row.id), parts[i]);
      assert.deepEqual(decoded.findings, []);
    }
    const merged = mergeReviewParts(raw, parts);
    assert.deepEqual(merged, {schema: "control.review-answer.v2", rowGroups: raw.flatMap(a => a.rowGroups), newFindings: [], resolutions: []});
    const decoded = decodeReviewAnswer(merged, opts);
    assert.equal(checkControlCoverage(decoded.rows).ok, true);
    assert.equal(validateControlFindings({review: {...decoded, reviewer: opts.reviewer}, previousFindings: [], key: opts.offer.key}), null);
  }
});

test("legacy answers are allowed only for complete single-part validation, never partial merge", () => {
  const opts = options(), decoded = decodeReviewAnswer(answer(controlCheckIds), opts);
  assert.deepEqual(validateReviewPart(decoded, controlCheckIds, opts), decoded);
  const compact = {rowGroups: [{ids: [...controlCheckIds], status: "PASS", evidenceRef: "S"}],
    evidence: {S: "source:contract:" + "a".repeat(64)}, findings: []};
  assert.equal(validateReviewPart(compact, controlCheckIds, opts).rows.length, 87);
  const ids = reviewPartitions(2)[0];
  assert.throws(() => validateReviewPart({rows: decoded.rows.filter(r => ids.includes(r.id)), findings: []}, ids, opts), /V2_REQUIRED/);
  assert.throws(() => mergeReviewParts([decoded], reviewPartitions()), /V2_REQUIRED/);
});

test("missing, duplicate, invented and wrong-part rows are rejected before decode and merge", () => {
  const parts = reviewPartitions(2), ids = parts[0];
  for (const mutate of [
    a => a.rowGroups[0].ids.pop(),
    a => a.rowGroups[0].ids.push(ids[0]),
    a => a.rowGroups[0].ids.splice(0, 1, parts[1][0]),
    a => a.rowGroups[0].ids.splice(0, 1, "C99.01"),
    a => a.rowGroups.push({...a.rowGroups[0], ids: [ids[0]]}),
    a => a.rowGroups = [],
    a => a.rowGroups[0].ids = [],
    a => a.rows = []
  ]) {
    const a = answer(ids); mutate(a);
    assert.throws(() => validateReviewPart(a, ids, options()));
    assert.throws(() => mergeReviewParts([a, answer(parts[1])], parts));
  }
  for (const badIds of [[], [ids[0], ids[0]], ["C99.01"], null, "C01.01"])
    assert.throws(() => validateReviewPart(answer(ids), badIds, options()), /PART_IDS_INVALID/);
});

test("assigned statuses need read evidence, reasons, and same-criterion owned open findings", () => {
  const ids = reviewPartitions(4)[0];
  for (const status of ["FINDING", "UNKNOWN", "DEFERRED"]) {
    const decoded = validateReviewPart(ownedAnswer(ids, status), ids, options());
    assert.equal(decoded.rows[0].status, status);
    assert.match(decoded.rows[0].evidence, /^source:memory:MISSING/);
    const linked=ownedAnswer(ids,status);delete linked.rowGroups[0].reason;
    linked.newFindings[0].sourceIds=[...linked.rowGroups[0].sourceIds];
    assert.equal(validateReviewPart(linked,ids,options()).rows[0].reason,linked.newFindings[0].evidence);
    linked.newFindings[0].sourceIds=["contract"];
    assert.throws(()=>validateReviewPart(linked,ids,options()),/MISSING_REASON/);
  }
  const excluded = answer(ids);
  Object.assign(excluded.rowGroups[0], {status: "NOT_APPLICABLE", reason: "Outside the evidenced scope"});
  assert.equal(validateReviewPart(excluded, ids, options()).rows[0].status, "NOT_APPLICABLE");
  delete excluded.rowGroups[0].reason;
  assert.throws(()=>validateReviewPart(excluded,ids,options()),/MISSING_REASON/);
  for (const mutate of [
    a => a.rowGroups[0].status = "FAIL",
    a => delete a.rowGroups[0].status,
    a => a.rowGroups[0].sourceIds = [],
    a => a.rowGroups[0].sourceIds = ["unread"],
    a => a.rowGroups[0].sourceIds = ["contract", "contract"],
    a => a.rowGroups[0].evidence = "forged",
    a => {delete a.rowGroups[0].reason;delete a.newFindings[0].evidence;},
    a => delete a.rowGroups[0].findingId,
    a => a.rowGroups[0].findingId = "another-problem",
    a => a.newFindings = [],
    a => a.newFindings[0].checkId = ids[1],
    a => a.rowGroups[0].status = "PASS",
    a => a.rowGroups[0].status = "NOT_APPLICABLE"
  ]) {
    const a = ownedAnswer(ids); mutate(a);
    assert.throws(() => validateReviewPart(a, ids, options()));
  }
  const opts = options(); opts.readbacks[0].sha256 = "forged";
  assert.throws(() => validateReviewPart(answer(ids), ids, opts), /SOURCE_DIGEST_INVALID/);
  const legacy = decodeReviewAnswer(answer(controlCheckIds), options());
  legacy.rows[0].evidence = "fixture:unread";
  assert.throws(() => validateReviewPart(legacy, controlCheckIds, options()), /UNREAD_EVIDENCE/);
});

test("new findings must belong to this part and retain strict owner, deadline and evidence fields", () => {
  const parts = reviewPartitions(2), ids = parts[0];
  const wrong = ownedAnswer(ids); wrong.newFindings[0].checkId = parts[1][0];
  assert.throws(() => validateReviewPart(wrong, ids, options()), /FINDING_UNASSIGNED/);
  assert.throws(() => mergeReviewParts([wrong, answer(parts[1])], parts), /FINDING_UNASSIGNED/);
  for (const mutate of [
    f => f.owner = options().reviewer, f => f.owner = "", f => f.work = " ",
    f => f.reviewAt = "not-an-instant", f => f.blocksResume = "true",
    f => f.affectedTasks = ["*"], f => f.affectedTasks = ["task "],
    f => f.affectedTasks = ["\ntask"], f => f.affectedTasks = ["x".repeat(129)],
    f => f.evidence = "", f => f.sourceIds = ["unread"],
    f => f.criterion = "invented criterion", f => f.id = " "
  ]) {
    const a = ownedAnswer(ids); mutate(a.newFindings[0]);
    assert.throws(() => validateReviewPart(a, ids, options()));
  }
  const duplicated = ownedAnswer(ids); duplicated.newFindings.push({...duplicated.newFindings[0]});
  assert.throws(() => validateReviewPart(duplicated, ids, options()));
  const conflicting = options(); conflicting.offer.input.previousFindings = [previous(ids[0])];
  assert.throws(() => validateReviewPart(ownedAnswer(ids), ids, conflicting), /NEW_FINDING_INVALID/);
});

test("resolutions resolve against retained finding criteria, not row placement or arbitrary ids", () => {
  const parts = reviewPartitions(2), ids = parts[0], opts = options();
  const own = previous(ids[0], "own"), other = previous(parts[1][0], "other");
  opts.offer.input.previousFindings = [own, other];
  const a = answer(ids); a.resolutions = [{id: "own", sourceIds: ["contract"], proof: "Observed completed repair"}];
  const result = validateReviewPart(a, ids, opts);
  assert.equal(result.findings[0].status, "CLOSED");
  assert.equal(result.findings[0].reviewedBy, opts.reviewer);
  assert.equal(result.findings[0].checkedKey, opts.offer.key);
  assert.equal(result.findings[0].attempts, 1);
  assert.deepEqual(result.findings[1], other);
  assert.deepEqual(opts.offer.input.previousFindings, [own, other]);
  const wrong = answer(ids); wrong.resolutions = [{id: "other", sourceIds: ["contract"], proof: "Misplaced repair"}];
  assert.throws(() => validateReviewPart(wrong, ids, opts), /RESOLUTION_UNASSIGNED/);
  for (const mutate of [
    b => b.resolutions[0].id = "unknown", b => b.resolutions[0].proof = " ",
    b => b.resolutions[0].sourceIds = ["unread"], b => b.resolutions.push({...b.resolutions[0]})
  ]) {
    const b = structuredClone(a); mutate(b);
    assert.throws(() => validateReviewPart(b, ids, opts));
  }
  assert.throws(() => validateReviewPart(answer(ids), ids, opts), /OPEN_FINDING_CONTRADICTION/);
});

test("assigned transitions retain OPEN findings and merge without cross-part authority",()=>{
  const parts=reviewPartitions(2),opts=options(),old=previous(parts[0][0],"historical-gap");
  opts.offer.input.previousFindings=[old];
  const raw=parts.map(answer);
  raw[0].rowGroups=[{ids:[old.checkId],status:"UNKNOWN",sourceIds:["contract"],findingId:old.id,reason:"Historical proof absent"},
    {ids:parts[0].slice(1),status:"PASS",sourceIds:["contract"]}];
  raw[0].transitions=[{id:old.id,sourceIds:["contract"],decision:"Independent read-only scope reassessment",blocksResume:false}];
  const partial=validateReviewPart(raw[0],parts[0],opts);
  assert.equal(partial.findings[0].status,"OPEN");assert.equal(partial.findings[0].blocksResume,false);
  const merged=mergeReviewParts(raw,parts),decoded=decodeReviewAnswer(merged,opts);
  assert.deepEqual(merged.transitions,raw[0].transitions);
  assert.equal(validateControlFindings({review:{...decoded,reviewer:opts.reviewer},previousFindings:[old],key:opts.offer.key}),null);
  const wrong=answer(parts[1]);wrong.transitions=raw[0].transitions;
  assert.throws(()=>validateReviewPart(wrong,parts[1],opts),/RESOLUTION_UNASSIGNED/);
  const duplicate=structuredClone(raw);duplicate[1].transitions=raw[0].transitions;
  assert.throws(()=>mergeReviewParts(duplicate,parts),/DUPLICATE_RESOLUTION/);
  const conflict=structuredClone(raw);conflict[0].resolutions=[{id:old.id,sourceIds:["contract"],proof:"Unpermitted combined resolution"}];
  assert.throws(()=>validateReviewPart(conflict[0],parts[0],opts));
});

test("assigned finding history enforces retained failures, independent retries and append-only decisions", () => {
  const ids = reviewPartitions(2)[0], opts = options();
  const old = previous(ids[0]); Object.assign(old, {attempts: 1, lastResult: "FAILED"});
  opts.offer.input.previousFindings = [old];
  const keep = ownedAnswer(ids); keep.newFindings = [];
  assert.deepEqual(validateReviewPart(keep, ids, opts).findings, [old]);
  const close = answer(ids); close.resolutions = [{id: old.id, sourceIds: ["contract"], proof: "Verified new repair"}];
  assert.throws(() => validateReviewPart(close, ids, opts), /EXPLICIT_RETRY/);
  old.retryDecisions = [{fromAttempt: 1, toAttempt: 2, previousResult: "FAILED", decision: "Bounded new repair",
    evidence: "source:contract:retry-decision", reviewedBy: opts.reviewer}];
  const repaired = validateReviewPart(close, ids, opts).findings[0];
  assert.equal(repaired.attempts, 2);
  assert.equal(repaired.lastResult, "PASSED");
  assert.deepEqual(repaired.retryDecisions, old.retryDecisions);
  const closedOpts = options(); closedOpts.offer.input.previousFindings = [repaired];
  assert.deepEqual(validateReviewPart(answer(ids), ids, closedOpts).findings, [repaired]);
  assert.throws(() => validateReviewPart(close, ids, closedOpts));
  old.retryDecisions[0].reviewedBy = old.owner;
  assert.throws(() => validateReviewPart(close, ids, opts), /EXPLICIT_RETRY/);
  old.retryDecisions = [{fromAttempt: 1, toAttempt: 1, previousResult: "FAILED", decision: "Invalid transition",
    evidence: "source:contract:invalid", reviewedBy: opts.reviewer}];
  assert.throws(() => validateReviewPart(keep, ids, opts), /Invalid retry decision/);
});

test("single-part legacy validation retains immutable evidence, closure, owner and failure history", () => {
  const opts = options(), ids = controlCheckIds;
  const old = previous(ids[0]); opts.offer.input.previousFindings = [old];
  const raw = ownedAnswer(ids); raw.newFindings = [];
  const legacy = decodeReviewAnswer(raw, opts);
  for (const mutate of [
    a => a.findings = [], a => a.findings[0].evidence = "rewritten",
    a => a.findings[0].owner = "new-owner", a => a.findings[0].reviewAt = "2026-11-01T10:00:00Z",
    a => a.findings[0].blocksResume = false, a => a.findings[0].attempts = -1,
    a => a.findings[0].revalidations = [{revision: "candidate", evidence: " ", reviewedBy: "reviewer"}]
  ]) {
    const a = structuredClone(legacy); mutate(a);
    assert.throws(() => validateReviewPart(a, ids, opts));
  }
});

test("merge rejects incomplete/duplicate/split partitions, absent answers and crossed answer ordering", () => {
  const parts = reviewPartitions(2).map(ids => [...ids]), raw = parts.map(ids => answer(ids));
  for (const plan of [[], [...parts, ...parts, parts[0]], [parts[0]], [parts[0], parts[0]],
    [parts[0].slice(1), parts[1]], [[...parts[0], parts[1][0]], parts[1]]])
    assert.throws(() => mergeReviewParts(raw, plan));
  assert.throws(() => mergeReviewParts(raw.slice(1), parts));
  assert.throws(() => mergeReviewParts([...raw].reverse(), parts), /COVERAGE_INVALID/);
  const split = parts.map(ids => [...ids]);
  const first = split[0].shift(), second = split[1].shift();
  split[0].push(second); split[1].push(first);
  assert.throws(() => mergeReviewParts(split.map(ids => answer(ids)), split), /GROUP_SPLIT/);
});

test("merge rejects cross-part duplicate new/resolution IDs and never fabricates verdicts", () => {
  const parts = reviewPartitions(2), duplicates = parts.map(ids => ownedAnswer(ids));
  assert.throws(() => mergeReviewParts(duplicates, parts), /DUPLICATE_NEW_FINDING/);
  const resolutions = parts.map(ids => answer(ids));
  for (const a of resolutions) a.resolutions = [{id: "same-old", sourceIds: ["contract"], proof: "Checked"}];
  assert.throws(() => mergeReviewParts(resolutions, parts), /DUPLICATE_RESOLUTION/);
  const conflict = [ownedAnswer(parts[0]), answer(parts[1])];
  conflict[1].resolutions = [{id: "retained-problem", sourceIds: ["contract"], proof: "Cannot close a new finding"}];
  assert.throws(() => mergeReviewParts(conflict, parts), /NEW_FINDING_RESOLUTION_CONFLICT/);
  const raw = parts.map((ids, i) => ownedAnswer(ids, "DEFERRED", `new-${i}`));
  const merged = mergeReviewParts(raw, parts);
  assert.deepEqual(merged.rowGroups, raw.flatMap(a => a.rowGroups));
  assert.deepEqual(merged.newFindings, raw.flatMap(a => a.newFindings));
  assert.deepEqual(merged.resolutions, []);
  assert.deepEqual(Object.keys(merged), ["schema", "rowGroups", "newFindings", "resolutions"]);
  const opts = options(), decoded = decodeReviewAnswer(merged, opts);
  assert.equal(validateControlFindings({review: {...decoded, reviewer: opts.reviewer}, previousFindings: [], key: opts.offer.key}), null);
});

test("merged new findings and scoped resolutions preserve original global history and wire content", () => {
  const parts = reviewPartitions(4), opts = options();
  opts.offer.input.previousFindings = [previous(parts[0][0], "old-0"), previous(parts[1][0], "old-1")];
  const raw = parts.map((ids, i) => i < 2 ? answer(ids) : ownedAnswer(ids, "UNKNOWN", `new-${i}`));
  for (let i = 0; i < 2; i++) raw[i].resolutions = [
    {id: `old-${i}`, sourceIds: ["contract"], proof: `Observed independent repair ${i}`}];
  for (let i = 0; i < parts.length; i++) validateReviewPart(raw[i], parts[i], opts);
  const merged = mergeReviewParts(raw, parts);
  assert.deepEqual(merged.resolutions, raw.flatMap(a => a.resolutions));
  const decoded = decodeReviewAnswer(merged, opts);
  assert.equal(decoded.findings.length, 4);
  assert.deepEqual(decoded.findings.map(f => f.status), ["CLOSED", "CLOSED", "OPEN", "OPEN"]);
  assert.equal(validateControlFindings({review: {...decoded, reviewer: opts.reviewer},
    previousFindings: opts.offer.input.previousFindings, key: opts.offer.key}), null);
});

test("all helpers accept readonly inputs and return detached results without mutation", () => {
  const parts = reviewPartitions(2), opts = options();
  opts.offer.input.previousFindings = [previous(parts[1][0], "outside-part")];
  const raw = parts.map((ids, i) => ownedAnswer(ids, "FINDING", `new-${i}`));
  const before = structuredClone({raw, opts}); freeze(raw); freeze(opts);
  const decoded = validateReviewPart(raw[0], parts[0], opts);
  assert.deepEqual(decoded.findings[0], opts.offer.input.previousFindings[0]);
  decoded.rows[0].reason = "result-only change";
  decoded.findings[0].owner = "result-only owner";
  const merged = mergeReviewParts(raw, parts);
  merged.rowGroups[0].ids.pop(); merged.newFindings[0].owner = "result-only owner";
  assert.deepEqual({raw, opts}, before);
  const legacy = freeze(decodeReviewAnswer(answer(controlCheckIds), options()));
  const full = validateReviewPart(legacy, controlCheckIds, freeze(options()));
  full.rows[0].status = "result-only change";
  assert.equal(legacy.rows[0].status, "PASS");
});
