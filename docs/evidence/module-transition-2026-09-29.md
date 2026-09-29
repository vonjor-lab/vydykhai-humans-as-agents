# Executable Module Transition: Bounded Result

Date: 2026-09-29. Four authorized Sol Low attempts used. Functional reuse proved;
native completion and cost measurement limited. No retries, additional judges,
product operations, installed-rule changes, merge or public release occurred.

## Result

The worker extracted five durable-outbox codec exports from the framework CLI
into a standalone module with no imports or IO. Independent maintainer verification
passed 16 raw cases through both parser operations against the frozen baseline,
nine status cases, four writer cases and four rejections.

Initial packaging needed one correction: a documentation link pointed to a
nonexistent relative location. The user explicitly authorized correcting that link
without changing code. The original contract, result and NEEDS_FIXES verdict were
retained. This is not clean first-pass packaging or hidden algorithmic assistance.

Both independent consumers connected through the public SDK/API. Each passed 16
independent raw cases under a native command sandbox that also demonstrated a
denied producer-source read. Consumer A observed a real unavailable endpoint,
saved WAITING with a next action, then resumed in a fresh context without changing
its implementation. Consumer B combined raw comments before one inspect call.
Neither consumer read, copied or repaired the producer algorithm.

| Attempt | Outcome | Elapsed | Input | Cached input | Output |
| --- | --- | ---: | ---: | ---: | ---: |
| Producer extraction | Functional PASS; approved documentation correction | 141.906 s | 275,834 | 246,016 | 5,091 |
| Consumer A preparation | PASS; truthful WAITING checkpoint | 51.951 s | 77,229 | 68,352 | 1,806 |
| Consumer A continuation | Functional PASS; native turn interrupted | 90.008 s | UNKNOWN | UNKNOWN | UNKNOWN |
| Independent consumer B | Functional PASS; final response retained, normal process exit absent | 90.009 s | 132,663 | 102,400 | 2,025 |

Known usage from three attempts only: 485,726 input, including 416,768 cached,
plus 8,922 output, or 494,648 combined tokens. Uncached input is 68,958. Missing
continuation usage is not zero; the full token total is UNKNOWN. Reasoning subsets
are already included in output. All four attempts used 58 shell commands and
373.874 seconds of summed elapsed time. Collection ran from 13:28:50 to 13:57:47
UTC, including diagnosis, review and separate approval; initial preparation and
subsequent reporting add unmeasured cost. Do not describe this as a six-minute
whole experiment. Native charge units, money, attributable subscription allowance
and maintainer token usage remain UNKNOWN.

The continuation saved tested code, verification and a durable Return before
the 90-second cutoff, but no final answer or usage event was captured. Consumer B
has a final answer and turn-completed usage in its raw stream; the process still
hit the wall timeout and did not finish its last-message file. Both results were
retained and independently checked without paid retries. This is not evidence of
uniformly clean native completion or autonomous manager recovery.

## Budget Correction

The original authorization was 120,000 combined input/output tokens per invocation,
checked between responses with final-response overshoot. I configured the native
rollout budget as though it enforced that metric. It does not. This was a
maintainer configuration/interpretation error, not a demonstrated framework or
Codex defect.

The [upstream implementation](https://github.com/openai/codex/blob/main/codex-rs/core/src/rollout_budget.rs)
uses provider-defined rollout units when present; otherwise it weights noncached
input and output. A free local mock verified the mismatch in the installed CLI:
after a response reported 130,000 input (100,000 cached) and 10 output, the 120,000
native threshold still allowed another response. Final mock totals were 260,000
input, 200,000 cached and 20 output. The probe used zero paid model calls.

The first paid receipt exposes aggregate usage, not per-response budget units.
Its 280,925 combined tokens cannot certify that the excess came only from the
final response. Remaining invocations were blocked locally without spawning a
model. The user then explicitly approved the three remaining runs at 90 seconds
each, without a gross-token ceiling, and the one documentation-link correction.
Both approvals and configurations are retained. No alternate metric was silently
substituted, and no attempts remain under either approval.

This corrects the earlier decision comparison's budget-enforcement claim.
Its actual usage and 24/24 scores per arm are unchanged; historical
`protocolValid` fields did not test cached-token threshold behavior. Aggregate
overages are not proven final-response-only. Those paid cases are not repeated.

## Preparation And Continuation Lessons

The producer task referred to a supplied map when only source/export names were
supplied. This caused avoidable searches. The command PATH omitted the actual Node
directory; the worker recovered to its absolute path. The isolated copy was not
identified as nongit. These are defects in this maintainer experiment, not evidence
that more permanent framework roles are needed. The staging utility now clarifies
map ownership/nongit status and labels budget metric/enforcement. Original staged
inputs are unchanged; the revised packet is not model-tested. Runtime PATH was
fixed and verified with a free native mock before the three continued attempts.

A free native command/API probe confirmed own-work writes, denied producer reads,
denied public-contract writes and a successful public SDK call. The independent
verifier also denied actual producer-code reads. These checks cover selected
command paths on this isolated host, not every tool or the product harness.
The Unix socket is test infrastructure, not a new required service architecture.

The first independent consumer verifier failed before executing tests because the
CLI misparsed dotted configuration-path overrides. A complete filesystem table
fixed the verifier. The first failure remains recorded; no model output or frozen
acceptance changed and no paid attempt was repeated.

Consumer A's continuation read general acceptance/Return instructions and ran its
saved verifier three times after implementation was already passing and unchanged.
That is observed overhead, not proof that the workflow caused the timeout; there
was no matched execution baseline. Consumer B initially expected `clear` for an
older pending receipt, checked the public API, then corrected its test to the
specified `needs-review` result. The independent checks passed unchanged.

The producer map has an implicit worker-root base. Consumer A's map mixes
code-relative and task-relative references without stating their bases. Its
boundary and actual SDK import are clear, but machine navigation portability is
not proved. This observation was not turned into a new scoring rule or silently
repaired after evaluation.

## Evidence And Next Gate

[Machine-readable evidence](module-transition-2026-09-29.json) records metrics,
hashes, amendments and missing observations. The external
`module-transition-20260929` archive retains original inputs, output snapshots,
CLI transcripts, approvals, runner revisions, independent checks and free probes.
Only the approved documentation correction changed the producer package hash;
its algorithm digest matches the fixed package used for every consumer call.

All 320 repository tests passed. Framework validation, original frozen-input
checks and whitespace checks passed separately. These are deterministic results,
not additional model runs or proof of subscription savings.

The bounded transition/reuse experiment is finished with the limitations above.
Do not restart extraction or spend more under exhausted approvals. Retain the
working module and consumers. Stage 5 still needs the agreed adoption/continuation
proof on an authorized host and review of whole-chain costs, documentation
navigation and result retention. A timeout with a verified durable result calls
for reconciliation, not reimplementation. This pilot does not prove complex
algorithm autonomy or authorize product installation.

Benefit/evidence/complexity/verdict: closed-module reuse and retained-code
continuation worked with one transparent documentation correction. Native finish
and usage gaps, plus unmeasured overhead, prevent a whole-loop efficiency claim.
Keep the candidate and evidence; leave publication/adoption gated. No installed
role, scheduler, Guard repair or new universal runtime rule is justified here.
