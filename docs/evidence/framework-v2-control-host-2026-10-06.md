# Durable Control Host Qualification

Date: 2026-10-06. Scope: disposable local fixtures and frozen framework sources.
Status: PARTIAL_HOST_IMPLEMENTATION / NO_RELEASE. No product changes or deployment.

## Implemented And Observed

The candidate adds durable control state, a host-owned acceptance/review queue,
exact command reservation and a macOS process sandbox. The tests exercise actual
Node commands, retention files, independent host instances and process interruption.

- Acceptance survives reload with pending independent review enrollment.
- Manager-supplied continuation claims cannot establish control closure.
- Actual continuation is retained before final closure; later byte drift becomes
  due again without forgetting the accepted artifact.
- Two separate processes compete for one admission: exactly one reserves it.
  Killing that winner with SIGKILL retains IN_FLIGHT and prohibits replay.
- A changed command for the same task cannot bypass the unresolved attempt.
- A late result cannot certify a subsequently changed owner disposition.
- A timer-driven bounded tick processes review without a manager turn; unchanged
  ticks do not launch another review. Pause and zero budget launch none.
- A timed-out review survives reload as reconciliation work, not a retry.
  Trusted stopped-process observation plus an explicit decision permits a new
  attempt; a valid retained verdict is reused without a new model call.
- Native macOS execution denies control-file reads/writes through direct paths
  and symlink aliases, denies creation of a hard-link alias to control data,
  and denies a TCP connection. Scoped work still executes.
- Abandoned unpublished temporary files do not become revisions; a history gap
  is rejected. This is not a comprehensive hostile-process security assessment.

The reviewer callback and semantic row assertions in these fixtures are controlled
test inputs. The timer is a test driver, not an installed production scheduler.
The process observer in reconciliation tests is a trusted projection, not proof
of a deployed process-supervision implementation.

## Independent Counterexamples

One fresh Sol 6.1 High read-only review of frozen host sources completed in
114.121 seconds. Usage: 113,662 input tokens, including 82,816 cached input tokens;
2,656 output tokens. These are not subscription-allowance measurements.

The reviewer found three concrete lifecycle defects:

1. Restoring old bytes allowed closing an acceptance with an active drift-review
   lease, hiding that pending review.
2. Due nonblocking debt was emitted by the queue but could not be dispatched or
   claimed through the existing path.
3. An unrelated acceptance or command approval invalidated a whole-host review
   snapshot and stranded the reviewer in reconciliation.

All three were independently reproduced as failing native tests before repair,
then passed after repair. The fix also blocks dependent command admission while
a review is pending.

A second fresh Sol 6.1 High review confirmed those three repairs but returned FAIL
with two new counterexamples. It completed in 104.207 seconds: 67,325 input tokens,
including 46,208 cached input tokens, and 2,431 output tokens.

4. Reapplying an old owner disposition could overwrite a newly queued retry.
5. An obsolete retained verdict could prevent a separately authorized fresh
   review, because reconciliation always attempted to reuse it first.

Both were reproduced as failing native tests, then repaired and passed. Pending
review enrollment now survives disposition and effect-observation writers.
Reconciliation reuses only a currently valid verdict; otherwise an explicit
decision preserves the old verdict and run in retry history. A new fixture also
passes missing-memory -> owned repair -> independent readback -> actual continuation
without repeating accepted product work or erasing the original finding.

A third narrow independent review completed with SCOPED_PASS on the two repaired
findings and their direct consequences. It took 67.179 seconds and used 87,098
input tokens (48,768 cached) and 1,396 output tokens. The reviewer identified a
missing dedicated regression for late effect observation during pending review;
that branch now has its own passing test with unchanged owner disposition.
The earlier FAIL reports remain historical evidence, not relabeled PASS.
Combined usage for these three reviews: 268,085 input (177,792 cached), 6,483 output,
285.507 seconds. This is qualification cost, not measured savings.

## Native Route Follow-Through

Actual native CLI qualification now uses the candidate worker launcher, its strict
isolated configuration, required stdio MCP endpoint and actual macOS sandbox. A
local fake Responses provider supplies deliberately adversarial tool calls; it
uses no inference or credentials and establishes transport behavior, not judgment.

- Without independent command admission, no action runs.
- With admission, the exact registered command runs once; a repeat is blocked.
- A worker-provided reviewer field and a forged approval method are refused.
- Native direct shell execution is unavailable; native file-patch attempts in
  both workspace and control storage are denied by actual permissions.
- A missing required MCP aborts before the first provider request.

The fixed-command read-only reviewer transport separately proves actual subprocess
termination and retained verdict readback across controller recreation. It denies
workspace/control writes, binds identity outside the child, rejects duplicate
dispatch and refuses apparent JSON verdicts from failed/cancelled processes.
Timeout retains the stopped attempt without an automatic retry. The owner applies
the exact persisted verdict, then an actual approved command completes and closes
the acceptance. PASS rows in that test are protocol fixtures, not semantic proof.

After these additions: **509/509 tests PASS, zero skips**, including the optional
native CLI cases explicitly enabled on this macOS host. The unchanged 1.34.1
validator and diff checks passed.

The independent native-boundary review reached its 120.014-second wall limit
without a final verdict or usage receipt. Its partial output questioned waiting
for `close` without a second deadline after killing a process group. An isolated
reproduction of the old waiting pattern took 2055 ms despite a 500 ms deadline
because a detached helper retained inherited pipes. This is a real supervisor
counterexample, not proof that the tested read-only review sandbox permitted that
helper: the sandbox helper test already refused it before the explicit fork ban.

The shared `control-child.mjs` now bounds that wait and records UNKNOWN if closure
is not observed. The reviewer sandbox also explicitly denies process-fork and its
adapter rejects workspace entrypoints in favor of a trusted inline Node policy.
Source-as-data discipline remains a requirement of that trusted policy, not a
claim of JavaScript information-flow enforcement. Worker status says CLI_EXIT,
not that all business effects are complete. Unresolved host reservations remain.
Four additional regressions cover detached inherited pipes, successful/failed/
cancelled/output-limited processes, helper refusal and unsafe review entrypoints.
The final suite passes **513/513**, with native tests enabled and no skips.

A fresh narrow Sol 6.1 High review of the shutdown repair completed in 58.721
seconds with PASS_BOUNDED_STATIC_REVIEW and no findings. Usage: 42,980 input
(28,672 cached), 1,133 output. It did not re-qualify the whole native endpoint or
the unfinished model/adoption cycle. The timed-out broad review is not a PASS and
its missing usage must not be counted as zero. No release or product mutation.

## Release Boundary

Earlier repository verification after the repairs: **499/499 tests PASS**, no skips or
failures; `node scripts/validate-framework.mjs` PASS at unchanged 1.34.1;
`git diff --check` PASS. Twenty new host tests supplement the preceding 479.

See [host contract and remaining gates](../design/local-control-host.md).
The supported native worker route is executable but not installed into the
framework manifest or any project. Independent model transport, scheduler/owner
delivery, combined semantic behavior and adoption/rollback remain unproved.
No universal independence, complete memory health, measured economy, whole-platform
readiness or release is claimed.
