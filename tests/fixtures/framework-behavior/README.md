# Frozen Control-Decision Comparison

Maintainer-only Stage 3 screening. Nothing here is installed into a project.
This is not a coding benchmark, a native control-loop simulation or proof of
subscription savings. It tests the next proposed decisions under identical
synthetic facts. Stage 2 executable tests and Stage 4 real reuse remain necessary.

## Frozen Inputs

`cases.json` supplies eight independent cases. `rubric.json` is withheld from
participants. `prompt.md` is identical for both arms. `freeze.json` pins their
bytes and every selected instruction file. The baseline is an exact published
Git revision; the candidate is the current reviewed file snapshot, not HEAD.
The old unpublished pre-split candidate was not saved as a separate revision.
Do not reconstruct it from memory or use its word count as this baseline.
If the pinned historical Git object is absent, explicitly fetch the named release
and verify its commit before checking; the generator never fetches or falls back
to HEAD. Check and record inherited host/global instructions identically in both
arms. A participant must not inherit this repository's maintainer AGENTS.

Compare the complete selected instruction bundles, not just the core. Both arms
receive their own core as AGENTS.md and the same selection policy for optional
workflows/skills, read on demand. The maintainer AGENTS, transition plan, change
log, tests, rubric and variant mapping never enter participant workspaces. No
code implementation or host behavior differs between arms in this screening.

The preparation script only reads local Git/files and generates isolated inputs:

```sh
node scripts/prepare-framework-eval.mjs check
node scripts/prepare-framework-eval.mjs stage --output /absolute/new-directory
```

The output directory must not exist and must be outside the repository. Trial
ids are opaque and order alternates baseline/candidate across case pairs. The
private run index and rubric remain outside each trial. This separation is not
an OS sandbox: the eventual runner must expose only that trial directory and
record actual file reads; otherwise blinding/isolation is unproven.

`freeze --baseline <full-commit>` creates the first freeze with exclusive writes;
it refuses to replace an existing freeze. Changes to inputs or instructions
invalidate `check`; preserve the previous freeze/results and explicitly version
the experiment before changing them. No silent repinning or refreshed baseline.

## Budget And Execution

No model calls are authorized by these files. Proposed first comparison: eight
cases, two arms, one fresh attempt each, same actual flagship model at Low and
same host settings. Resolve and record the actual model before approval; changing
model and instructions together would confound the comparison. Counterbalance
order and keep both arms out of prior chat history. No retries, extra judges,
unrequested tasks, model escalation or automatic continuation.

Propose a ceiling of two minutes per attempt, 350 final-answer words, and 16
attempts total. These are requested ceilings, not an implemented provider budget
or a promise about reasoning tokens. Agree actual input/output/tool-round limits
and verify the runner can enforce them before any paid call. On an infrastructure
failure, retain the partial result and do not substitute another run silently.
On a critical safety failure, stop further paid calls and review the pair; mark
unrun cases NOT_RUN rather than zero-cost success. Keep product work running.

## Review And Measurement

First save each raw response, tool transcript, exact model/effort, host version,
attempt id, instruction/case digests, timestamps, finish reason and available
input/cached/output token counts. Include all tool turns, failures and review
cost, not just the final prompt. Missing usage and attributable allowance are
UNKNOWN; do not estimate subscription savings from prices or account-wide deltas.
Record any per-attempt ceiling breach. Do not strip it from the result set.

Review opaque trial ids before opening the variant mapping. For each rubric
check record PASS, FAIL or UNKNOWN, an exact quote from the answer, its supporting
scenario ids and the explanation. Positive decisions and correct abstention both
need evidence. Mere keyword presence is not proof. Claims about actual execution
are invalid in this decision-only protocol. Audit quotes against saved responses;
this generation tool does not score them. A reviewer with prior arm knowledge
must disclose it; do not claim independent blind judging in that case.

Report paired cases, safety failures, unnecessary stops, lost obligations,
unsupported completion claims and unnecessary retrieval/coordination. All checks
must pass for a case to pass. No safety regression can be offset by a lower cost
or a higher average score. A critical failure or incomplete pair keeps the gate
open. With only one attempt per case, no confidence interval or universal
reliability claim is justified. An all-pass tie establishes no behavioral win.

Compare observed whole-attempt time/tokens only among valid comparable pairs and
report failures separately as well. Smaller resident instructions are a static
size result, not measured usage. Passing this screen authorizes neither release
nor a claim that the model actually follows through on its decisions. The next
required proof is an isolated product-owned transition and repeated public-only
reuse, with its own permission and budget.
