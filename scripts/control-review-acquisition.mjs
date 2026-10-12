import {canonicalJson, sha256} from "./memory-brief.mjs";

const need = (value, code) => {if (!value) throw Error(code);};
const hash = value => sha256(canonicalJson(value));
export function validateReviewAcquisition(policy) {
  need(policy && Object.keys(policy).sort().join() === "maxBytes,maxChars" &&
    Number.isSafeInteger(policy.maxBytes) && policy.maxBytes >= 1024 && policy.maxBytes <= 2 * 1024 * 1024 &&
    Number.isSafeInteger(policy.maxChars) && policy.maxChars >= 1 && policy.maxChars <= 16384,
  "MODEL_REVIEW_ACQUISITION_POLICY_INVALID");
  return policy;
}
export function validateWindowArguments(args, policy) {
  validateReviewAcquisition(policy);
  need(args && typeof args.id === "string" &&
    Object.keys(args).every(key => ["id", "offset", "length"].includes(key)) &&
    (args.offset === undefined || Number.isSafeInteger(args.offset) && args.offset >= 0) &&
    (args.length === undefined || Number.isSafeInteger(args.length) && args.length >= 1 && args.length <= policy.maxChars),
  "MODEL_REVIEW_WINDOW_ARGUMENTS_INVALID");
}
// Offsets count Unicode code points, never partial UTF-8 bytes or surrogates.
export function sourceWindow(source, args, policy, usedBytes = 0) {
  validateWindowArguments(args, policy);
  need(source?.id === args.id && Number.isSafeInteger(usedBytes) && usedBytes >= 0 && usedBytes <= policy.maxBytes,
    "MODEL_REVIEW_WINDOW_CONTEXT_INVALID");
  if (source.status === "MISSING") return source;
  need(source.status === "AVAILABLE" && typeof source.text === "string" && sha256(source.text) === source.sha256,
    "MODEL_REVIEW_WINDOW_SOURCE_INVALID");
  const characters = Array.from(source.text), offset = args.offset ?? 0;
  need(offset <= characters.length, "MODEL_REVIEW_WINDOW_OFFSET_INVALID");
  const text = characters.slice(offset, offset + (args.length ?? policy.maxChars)).join("");
  const bytes = Buffer.byteLength(text), length = Array.from(text).length;
  if (usedBytes + bytes > policy.maxBytes) return {
    schema: "control.review-read-limit.v1", id: source.id, status: "NEEDS_DISCOVERY",
    reason: "READ_BUDGET_EXHAUSTED", sourceSha256: source.sha256,
    beforeBytes: usedBytes, requestedBytes: bytes, maxBytes: policy.maxBytes
  };
  const window = {sourceId: source.id, sourceSha256: source.sha256, offset, length,
    characters: characters.length, beforeBytes: usedBytes, afterBytes: usedBytes + bytes};
  const id = offset === 0 && length === characters.length ? source.id :
    `window_${hash({sourceId: source.id, sourceSha256: source.sha256, offset, length}).slice(0, 32)}`;
  return {...source, id, sha256: sha256(text), text, window};
}
export function openWindowReader(sources, policy) {
  validateReviewAcquisition(policy);
  let usedBytes = 0;
  return {async read(args) {
    validateWindowArguments(args, policy);
    const original = await sources.read({id: args.id});
    const result = sourceWindow(original, args, policy, usedBytes);
    if (result.window) usedBytes = result.window.afterBytes;
    return result;
  }};
}
export function completeWindowSources(readbacks, originals) {
  const completed = [];
  for (const [id, source] of originals) {
    if (source.status !== "AVAILABLE" || readbacks.some(r => r.id === id && !r.window)) continue;
    const windows = readbacks.filter(r => r.window?.sourceId === id).map(r => r.window).sort((a, b) => a.offset - b.offset);
    let covered = 0;
    for (const window of windows) {
      if (window.offset > covered) break;
      covered = Math.max(covered, window.offset + window.length);
    }
    if (windows.length && covered === Array.from(source.text).length && !readbacks.some(r => r.id === id))
      completed.push(source);
  }
  return completed;
}
export function validateWindowAcquisition(before, calls, originals, policy) {
  validateReviewAcquisition(policy);
  let usedBytes = 0;
  const ordered = [...calls].sort((a, b) =>
    (a.value.window?.beforeBytes ?? a.value.beforeBytes ?? 0) -
    (b.value.window?.beforeBytes ?? b.value.beforeBytes ?? 0));
  for (const {args, value} of ordered) {
    const source = originals.get(args.id);
    need(source && before.rows.some(row => {const {text, ...identity} = source; return hash(row) === hash(identity);}),
      "MODEL_REVIEW_SOURCE_DRIFT");
    const expected = sourceWindow(source, args, policy, usedBytes);
    need(hash(expected) === hash(value), "MODEL_REVIEW_WINDOW_READBACK_INVALID");
    if (expected.window) usedBytes = expected.window.afterBytes;
  }
  return {usedBytes, limitReached: calls.some(call => call.value.status === "NEEDS_DISCOVERY")};
}
