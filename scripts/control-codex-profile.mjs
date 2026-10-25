// Explicit isolated CLI profile, not a change to an existing desktop chat.
import path from "node:path";
import {fileURLToPath} from "node:url";
import {validateReviewAcquisition} from "./control-review-acquisition.mjs";

export function controlledCodexConfig({workspace, endpointFile, nodeExecutable = process.execPath}) {
  if (![workspace, endpointFile, nodeExecutable].every(path.isAbsolute)) throw Error("CONTROL_PROFILE_PATH_INVALID");
  return {
    approval_policy: "never", default_permissions: "controlled", allow_login_shell: false, web_search: "disabled",
    "permissions.controlled.filesystem": {":minimal": "read", [workspace]: "read"},
    "permissions.controlled.network.enabled": false,
    "features.shell_tool": false, "features.unified_exec": false, "features.plugins": false,
    "features.apps": false, "features.hooks": false, "features.memories": false,
    "features.multi_agent": false, "features.multi_agent_v2": false, "agents.enabled": false,
    "features.skip_host_skill_discovery": true, "features.shell_snapshot": false,
    "features.browser_use": false, "features.computer_use": false, "features.image_generation": false,
    "features.goals": false, "features.sleep_tool": false, "features.workspace_dependencies": false,
    "shell_environment_policy.inherit": "none",
    "mcp_servers.vydykhai_control": {command: nodeExecutable,
      args: [fileURLToPath(new URL("./control-mcp.mjs", import.meta.url)), endpointFile],
      required: true, enabled: true, enabled_tools: ["execute_registered"], startup_timeout_sec: 10,
      tools: {execute_registered: {approval_mode: "approve"}},
      tool_timeout_sec: 40}
  };
}

export function reviewCodexConfig({workspace, endpointFile, nodeExecutable = process.execPath, enableMemoryRecall = false, reviewAcquisition, reviewSubmissionFile}) {
  if (typeof enableMemoryRecall !== "boolean") throw Error("CONTROL_PROFILE_RECALL_INVALID");
  if (reviewAcquisition !== undefined) validateReviewAcquisition(reviewAcquisition);
  if (reviewAcquisition !== undefined && enableMemoryRecall) throw Error("CONTROL_PROFILE_RECALL_WINDOW_UNSUPPORTED");
  if (reviewSubmissionFile !== undefined && !path.isAbsolute(reviewSubmissionFile)) throw Error("CONTROL_PROFILE_SUBMISSION_INVALID");
  const config = controlledCodexConfig({workspace, endpointFile, nodeExecutable});
  config.project_doc_max_bytes = 0;
  if (reviewSubmissionFile !== undefined) {
    // This closed reviewer needs direct evidence and submission, not a second
    // exec output envelope. Cover the existing 256 KiB reply, without enlarging it.
    config["features.code_mode.direct_only_tool_namespaces"] = ["mcp__vydykhai_review"];
    config.tool_output_token_limit = 256 * 1024 + 4096;
  }
  delete config["mcp_servers.vydykhai_control"];
  config["mcp_servers.vydykhai_review"] = {command: nodeExecutable,
    args: [fileURLToPath(new URL("./control-review-mcp.mjs", import.meta.url)), endpointFile,
      ...(reviewAcquisition === undefined && reviewSubmissionFile === undefined ? [] : [JSON.stringify(reviewAcquisition??null)]),
      ...(reviewSubmissionFile === undefined ? [] : [reviewSubmissionFile])],
    required: true, enabled: true, enabled_tools: ["list_sources", "read_source", ...(enableMemoryRecall ? ["recall_memory"] : []),
      ...(reviewSubmissionFile === undefined ? [] : ["submit_review"])],
    ...(reviewSubmissionFile === undefined ? {} : {tools:{submit_review:{approval_mode:"approve"}}}),
    startup_timeout_sec: 10, tool_timeout_sec: 15};
  return config;
}

export function ownerCodexConfig(options) {
  const config = reviewCodexConfig(options);
  const server = config["mcp_servers.vydykhai_review"];
  delete config["mcp_servers.vydykhai_review"];
  config["mcp_servers.vydykhai_owner"] = {...server,
    args: [fileURLToPath(new URL("./control-owner-mcp.mjs", import.meta.url)), options.endpointFile],
    tools: {respond: {approval_mode: "approve"}, record_retention_repair: {approval_mode: "approve"},request_health_repair_review:{approval_mode:"approve"},
      read_notices:{approval_mode:"approve"},acknowledge_notice:{approval_mode:"approve"}},
    enabled_tools: ["inbox", "read_control", "read_verdict", "respond", "record_retention_repair", "request_health_repair_review", "read_notices", "acknowledge_notice"]};
  return config;
}

export function preparationCodexConfig(options) {
  if (typeof options.controlEndpointFile !== "string" || !path.isAbsolute(options.controlEndpointFile))
    throw Error("PREPARATION_CONTROL_ENDPOINT_REQUIRED");
  const config = reviewCodexConfig(options);
  config["mcp_servers.vydykhai_owner"] = {
    command: options.nodeExecutable ?? process.execPath,
    args: [fileURLToPath(new URL("./control-owner-mcp.mjs", import.meta.url)), options.controlEndpointFile,
      "CONTROL_READ_ONLY", ...(options.controlEndpointDigest ? [options.controlEndpointDigest] : [])],
    required: true, enabled: true, enabled_tools: ["read_status"], startup_timeout_sec: 10, tool_timeout_sec: 30};
  return config;
}

export function dispositionCodexConfig(options) {
  const config=ownerCodexConfig(options),server=config["mcp_servers.vydykhai_owner"];
  server.enabled_tools=server.enabled_tools.filter(t=>!["record_retention_repair","request_health_repair_review"].includes(t));
  delete server.tools.record_retention_repair;delete server.tools.request_health_repair_review;
  return config;
}

export function codexConfigArgs(config) {
  const toml = value => Array.isArray(value) ? `[${value.map(toml).join(",")}]` : value && typeof value === "object"
    ? `{${Object.entries(value).map(([k,v]) => `${JSON.stringify(k)}=${toml(v)}`).join(",")}}` : JSON.stringify(value);
  return Object.entries(config).flatMap(([key, value]) => ["-c", `${key}=${toml(value)}`]);
}
