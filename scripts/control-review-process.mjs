// Trusted read-only local reviewer transport. This is not a model provider:
// the launcher chooses a fixed command, never a command from task/model input.
import {realpath} from "node:fs/promises";
import path from "node:path";
import {openControlStore} from "./control-store.mjs";
import {localControlSandbox} from "./local-control-sandbox.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";
import {runControlChild} from "./control-child.mjs";

const hash = value => sha256(canonicalJson(value));
const need = (value, code) => {if (!value) throw Error(code);};
export async function openReviewProcess({directory, workspace, controlRoot, reviewer, command,
  timeoutMs = 30000, maxBytes = 1024 * 1024}) {
  need(typeof reviewer === "string" && reviewer.trim() && Array.isArray(command) && command.length &&
    command.every(v => typeof v === "string") && path.isAbsolute(command[0]) &&
    Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 300000 &&
    Number.isSafeInteger(maxBytes) && maxBytes >= 1024 && maxBytes <= 4 * 1024 * 1024,
  "REVIEW_PROCESS_CONFIG_INVALID");
  const root = await realpath(controlRoot), journalRoot = await realpath(directory);
  need(journalRoot.startsWith(root + path.sep), "REVIEW_JOURNAL_NOT_PROTECTED");
  const sandbox = await localControlSandbox({workspace, controlRoot, readOnly: true});
  const executable = await realpath(command[0]), args = command.slice(1);
  // The offline adapter runs trusted inline policy only, not a worker-writable
  // entrypoint under a reviewer label. The policy must read source as data.
  need(executable === await realpath(process.execPath) && !executable.startsWith(workspace + path.sep) &&
    args.length === 3 && args[0] === "--input-type=module" && args[1] === "-e" && args[2].trim(),
  "REVIEW_PROGRAM_NOT_HOST_OWNED");
  const launch = sandbox({cwd: workspace, executable, args});
  const store = await openControlStore(directory);
  const configKey = hash({workspace, root, reviewer, executable, args, timeoutMs, maxBytes});
  const check = state => need(state?.schema === "control.review-process.v1" && state.configKey === configKey,
    "REVIEW_PROCESS_CONFIG_MISMATCH");
  return {
    async initialize() {await store.initialize({schema: "control.review-process.v1", configKey, runs: {}});},
    async observe(runId) {
      const row = await store.read(); check(row?.state);
      const record = row.state.runs[runId];
      if (!record || record.state !== "STOPPED") return {runId, state: "UNKNOWN"};
      return {...record, evidence: `review-process:${row.digest}:${hash(record)}`};
    },
    async review(offer, {signal} = {}) {
      need(/^[a-f0-9-]{36}$/.test(offer?.runId) && /^[a-f0-9]{64}$/.test(offer?.key), "REVIEW_OFFER_INVALID");
      const body = canonicalJson(offer);
      need(Buffer.byteLength(body) <= maxBytes, "REVIEW_INPUT_CAPACITY");
      await store.transact(state => {
        check(state); need(!Object.hasOwn(state.runs, offer.runId), "REVIEW_PROCESS_ALREADY_DISPATCHED");
        state.runs[offer.runId] = {runId: offer.runId, state: "IN_FLIGHT", inputSha256: sha256(body),
          startedAt: new Date().toISOString()};
        return state;
      });
      const result = await runControlChild({...launch, cwd: workspace,
        env: {PATH: "/usr/local/bin:/usr/bin:/bin", HOME: workspace}, input: body, timeoutMs, maxBytes, signal});
      const {output, code, signal: endedBy, reason, stdoutBytes, stderrBytes} = result;
      const record = {code, signal: endedBy, runId: offer.runId,
        state: result.state === "UNKNOWN" || reason === "TERMINATION_UNKNOWN" ? "UNKNOWN" : "STOPPED",
        finishedAt: new Date().toISOString(), reason, outputSha256: sha256(output), stdoutBytes, stderrBytes};
      if (record.state === "STOPPED" && !reason && code === 0 && !endedBy) {
        try {
          const value = JSON.parse(output);
          need(value && typeof value === "object" && !Array.isArray(value), "REVIEW_OUTPUT_INVALID");
          record.verdict = {...value, reviewer, runId: offer.runId, observedAt: record.finishedAt};
        } catch {record.reason = "INVALID_RESULT";}
      }
      await store.transact(state => {
        check(state);
        need(state.runs[offer.runId]?.state === "IN_FLIGHT", "REVIEW_PROCESS_OBSERVATION_CONFLICT");
        Object.assign(state.runs[offer.runId], record); return state;
      });
      if (!record.verdict) throw Error(record.reason ?? "REVIEW_PROCESS_FAILED");
      return record.verdict;
    }
  };
}
