// Explicit isolated native worker launch. No inherited user config, tool fallback
// or continuation of an existing chat. Authentication must already be provisioned
// by the operator in the private CLI home; this module never copies credentials.
import {realpath, lstat} from "node:fs/promises";
import path from "node:path";
import {controlledCodexConfig, reviewCodexConfig, ownerCodexConfig, dispositionCodexConfig, preparationCodexConfig, codexConfigArgs} from "./control-codex-profile.mjs";
import {runControlChild} from "./control-child.mjs";
import {readPrivateControlJson, openReviewSources} from "./control-review-sources.mjs";
import {openControlHost, validPreparationAcceptanceIds} from "./control-host.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";

const need = (value, code) => {if (!value) throw Error(code);};
export function controlledWorkerPrompt(prompt,endpoint) {
  need(endpoint?.schema==="control.worker-endpoint.v1"&&Array.isArray(endpoint.requests)&&
    endpoint.requests.length>0&&endpoint.requests.length<=100&&endpoint.requests.every(r=>
      typeof r?.id==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(r.id))&&
    new Set(endpoint.requests.map(r=>r.id)).size===endpoint.requests.length,"CONTROL_WORKER_CAPABILITY_METADATA_INVALID");
  return `Controlled adapter capability metadata (not execution approval):\n`+
    `API: execute_registered({requestId:string}); registered request IDs: ${JSON.stringify(endpoint.requests.map(r=>r.id))}.\n`+
    `The MCP server is vydykhai_control. If its tools are deferred, discover execute_registered through ALL_TOOLS/tool discovery; an absent initial tool description does not prove absence.\n`+
    `The host independently admits or blocks each request. This metadata does not approve execution, choose a request, cancel a pause, authorize retries or provide a shell fallback. Follow the caller's scope below; if the capability is unavailable after discovery, report that fact without execution.\n\n`+prompt;
}
export async function runControlledWorker({binary, workspace, endpointFile, controlEndpointFile, home, model, effort,
  prompt, timeoutMs = 120000, maxBytes = 4 * 1024 * 1024, provider, signal, role = "worker", authHome = home,
  enableMemoryRecall = false, reviewAcquisition}) {
  need(process.platform === "darwin", "CONTROL_WORKER_HOST_UNSUPPORTED");
  need([binary, workspace, endpointFile, home].every(v => typeof v === "string" && path.isAbsolute(v)) &&
    typeof model === "string" && model.trim() && ["low", "medium", "high", "xhigh", "max"].includes(effort) &&
    typeof prompt === "string" && prompt.trim() && Buffer.byteLength(prompt) <= 1024 * 1024 &&
    Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 300000 &&
    Number.isSafeInteger(maxBytes) && maxBytes >= 1024 && maxBytes <= 16 * 1024 * 1024,
  "CONTROL_WORKER_CONFIG_INVALID");
  const actualHome = await realpath(home), actualWorkspace = await realpath(workspace), stat = await lstat(home);
  const parent = path.dirname(endpointFile), parentStat = await lstat(parent);
  need(actualHome === home && actualWorkspace === workspace && stat.isDirectory() && !(stat.mode & 0o077) &&
    parentStat.isDirectory() && !(parentStat.mode & 0o077) && await realpath(parent) === parent &&
    home.startsWith(parent + path.sep) && !home.startsWith(workspace + path.sep) && home !== workspace,
  "CONTROL_WORKER_HOME_UNSAFE");
  need(["worker", "review", "owner", "owner-disposition", "preparation"].includes(role) && typeof authHome === "string" && path.isAbsolute(authHome) &&
    await realpath(authHome) === authHome && (await lstat(authHome)).isDirectory() &&
    authHome !== workspace && !authHome.startsWith(workspace + path.sep), "CONTROL_WORKER_AUTH_OR_ROLE_INVALID");
  need(typeof enableMemoryRecall === "boolean" && (!enableMemoryRecall || role === "review"), "CONTROL_WORKER_RECALL_PROFILE_INVALID");
  need(reviewAcquisition === undefined || role === "review", "CONTROL_WORKER_ACQUISITION_ROLE_INVALID");
  let controlEndpointDigest, preparationHost, preparationIds;
  if (role === "preparation") {
    need(typeof controlEndpointFile === "string" && path.isAbsolute(controlEndpointFile), "PREPARATION_CONTROL_ENDPOINT_REQUIRED");
    const endpoint = await readPrivateControlJson(controlEndpointFile);
    need(endpoint.schema === "control.owner-endpoint.v1" && endpoint.capability === "CONTROL_READ_ONLY" &&
      validPreparationAcceptanceIds(endpoint.acceptanceIds), "PREPARATION_CONTROL_PROFILE_INVALID");
    const sources = await openReviewSources(endpointFile);
    need(endpoint.config?.workspace === sources.workspace, "PREPARATION_CONTROL_WORKSPACE_MISMATCH");
    const host = await openControlHost(endpoint.directory, endpoint.config, {}), state = await host.snapshot();
    need(endpoint.acceptanceIds.every(id => Object.hasOwn(state.acceptances, id)), "ACCEPTANCE_NOT_FOUND");
    controlEndpointDigest = sha256(canonicalJson(endpoint));
    preparationHost = host; preparationIds = [...endpoint.acceptanceIds];
  }
  const profile = {review:reviewCodexConfig,owner:ownerCodexConfig,"owner-disposition":dispositionCodexConfig,
    preparation:preparationCodexConfig,worker:controlledCodexConfig}[role];
  const config = {...profile({workspace, endpointFile, controlEndpointFile, controlEndpointDigest, enableMemoryRecall, reviewAcquisition}), model_reasoning_effort: effort};
  if (provider !== undefined) {
    need(provider && typeof provider.baseUrl === "string" && typeof provider.requiresAuth === "boolean",
      "CONTROL_WORKER_PROVIDER_INVALID");
    const url = new URL(provider.baseUrl);
    need(["http:", "https:"].includes(url.protocol) && !url.username && !url.password, "CONTROL_WORKER_PROVIDER_INVALID");
    config.model_provider = "controlled_provider";
    config["model_providers.controlled_provider"] = {name: "Operator configured provider", base_url: url.href,
      wire_api: "responses", requires_openai_auth: provider.requiresAuth, request_max_retries: 0, stream_max_retries: 0};
  }
  if(signal?.aborted) return {state: "NOT_STARTED", status: "NOT_STARTED", reason: "CANCELLED", code: null, signal: null, output: "", errors: ""};
  const executable = await realpath(binary);
  // Expose the closed API and registered IDs, never command contents or authority.
  let launchPrompt=prompt;
  if(role==="worker") {
    try {launchPrompt=controlledWorkerPrompt(prompt,await readPrivateControlJson(endpointFile));}
    catch(e){if(e.code!=="ENOENT")throw e;}
  }
  const result = await runControlChild({executable,
    args: ["exec", "--ignore-user-config", "--strict-config", "--skip-git-repo-check",
      "--ephemeral", "--model", model, ...codexConfigArgs(config), "--json", "-"], cwd: workspace,
    env: {HOME: home, CODEX_HOME: authHome, PATH: "/usr/local/bin:/usr/bin:/bin"},
    input: launchPrompt, timeoutMs, maxBytes, signal});
  // A stopped CLI is not proof that a tool effect finished. Unresolved command
  // reservations remain IN_FLIGHT in the separate host and cannot be replayed.
  const nativeStatus = result.state === "UNKNOWN" ? "OUTCOME_UNKNOWN" :
    result.code === 0 && !result.reason ? "CLI_EXIT_OK" : "CLI_EXIT_WITH_ERROR";
  if (role !== "preparation") return {...result, status: nativeStatus};
  let receipt;
  try {
    need(nativeStatus === "CLI_EXIT_OK", "PREPARATION_NATIVE_RUN_NOT_COMPLETED");
    const events = result.output.split("\n").filter(Boolean).map(line => JSON.parse(line));
    need(events.filter(e => e.type === "turn.completed").length === 1 &&
      !events.some(e => e.type === "turn.failed" || e.type === "error"), "PREPARATION_NATIVE_TURN_NOT_COMPLETED");
    const calls = events.filter(e => e.type === "item.completed" && e.item?.type === "mcp_tool_call" &&
      e.item.server === "vydykhai_owner" && e.item.tool === "read_status");
    const call = calls.at(-1)?.item;
    need(call?.status === "completed" && !call.error && !call.result?.isError, "PREPARATION_STATUS_NOT_ACQUIRED");
    const content = call.result?.content?.filter(c => c.type === "text");
    need(content?.length === 1, "PREPARATION_STATUS_READBACK_INVALID");
    receipt = JSON.parse(content[0].text);
    need(receipt?.schema === "control.preparation-status.v1" && receipt.receipt === "DOES_NOT_GRANT_EXECUTION" &&
      canonicalJson(receipt.acceptanceIds) === canonicalJson(preparationIds), "PREPARATION_STATUS_READBACK_INVALID");
    need(sha256(canonicalJson(await readPrivateControlJson(controlEndpointFile))) === controlEndpointDigest,
      "PREPARATION_CONTROL_PROFILE_CHANGED");
    const current = await preparationHost.preparationStatus(preparationIds, {expectedDigest: receipt.digest});
    const withoutTime = value => {const {observedAt, ...body} = value; return body;};
    need(canonicalJson(withoutTime(receipt)) === canonicalJson(withoutTime(current)), "PREPARATION_STATUS_READBACK_INVALID");
    return {...result, nativeStatus, status: "PREPARATION_STATUS_VERIFIED",
      preparation: {schema: "control.preparation-readback.v1", status: "VERIFIED", receipt: current,
        acquisitionItemId: call.id, sourceAcquisition: "CALLER_CHECK_REQUIRED", semanticAcceptance: "NOT_ESTABLISHED"}};
  } catch (e) {
    return {...result, nativeStatus, status: "PREPARATION_UNVERIFIED",
      preparation: {schema: "control.preparation-readback.v1", status: "UNVERIFIED", reason: e.message,
        ...(receipt ? {acquiredDigest: receipt.digest} : {}), semanticAcceptance: "NOT_ESTABLISHED"}};
  }
}
