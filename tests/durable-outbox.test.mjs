import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  createReturnRoute,
  createReturnSync,
  classifyGuard,
  parseDurableOutboxComment,
  validateDurableOutbox,
} from "../scripts/vydykhai.mjs";

function producer(id) {
  return `<!-- vydykhai:return-sync v1 -->
# Return Sync
Status: ACCEPT
Return receipt id: ${id}
Return lifecycle: WRITTEN -> SENT
Task / context / PR / commit / artifact: task-one / worker / none / abc123 / result
Memory candidates: NO_MEMORY_DELTA
Artifact disposition: context -> FINISH / clean
Recommended orchestrator next action: accept the result
<!-- vydykhai:return-sync:end -->`;
}

function consumer(id) {
  return `<!-- vydykhai:return-route v1 -->
# Return Route
Return receipt id: ${id}
Return lifecycle: RECEIVED -> CONSUMED -> ROUTED
Consumer: active-orchestrator
Routed next action: result accepted
Evidence: event-one
<!-- vydykhai:return-route:end -->`;
}

test("canonical parser imports without running the CLI", () => {
  const moduleUrl = new URL("../scripts/vydykhai.mjs", import.meta.url).href;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", `await import(${JSON.stringify(moduleUrl)})`], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("ordinary prose and headings never manufacture receipt ids", () => {
  const result = validateDurableOutbox("# Return Sync\n\nread-only inspection\nStatus: fine\nTrigger: review\n# Return Route\n");
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.pendingReturnIds, []);
  assert.equal(result.returnCount, 0);
  assert.equal(result.routeCount, 0);
});

test("complete pairs expose the same structured records used by guard-check", () => {
  const result = validateDurableOutbox(`${producer("R1")}\n${consumer("R1")}`);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.routedReturnIds, ["R1"]);
  assert.deepEqual(result.pendingReturnIds, []);
  assert.equal(result.returns[0].fields.Status, "ACCEPT");
  assert.equal(result.routes[0].fields.Consumer, "active-orchestrator");
  assert.equal(result.returns[0].valid, true);
  assert.equal(result.routes[0].valid, true);
});

test("canonical constructors emit parser-valid records and reject invented status grammar", () => {
  const emittedReturn = createReturnSync({
    status: "NEEDS_FIXES",
    statusDetail: "Production was not touched",
    returnReceiptId: "R1",
    taskContextArtifact: "task-one / worker / none / abc123 / result",
    memoryCandidates: "NO_MEMORY_DELTA",
    artifactDisposition: "context -> FINISH / clean",
    recommendedNextAction: "repair the bounded finding",
  });
  const emittedRoute = createReturnRoute({
    returnReceiptId: "R1",
    consumer: "active-orchestrator",
    routedNextAction: "bounded repair routed",
    evidence: "event-one",
  });
  const parsed = parseDurableOutboxComment(`${emittedReturn}\n${emittedRoute}`);
  assert.deepEqual(parsed.issues, []);
  assert.deepEqual(parsed.warnings, []);
  assert.deepEqual(parsed.routedReturnIds, ["R1"]);
  assert.throws(() => createReturnSync({ status: "NEEDS_FIXES / PRODUCTION_NOT_TOUCHED" }), TypeError);
});

test("bounded legacy route labels and status qualifiers remain readable", () => {
  const legacyReturn = producer("R1").replace("Status: ACCEPT", "Status: NEEDS_FIXES / PRODUCTION_NOT_TOUCHED");
  const legacyRoute = consumer("R1")
    .replace("Consumer: active-orchestrator", "Consumer / route: active-orchestrator")
    .replace("Evidence: event-one", "Accepted evidence: event-one");
  const result = validateDurableOutbox(`${legacyReturn}\n${legacyRoute}`);
  assert.deepEqual(result.issues, []);
  assert.equal(result.warnings.length, 3);
  assert.deepEqual(result.routedReturnIds, ["R1"]);
  assert.equal(result.returns[0].fields.Status, "NEEDS_FIXES");
  assert.deepEqual(result.returns[0].statusQualifiers, ["PRODUCTION_NOT_TOUCHED"]);
  assert.equal(result.routes[0].fields.Consumer, "active-orchestrator");
  assert.equal(result.routes[0].fields.Evidence, "event-one");
});

test("writing a result does not claim delivery when sending was absent or denied", () => {
  const input = {
    status: "CHECKPOINT_READY", returnReceiptId: "UNSENT-1",
    taskContextArtifact: "task-one / local result",
    memoryCandidates: "NO_MEMORY_DELTA",
    artifactDisposition: "Result retained locally; sending not authorized by the host",
    recommendedNextAction: "Resolve the exact delivery permission; do not repeat the completed work",
  };
  const written = createReturnSync(input);
  const pending = parseDurableOutboxComment(written);
  assert.equal(pending.returns[0].fields["Return lifecycle"], "WRITTEN");
  assert.equal(pending.returns[0].fields.Status, "CHECKPOINT_READY");
  assert.deepEqual(pending.pendingReturnIds, ["UNSENT-1"]);
  assert.equal(pending.routedCount, 0);
  assert.equal(createReturnSync(input), written, "receipt construction neither sends nor retries");

  // A caller records SENT only after its own confirmed, authorized transport.
  const sent = parseDurableOutboxComment(createReturnSync({ ...input, returnLifecycle: "WRITTEN -> SENT" }));
  assert.equal(sent.returns[0].fields["Return lifecycle"], "WRITTEN -> SENT");
  assert.deepEqual(sent.pendingReturnIds, ["UNSENT-1"], "sending is still not consumption");
  assert.throws(() => createReturnSync({ ...input, returnLifecycle: "WRITTEN -> ROUTED" }), TypeError);
});

test("mixed canonical and legacy route labels stay ambiguous", () => {
  for (const route of [
    consumer("R1").replace("Consumer: active-orchestrator", "Consumer: active-orchestrator\nConsumer / route: active-orchestrator"),
    consumer("R1").replace("Evidence: event-one", "Evidence: event-one\nAccepted evidence: event-one"),
  ]) {
    const result = validateDurableOutbox(`${producer("R1")}\n${route}`);
    assert.equal(result.routedCount, 0);
    assert.deepEqual(result.pendingReturnIds, ["R1"]);
    assert.ok(result.issues.some((issue) => issue.includes("repeats or mixes")));
  }
});

test("a newer routed result never masks an older pending result", () => {
  for (const content of [
    `${producer("OLD")}\n${producer("NEW")}\n${consumer("NEW")}`,
    `${consumer("NEW")}\n${producer("NEW")}\n${producer("OLD")}`,
  ]) {
    const result = validateDurableOutbox(content);
    assert.deepEqual(result.pendingReturnIds, ["OLD"]);
    assert.deepEqual(result.routedReturnIds, ["NEW"]);
    assert.deepEqual(result.issues, ["Durable outbox: return OLD requires routing"]);
  }
});

test("missing, empty or placeholder consumer evidence cannot close a result", () => {
  for (const field of ["Return receipt id", "Return lifecycle", "Consumer", "Routed next action", "Evidence"]) {
    for (const replacement of ["", `${field}: `, `${field}: <missing>`]) {
      const route = consumer("R1").replace(new RegExp(`^${field}:.*$`, "m"), replacement);
      const result = validateDurableOutbox(`${producer("R1")}\n${route}`);
      assert.equal(result.routedCount, 0, `${field}: ${replacement}`);
      assert.deepEqual(result.pendingReturnIds, ["R1"]);
      assert.ok(result.issues.some((issue) => issue.includes(`lacks ${field}`)));
    }
  }
});

test("missing producer fields cannot borrow the next line or be routed", () => {
  const result = validateDurableOutbox(`${producer("R1").replace("Memory candidates: NO_MEMORY_DELTA", "Memory candidates:")}\n${consumer("R1")}`);
  assert.equal(result.returns[0].fields["Memory candidates"], "");
  assert.equal(result.returns[0].valid, false);
  assert.equal(result.routedCount, 0);
  assert.deepEqual(result.pendingReturnIds, ["R1"]);
});

test("queued, sent or partially consumed transport is not routing", () => {
  for (const lifecycle of ["SENT", "QUEUED", "RECEIVED", "RECEIVED -> CONSUMED"]) {
    const result = validateDurableOutbox(`${producer("R1")}\n${consumer("R1").replace("RECEIVED -> CONSUMED -> ROUTED", lifecycle)}`);
    assert.equal(result.routedCount, 0);
    assert.deepEqual(result.pendingReturnIds, ["R1"]);
  }
});

test("duplicate records or duplicate identity fields remain ambiguous", () => {
  for (const content of [
    `${producer("R1")}\n${producer("R1")}\n${consumer("R1")}`,
    `${producer("R1")}\n${consumer("R1")}\n${consumer("R1")}`,
    `${producer("R1").replace("Return receipt id: R1", "Return receipt id: R1\nReturn receipt id: R2")}\n${consumer("R1")}`,
    `${producer("R1")}\n${consumer("R1").replace("Consumer: active-orchestrator", "Consumer: active-orchestrator\nConsumer: other-orchestrator")}`,
  ]) {
    const result = validateDurableOutbox(content);
    assert.equal(result.routedCount, 0);
    assert.deepEqual(result.pendingReturnIds, ["R1"]);
    assert.ok(result.issues.some((issue) => /duplicate|repeats/.test(issue)));
  }
});

test("mismatched and malformed framing is diagnostic, never a healthy pair", () => {
  for (const content of [
    `${producer("R1")}\n${consumer("OTHER")}`,
    `${producer("R1")}\n${consumer("R1").replace("<!-- vydykhai:return-route:end -->", "")}`,
    `${producer("R1")}\n<!-- vydykhai:return-route:end -->\n${consumer("R1").replace("<!-- vydykhai:return-route:end -->", "")}`,
    producer("R1").replace("<!-- vydykhai:return-sync:end -->", `${consumer("R1")}\n<!-- vydykhai:return-sync:end -->`),
  ]) {
    const result = validateDurableOutbox(content);
    assert.equal(result.routedCount, 0);
    assert.ok(result.issues.length > 0);
  }
});

test("unframed machine fields are diagnosed even alongside a valid pair", () => {
  const result = validateDurableOutbox(`${producer("R1")}\n${consumer("R1")}\nReturn receipt id: UNFRAMED\n`);
  assert.ok(result.issues.some((issue) => issue.includes("unmarked Return Sync")));
  assert.equal(result.returnCount, 1);
});

test("JSON claiming Return protocol framing is not a silently empty outbox", () => {
  for (const kind of ["sync", "route"]) {
    const wrong = JSON.stringify({ marker: `vydykhai:return-${kind} v1`, receiptId: "LOST",
      status: "ACCEPT", lifecycle: kind === "sync" ? "WRITTEN" : "RECEIVED -> CONSUMED -> ROUTED" });
    for (const body of [wrong, JSON.stringify(JSON.parse(wrong), null, 2),
      `\`\`\`json\n${wrong}\n\`\`\``, `\`\`\`json\r\n${wrong}\r\n\`\`\`\r\n`,
      `${producer("GOOD")}\n${consumer("GOOD")}\n${wrong}`]) {
      const parsed = validateDurableOutbox(body);
      assert.ok(parsed.issues.some(issue => issue.includes("JSON Return claim requires canonical v1 framing")));
      assert.ok(!parsed.returns.some(record => record.id === "LOST"));
      assert.ok(!parsed.routes.some(record => record.id === "LOST"));
      const result = { ok: parsed.issues.length === 0, stateIssues: [], graphIssues: [], outbox: parsed };
      const first = classifyGuard(result, "");
      assert.equal(first.action, "AUDIT_REQUIRED");
      const repeated = classifyGuard(result, "Snapshot as of: newer", {
        repairIncidentId: first.incidentId, repairAttempts: 1,
      });
      assert.equal(repeated.incidentId, first.incidentId);
      assert.equal(repeated.action, "CONTROL_DEGRADED", "no repeated paid repair for the same malformed return");
    }
  }
});

test("ordinary JSON and protocol mentions do not manufacture control incidents", () => {
  for (const body of [JSON.stringify({status:"ACCEPT",receiptId:"business-record"}),
    JSON.stringify({note:"vydykhai:return-sync v1"}),
    JSON.stringify({marker:["vydykhai:return-sync v1"]}),
    JSON.stringify({marker:"application-export v1"}),
    "Documentation discusses vydykhai:return-sync v1; this is not a receipt."]) {
    const result = validateDurableOutbox(body);
    assert.deepEqual(result.issues, []);
    assert.equal(result.returnCount, 0);
    assert.equal(result.routeCount, 0);
  }
});

test("a prior accepted malformed claim cannot mask a different claimed receipt", () => {
  const raw = id => JSON.stringify({marker:"vydykhai:return-sync v1",receiptId:id,status:"ACCEPT"});
  const check = (body, options={}) => {
    const outbox=validateDurableOutbox(body);
    return classifyGuard({ok:false,stateIssues:[],graphIssues:[],outbox}, "", options);
  };
  const first = check(raw("ONE"));
  assert.equal(check(raw("ONE"), {acceptedIncidentId:first.incidentId}).action, "NOOP");
  const second = check(raw("TWO"), {acceptedIncidentId:first.incidentId});
  assert.equal(second.action, "AUDIT_REQUIRED");
  assert.notEqual(second.incidentId, first.incidentId);
  const fenced = `\`\`\`json\n${raw("ONE")}\n\`\`\`\n\`\`\`json\n${raw("TWO")}\n\`\`\``;
  assert.equal(validateDurableOutbox(fenced).issues.length, 2);
});

test("exact producer framing repair is discovered once, then routed without replaying work", () => {
  const jsonReceipt = {marker:"vydykhai:return-sync v1",receiptId:"R-KEPT",status:"ACCEPT"};
  const malformed = validateDurableOutbox(JSON.stringify(jsonReceipt));
  assert.ok(malformed.issues.length);
  assert.deepEqual(malformed.pendingReturnIds, []);
  const emitted = createReturnSync({status:jsonReceipt.status, returnReceiptId:jsonReceipt.receiptId,
    taskContextArtifact:"worker / retained-artifact", memoryCandidates:"retained obligations; not integrated",
    artifactDisposition:"same preserved implementation; framing-only repair",
    recommendedNextAction:"consume exact artifact; parent remains open"});
  const pending = validateDurableOutbox(emitted);
  assert.deepEqual(pending.pendingReturnIds, [jsonReceipt.receiptId]);
  const result = {ok:false,stateIssues:[],graphIssues:[],outbox:pending};
  const wake = classifyGuard(result, "");
  assert.equal(wake.action, "WAKE");
  assert.equal(classifyGuard(result, "", {wokenIncidentId:wake.incidentId}).action, "AUDIT_REQUIRED");
  const paired = validateDurableOutbox(`${emitted}\n${createReturnRoute({returnReceiptId:jsonReceipt.receiptId,
    consumer:"manager",routedNextAction:"retain remaining platform obligations",evidence:"independent exact-current receipt"})}`);
  assert.deepEqual(paired.issues, []);
  assert.deepEqual(paired.routedReturnIds, [jsonReceipt.receiptId]);
  for (let i=0;i<2;i++) assert.equal(classifyGuard({ok:true,stateIssues:[],graphIssues:[],outbox:paired}, "").action,"NOOP");
});

test("CRLF transport preserves complete pairs", () => {
  const result = validateDurableOutbox(`${producer("R1")}\n${consumer("R1")}`.replaceAll("\n", "\r\n"));
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.routedReturnIds, ["R1"]);
});
