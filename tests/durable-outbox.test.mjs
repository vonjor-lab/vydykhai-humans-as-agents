import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { validateDurableOutbox } from "../scripts/vydykhai.mjs";

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

test("CRLF transport preserves complete pairs", () => {
  const result = validateDurableOutbox(`${producer("R1")}\n${consumer("R1")}`.replaceAll("\n", "\r\n"));
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.routedReturnIds, ["R1"]);
});
