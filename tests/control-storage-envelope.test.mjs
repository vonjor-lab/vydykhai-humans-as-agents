import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, realpath, readdir, readFile, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {openControlStore} from "../scripts/control-store.mjs";
import {canonicalJson, sha256} from "../scripts/memory-brief.mjs";

async function fixture(t) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), "control-envelope-")));
  t.after(() => rm(directory, {recursive:true, force:true}));
  return {directory, store:await openControlStore(directory)};
}
const state = () => ({schema:"synthetic.storage-observation.v1", paused:true,
  accepted:{id:"retained-work", resultSha256:sha256("accepted-output")},
  pending:{id:"unwritten-knowledge", owner:"knowledge-owner", checkpoint:"repair-storage", status:"PENDING"},
  reservations:{unfinished:{status:"IN_FLIGHT", bindingSha256:sha256("bound-command")}}, history:[]});

test("8 MiB journal capacity refusal retains accepted data, pending ownership and uncertain execution", async t => {
  const x = await fixture(t); await x.store.initialize(state());
  // Protocol/storage fixture, not a model, product or actual process observation.
  await x.store.transact(s => {
    s.history = Array.from({length:32}, (_, i) => ({id:i, outcome:"RETAINED"}));
    s.padding = "x".repeat(7 * 1024 * 1024); return s;
  });
  const before = await x.store.read(), names = (await readdir(x.directory)).sort();
  const bytes = await Promise.all(names.map(n => readFile(path.join(x.directory, n))));
  await assert.rejects(x.store.transact(s => {
    s.padding += "y".repeat(1024 * 1024); s.pending.status = "INTEGRATED";
    s.reservations.unfinished.status = "COMPLETED"; return s;
  }), /CONTROL_STATE_CAPACITY/);
  assert.deepEqual(await x.store.read(), before);
  assert.deepEqual((await readdir(x.directory)).sort(), names);
  for (let i = 0; i < names.length; i++) assert.deepEqual(await readFile(path.join(x.directory, names[i])), bytes[i]);
  const restarted = await openControlStore(x.directory), retained = await restarted.read();
  assert.equal(retained.state.paused, true);
  assert.equal(retained.state.pending.owner, "knowledge-owner");
  assert.equal(retained.state.pending.status, "PENDING");
  assert.equal(retained.state.reservations.unfinished.status, "IN_FLIGHT");
  assert.equal(retained.state.accepted.resultSha256, sha256("accepted-output"));
});

test("full history remains checked after growth and restart, not only the latest state", async t => {
  const x = await fixture(t); await x.store.initialize(state());
  for (let i = 0; i < 32; i++) await x.store.transact(s => {s.history.push({id:i, outcome:"RETAINED"}); return s;});
  const before = await x.store.read(); assert.equal(before.revision, 32);
  const restarted = await openControlStore(x.directory); assert.deepEqual(await restarted.read(), before);
  const firstFile = path.join(x.directory, "0000000000.json");
  const first = JSON.parse(await readFile(firstFile, "utf8")); first.state.pending.owner = "replacement";
  await writeFile(firstFile, canonicalJson(first));
  await assert.rejects(restarted.read(), /CONTROL_HISTORY_INVALID/);
  await assert.rejects(restarted.transact(s => {s.paused = false; return s;}), /CONTROL_HISTORY_INVALID/);
  assert.equal((await readdir(x.directory)).length, 33);
});
