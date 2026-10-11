# Framework 2.0 Lifecycle Qualification

Date: 2026-10-06. Status: BOUNDED_QUALIFICATION_COMPLETE / NO_RELEASE. Published manifest remains
1.34.1. This is isolated qualification, not installation or project healing.
The latest human instruction authorized continued bounded model use; earlier
consumed grants were not reused. Every phase has a separately frozen input and
one-attempt receipt. Private project evidence stays outside this repository.

## Actual Process Boundaries

`tests/context-lifecycle.test.mjs` uses a disposable Node protocol host and the
existing context-hook, context-run, Return and checkpoint APIs. It demonstrates:

- An actual public action produces a result; SIGKILL after persistent observation
  but before PostToolUse leaves a pending admission. A new process/call id cannot
  replay it. Exact delayed observation reconciles idempotently without rerunning.
- A different dispatched action cannot reuse the admitted command. A stale
  observation cannot be attached to another invocation.
- SIGKILL after admission before action, and after action before observation,
  both leave UNKNOWN. Missing observation cannot be invented by reconciliation;
  neither case repeats the action. These are distinct real interruption points.
- Independent candidate verification may still succeed, but expressly declares
  product acceptance NOT_ESTABLISHED and replay protection CALLER_OWNED. It is
  not a recovered result. Pending admission remains blocked after verification.
- Actual Return bytes are retained and registered as a source. The next task is
  blocked while that source is unclassified; a fresh preparation consumes it,
  retains earlier sources and runs a different input through the same host route.
- A separate timed process observes overdue State/outbox evidence with no active
  manager callback. Actual WAITING suppresses the notice.

This is NOT native Codex universal admission, authenticated actor isolation,
production observation or semantic model application. Hook configuration and
metadata are trusted fixture inputs. The admission covers its exact managed
command, not every possible command/tool. File fsync plus rename before process
kill is not a power-loss guarantee. Interruption inside an action with external
subeffects remains unqualified. The test's source classifications are synthetic;
they demonstrate enforcement of declared coverage, not correct interpretation.

## Falsification And Repairs

A fresh independent High review found two concrete issues and proof limitations:

1. Debt product outcomes lacked matching scope and current-window time. A foreign
   or historical outcome could disguise a maintenance-only window. The prototype
   now requires matching scope and `before.at < outcome.at <= after.at`.
2. The disposable host dispatched its configured action without binding it to the
   admitted command. The host now compares the actual action, event command and
   fixed hook command before any execution or reconciliation.

Both counterexamples failed before repair and passed afterward. A second narrow
independent review confirmed those ordinary fixes but found sparse-array input
could still count a nonexistent outcome. Dense validation now rejects holes,
undefined and null entries in debt snapshots/outcomes and recovery records.
Those additional repairs passed deterministic regressions; there has been no
independent final acceptance of the sparse-array repair. Do not relabel the second
review's FAIL as PASS. Selected lifecycle gaps were also closed by the real
interruption, Return-consumption and same-host next-task tests above.

## Private Snapshot And Semantic Test

A separately scoped read-only capture included 183 tracked text files and excluded
53 protected/generated/non-text/oversize or otherwise unsupported files. HEAD and
included-file hashes were stable across readback. Untracked material, external
memory, tracker state and complete history were not initially included. Credential
screening was heuristic, not a security certification. No project source executed.

Independent snapshot review said INSUFFICIENT for a positive project-health oracle.
Separate project-side bounded acquisition supplied historical summaries and
revision evidence privately, but did not authenticate primary authority or prove
current executable equivalence. The resulting oracle was frozen as LIMITED:
test correct handling of available corrections and UNKNOWN, not runtime readiness.
The preparation model could not read the oracle or grading files. The maintainer
received only sanitized reports, not the private packet or task history.

Initial preparation did not declare false readiness. The first judge nevertheless
reported FAIL, 2/6 criteria. Independent counter-review PARTIALLY_REFUTED that grade:
one alleged failure demanded unavailable baseline correspondence; another demanded
specific wording already covered in meaning. Two supported issues remained:
incomplete correction tracing (overlapping authority/prerequisite findings) and
incorrect attribution to a nearby instruction source. Do not present the raw 2/6
as a validated quality score or silently rewrite the frozen oracle.

The qualification policy now asks for a concise, source-backed chain for decisions
that change actions or prerequisites, distinguishing primary authority, reported
authority and inference. It does not demand reading all history. Reviewer guidance
rejects unavailable-fact and keyword-only failures. A single revised preparation
and fresh adjudication-aware grading use the same frozen sources/oracle. This is
a regression after seeing defects, not held-out evidence or a causal experiment.
Revised semantic result: PASS_WITH_LIMITATIONS, 6/6 under the adjudicated meaning
of the unchanged oracle, zero unsupported claims and no false readiness. The
grader verified reported correction tracing and retained unknown correspondence.
Do not compare raw 2/6 to 6/6 as an effect size: two original failures were invalid,
the new packet is a regression, and model variation is uncontrolled.

A no-additional-preparation-policy control completed. Same model/effort,
prompt, task and 190-file frozen input inventory; only root AGENTS.md differs.
The control retains read-only safety/task instructions. Fresh grading gets the
same oracle and grading adjudication, not the policy label. This is an exploratory
single pair, not published-1.34.1 versus 2.0 or a preregistered effect estimate.
Its fresh grade was PARTIALLY_MET, 4/6, no false readiness or unsupported claims.
The judge reported incomplete authority tracing and insufficient precision in
baseline preservation. It accepted the later prerequisite correction without our
added policy. These are single-judge scores, not demonstrated error frequencies;
the earlier grading dispute is a reason to preserve that limitation.

The revised candidate plus its grade used 216,879 input (156,928 cached), 4,396
output and 154.154 seconds. Control plus grade used 162,336 input (115,456 cached),
3,712 output and 134.702 seconds. Candidate input was 33.6% higher, time 14.4%
higher. This suggests a coverage/overhead tradeoff in this case, not proven savings
or a causal policy effect. Do not make a costly extra judge mandatory on every
unchanged task. Reuse current evidence; test trigger precision and retained benefit
in later held-out whole-cycle work before promoting the behavior.

## Cost And Evidence Limits

Native CLI receipts for all ten completed phases; cached input is a subset of input,
not an extra amount. Reasoning is contained in output. These are not dollar prices
or exact subscription allowance measurements.

| Phase | Model / effort | Seconds | Input | Cached subset | Output |
| --- | --- | ---: | ---: | ---: | ---: |
| Prototype falsification | Sol 6.1 High | 194.353 | 234002 | 186496 | 5416 |
| Snapshot coverage | Sol 6.1 Low | 91.411 | 241165 | 198272 | 3015 |
| Narrow repair review | Sol 6.1 High | 76.205 | 109212 | 88320 | 2139 |
| Initial private preparation | Sol 6.1 Low | 73.200 | 94430 | 64896 | 2502 |
| Initial private grade | Sol 6.1 High | 90.947 | 160869 | 133376 | 2297 |
| Grade counter-review | Sol 6.1 High | 75.750 | 108112 | 64000 | 2101 |
| Revised private preparation | Sol 6.1 Low | 89.121 | 78257 | 51968 | 2760 |
| Revised private grade | Sol 6.1 High | 65.033 | 138622 | 104960 | 1636 |
| No-additional-policy preparation | Sol 6.1 Low | 54.247 | 66960 | 48384 | 1780 |
| Unlabelled control grade | Sol 6.1 High | 80.455 | 95376 | 67072 | 1932 |

Measured ten-call subtotal: 1,327,005 input including 1,007,744 cached; 25,578 output;
890.722 seconds summed model wall time. No timeouts or retries of an identical
frozen phase. The revised case is an explicit post-repair regression, not a hidden
retry or independent new task. The additional-policy control was scoped before
its execution, after the regression; it was not part of the original frozen pilot.

Two bounded project-side acquisition turns, maintainer effort and local test cost
are not included in this table. Their per-turn usage was not collected; this is
not a whole-chain total. No baseline comparison or economy claim is justified.
Every completed CLI phase above returned within its cap and retained unchanged
frozen sources. Individual raw receipts and source manifests remain private.

## Promotion Decision

Local repository suite: 447/447 passed after process-boundary tests; 43/43 focused
tests passed after the policy refinement. Validator at 1.34.1 and diff check passed.
Recovery/debt assessors are still experimental, read-only
and not wired into installed admission/scheduling. No new actor, live timer,
project mutation, framework version bump, merge or release occurred.

Benefit: falsifiable admission/retention and historical recall rather than trust
in a green checklist. Evidence: real isolated process boundaries and bounded model
counterexamples, not full lifecycle reliability. Complexity: existing routes plus
one disposable host; policy refinements replace vague recall instructions. Verdict:
DEFER RELEASE. Remaining combined host/adoption, source-hidden consumer, real
authority, held-out semantic and matched-cost gates remain open.

The immediate unresolved boundary is implementation/qualification of one supported
host's actual combined admission and recovery path, not another prompt rewrite or
repetition of this same model case. Project-positive proof additionally needs an
authoritative retained executable baseline or an explicitly separate test baseline;
the frozen historical reports cannot supply that by assertion. Do not silently
turn those reports into permission to repair or certify a working project.
