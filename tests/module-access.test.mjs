import test from "node:test";
import assert from "node:assert/strict";
import { moduleAccessPolicy } from "../scripts/module-access.mjs";

const ref = path => ({ path, sha256: "a".repeat(64) });
const fixture = () => ({ schema: "context.module-access.v1", modules: [
  { id: "consumer", intent: "change", contractFiles: ["docs/consumer.md"], privatePaths: ["consumer", "tests/consumer"], release: null },
  { id: "producer", intent: "consume", contractFiles: ["docs/producer.md"], privatePaths: ["producer"],
    release: { artifact: ref("release/producer.mjs"), connection: ref("proof/connection.json") } }
] });
const check = (data = fixture(), files = ["consumer/main.mjs"]) => moduleAccessPolicy(data, "consumer", files);

test("closed modules allow public facts and release binding, never private retrieval or edits", () => {
  const p = check();
  p.assertRead("docs/producer.md");
  p.assertRead("release/producer.mjs", "binding");
  p.assertRead("consumer/logic.mjs");
  p.assertMutation("tests/consumer/flow.mjs");
  p.assertMutation("docs/consumer.md");
  for (const file of ["producer", "producer/logic.mjs", "release/producer.mjs"]) {
    assert.throws(() => p.assertRead(file), /CONSUMED_MODULE_CONTEXT_FORBIDDEN/);
    assert.throws(() => p.assertMutation(file), /CONSUMED_MODULE_MUTATION_FORBIDDEN/);
  }
  for (const file of ["docs/producer.md", "proof/connection.json"]) {
    assert.throws(() => p.assertMutation(file), /CONSUMED_MODULE_MUTATION_FORBIDDEN/);
  }
  assert.throws(() => p.assertMutation("unowned/main.mjs"), /MODULE_FILE_UNOWNED/);
});

test("missing boundary, connection proof, ambiguous ownership or path tricks cannot qualify", () => {
  assert.throws(() => check({ schema: "context.module-access.v1", modules: [] }), /MODULE_ACCESS_INVALID/);
  const data = fixture();
  data.modules[1].release.connection = null;
  assert.throws(() => check(data), /MODULE_ACCESS_INVALID/);
  data.modules[1] = fixture().modules[1];
  data.modules[0].privatePaths.push("producer/internal");
  assert.throws(() => check(data), /MODULE_OWNERSHIP_OVERLAP/);
  for (const file of ["../producer/x", "consumer/../producer/x", "./producer/x", "producer\\x", "/producer/x", "producer//x"]) {
    assert.throws(() => check(fixture(), [file]), /MODULE_PATH_INVALID/);
  }
  assert.throws(() => moduleAccessPolicy(fixture(), "producer", ["consumer/main.mjs"]), /MODULE_TARGET_UNOWNED/);
});

test("authorized development opens only its owner; a composition does not open its dependencies", () => {
  const data = fixture();
  data.modules[0].intent = "create";
  const p = check(data);
  p.assertRead("consumer/aggregate.mjs");
  assert.throws(() => p.assertRead("producer/solver.mjs"), /CONSUMED_MODULE_CONTEXT_FORBIDDEN/);
  data.modules[1].intent = "change";
  data.modules[1].release = null;
  check(data, ["producer/solver.mjs"]).assertRead("producer/solver.mjs");
  // Changing this approved declaration requires a new package, not an executor flag.
});
