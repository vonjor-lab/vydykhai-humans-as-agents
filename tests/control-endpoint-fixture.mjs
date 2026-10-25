import {mkdtemp, mkdir, realpath, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fixture, hash} from "./context-fixture.mjs";
import {sha256} from "../scripts/memory-brief.mjs";
import {openControlHost} from "../scripts/control-host.mjs";
import {createReturnSync, parseDurableOutboxComment} from "../scripts/vydykhai.mjs";

export const endpointServices = {createReturnSync, parseDurableOutboxComment};
export async function endpointFixture(t) {
  const f = await fixture(t), p = await f.prepare();
  const privateRoot = await realpath(await mkdtemp(path.join(tmpdir(), "vydykhai-endpoint-")));
  t.after(() => rm(privateRoot, {recursive: true, force: true}));
  const directory = path.join(privateRoot, "state"); await mkdir(directory, {mode: 0o700});
  const config = {workspace: f.root, policy: sha256("candidate-policy"), owner: "owner", executor: "worker", reviewer: "reviewer"};
  const host = await openControlHost(directory, config, endpointServices); await host.initialize();
  const binding = {operation: "resume", taskId: f.task.id, taskSha256: f.request.task.sha256,
    capsuleSha256: f.request.capsule.sha256, sourceDigest: p.coverageBasis.sourceDigest,
    dependencyDigest: p.coverageBasis.dependencyDigest, commandSha256: hash(f.task.action),
    cwd: f.root, executable: await realpath(process.execPath), kind: "dependent"};
  const profile = {schema: "control.worker-endpoint.v1", directory, config,
    requests: [{id: "next", request: {...f.request, operation: "resume"}}]};
  const file = path.join(privateRoot, "worker.json");
  await writeFile(file, JSON.stringify(profile), {mode: 0o600});
  const approve = () => host.approveCommand(binding, {reviewer: config.reviewer, reviewReceipt: "fixture:source-reviewed",
    dependencies: [], expiresAt: Date.now() + 120000});
  return {f, prepared: p, privateRoot, host, profile, file, approve};
}
