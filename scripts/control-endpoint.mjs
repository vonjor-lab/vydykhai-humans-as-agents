// Executor capability: registered requests only. No reviewer/owner/store methods
// are exposed to the model. The parent launcher owns the private configuration.
import {readFile, realpath, lstat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {openControlHost} from "./control-host.mjs";
import {localControlSandbox} from "./local-control-sandbox.mjs";
import {runControlledContextTransition} from "./controlled-context-run.mjs";

const inside = (a, b) => b === a || b.startsWith(a + path.sep);
const need = (value, code) => {if (!value) throw Error(code);};
export async function openWorkerEndpoint(configFile, services) {
  const file = await realpath(configFile), stat = await lstat(configFile);
  need(file === path.resolve(configFile) && stat.isFile() && !stat.isSymbolicLink() &&
    !(stat.mode & 0o077) && stat.size <= 1024 * 1024, "CONTROL_ENDPOINT_CONFIG_UNSAFE");
  const parent = await lstat(path.dirname(file));
  need(parent.isDirectory() && !(parent.mode & 0o077), "CONTROL_ENDPOINT_CONFIG_UNSAFE");
  const profile = JSON.parse(await readFile(file));
  need(profile.schema === "control.worker-endpoint.v1" && Array.isArray(profile.requests) &&
    profile.requests.length > 0 && profile.requests.length <= 100, "CONTROL_ENDPOINT_CONFIG_INVALID");
  const {directory, config} = profile;
  const workspace = await realpath(config.workspace), controlRoot = await realpath(directory);
  const runtime = path.dirname(fileURLToPath(import.meta.url));
  need(workspace === path.resolve(config.workspace) && !inside(workspace, file) &&
    !inside(workspace, runtime) && !inside(workspace, controlRoot) && !inside(controlRoot, workspace),
    "CONTROL_ENDPOINT_BOUNDARY_INVALID");
  need(inside(path.dirname(file), controlRoot), "CONTROL_ENDPOINT_BOUNDARY_INVALID");
  const requests = new Map();
  for (const entry of profile.requests) {
    need(typeof entry.id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(entry.id) && !requests.has(entry.id) &&
      entry.request?.workspace === workspace && ["resume", "accept"].includes(entry.request.operation),
      "CONTROL_ENDPOINT_REQUEST_INVALID");
    requests.set(entry.id, structuredClone(entry.request));
  }
  const host = await openControlHost(controlRoot, config, services);
  await host.snapshot();
  const sandboxLaunch = await localControlSandbox({workspace, controlRoot: path.dirname(file)});
  return {
    async execute(args) {
      need(args && Object.keys(args).length === 1 && typeof args.requestId === "string" &&
        requests.has(args.requestId), "CONTROL_ENDPOINT_REQUEST_NOT_REGISTERED");
      return runControlledContextTransition(requests.get(args.requestId), {...services, control: host.control, sandboxLaunch});
    }
  };
}
