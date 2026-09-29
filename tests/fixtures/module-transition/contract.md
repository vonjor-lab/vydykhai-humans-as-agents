# Durable Outbox API: Pilot Contract 1

This fixed module inspects raw Markdown and creates canonical receipt/route text.
It never delivers a notification, accepts product work, updates memory or mutates
project state. A recorded lifecycle is evidence in the input, not an executed action.

## Client

Import `callOutbox` from `public/client.mjs` using the path in your task.
Call `await callOutbox(operation, payload)`. The client reads `public/endpoint.json`
and calls the temporary local API. Do not read or modify producer implementation.
No third-party dependencies, network hosts, credentials or private context are needed.

The endpoint may be absent during the explicitly scheduled preparation phase.
Connection failure rejects with `code: ENDPOINT_UNAVAILABLE`; preserve the error,
record the dependency, and never represent it as an empty or valid outbox.
Remote invalid-argument errors reject with `name: TypeError`; input is not repaired.
Successful calls identify the fixed accepted release in the transport envelope;
the client checks that identity and returns only the operation result.

## Operations

- `inspect`, payload `{text: string}`: parses complete raw Markdown, including
  multiple comments joined by a newline. Returns `issues`, `warnings`, `returnCount`,
  `routeCount`, `routedCount`, `pendingReturnIds`, `routedReturnIds`, `returns`, `routes`.
  Each record contains `id`, `fields`, `valid`, and retained compatibility metadata.
- `inspectComment`, payload `{text: string}`: same parse contract, for a single comment.
- `parseStatus`, payload `{value}`: `{valid, status, qualifiers}`; invalid values produce
  `valid:false`, `status:null`, `qualifiers:[]` rather than a successful status.
- `writeReturn`, payload with `status`, `returnReceiptId`, `taskContextArtifact`,
  `memoryCandidates`, `artifactDisposition`, `recommendedNextAction`; optional
  `statusDetail` and `returnLifecycle` (default `WRITTEN`). Returns canonical Markdown.
- `writeRoute`, payload with `returnReceiptId`, `consumer`, `routedNextAction`,
  `evidence`. Returns canonical Markdown with `RECEIVED -> CONSUMED -> ROUTED`.

Canonical statuses: `BLOCKED_BEFORE_START`, `NEEDS_REBRIEF`, `CHECKPOINT_READY`,
`ACCEPT`, `ACCEPT_WITH_FOLLOWUPS`, `NEEDS_FIXES`, `BLOCKED`, `OUTCOME_UNKNOWN`.
Writers reject missing/empty/multiline/placeholder required values with TypeError.
Return lifecycle may be `WRITTEN` or `WRITTEN -> SENT`, never an invented consumption.

## Interpretation And Boundaries

Only a complete, unambiguous matching Return and Route close a receipt. Duplicates,
missing fields, malformed framing or incomplete lifecycle never prove routing.
An older pending receipt remains pending when a newer receipt is routed. Ordinary
prose/headings do not manufacture ids. Legacy qualifiers and aliases may produce
warnings without losing canonical parsed meaning. CRLF inputs remain supported.

`issues.length === 0` describes structural validity, not proof that product work or
notification delivery happened. The consumer owns its presentation, combination
of raw inputs and error propagation. Do not duplicate the codec or add another parser.

Current scope is exact existing legacy behavior plus declared type validation at
the API boundary. Findings outside that scope are reported, not silently fixed.
