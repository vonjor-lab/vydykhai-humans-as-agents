# Installed Update And Continuation Rehearsal

Date: 2026-09-29. PASS for the deterministic installed-CLI route. No model calls,
private project access, live orchestrator operations, version bump, merge or
publication. This is an executable migration regression, not autonomous adoption.

## Scope And Result

The regression starts from published 1.32.8 commit
`72086069e853e785392d8ec722b03a4b1bacba75`, installed into a temporary synthetic
project. It prepares an approved task with the old CLI, retains an uncommitted
implementation and human checkpoints, then uses that old installed updater to
install the frozen candidate from the maintainer checkout.

| Check | Observed result |
| --- | --- |
| Ordinary update | New bundle/adoption identity despite the unchanged development version label; installation still reports active use unproven. Installed doctor resolves the intended profiles. |
| Existing work | Same branch, HEAD, task, dirty implementation, human pause and unanswered integration question retained. |
| Missing preparation | Both whole-project mapping and module assessment remain due; independent authorized work is not globally stopped. |
| Safe checkpoint and ownership | WAIT_OWNER becomes REUSE_OWNER, then REVIEW_MAINTENANCE_RETURN. Reinstall preserves plan identity and defect history. Removing the owner after an unchanged failed repair yields WAIT_CHECKPOINT, not a fresh repair allowance. |
| Preparation completion | Five actual fixture documents and complete declared project coverage are insufficient alone: REVIEW_ROUTE_PROOF remains required. |
| Existing task migration | The v1 task remains explicitly LEGACY_UNCHECKED. One approved v2 supplement retains its worker/code, retires the prior action route and requires fresh worker delivery/readback. |
| Execution and acceptance | Exactly one local action. Retained B1/B2 and new N1 pass through the installed verifier. Receipt reports DECLARED_BOUNDARIES, not product acceptance. |
| Interrupted final notification | Reconciliation uses preflight and verification, not a second action. One producer Return is stored and routed to the pending human integration decision. |
| Future context | Another delivery retains the deferred CSV obligation. Declared route-proof references resolve to files, and the classifier reuses accepted preparation. |

The focused rehearsal passed in 2.434 seconds including test-runner overhead.
That is deterministic test time, not predicted human/project migration time.
The full suite passed 321/321 tests with zero failures or skips in 17.147 seconds.
Framework validation, whitespace checks and the frozen decision-screen input
check passed; the instruction candidate was not changed to obtain this result.

Reproduce with:

```sh
node --test tests/update-continuation.test.mjs
node --test tests/*.test.mjs
node scripts/validate-framework.mjs
node scripts/prepare-framework-eval.mjs check
git diff --check
```

The historical test skips explicitly if the local baseline Git object is absent;
it never fetches silently. The baseline was available and the focused rehearsal
did not skip on the recorded run.

## Evidence Limits

The fixture supplies owner decisions, source classifications, maintenance
documents, semantic review and the final adoption snapshot. It does not prove
that a live model will initiate those steps without prompting, that a real
project inventory is complete, or that the reference runner enforces all native
tool access. Return routing is local; there is no external notification or host
activation. Retaining and redelivering fixture obligations is not a production
memory rebuild or independently judged semantic recall test.

This closes the missing joined regression between ordinary update and existing
task continuation. It does not silently replace the project's own activation
readback or the remaining live-adoption acceptance gate.

## Whole-Chain Review

- Benefit: the compact operating contract and public module boundaries can
  reduce repeated exploration; this rehearsal preserves useful work through an
  update rather than restarting it.
- Evidence: the earlier fixed decision comparison retained 24/24 checks in both
  arms with candidate input down 27.6%, uncached input down 17.5% and summed run
  time down 11.1%. It was a quality tie, not demonstrated reliability improvement.
- Reuse: the executable pilot packaged an existing algorithm and connected two
  consumers without producer source, with one authorized documentation repair.
  Two native cutoffs and missing usage for one attempt remain unresolved
  measurement limits, not reasons to repeat completed work.
- Cost: setup, review, documentation and coordination are real transition costs.
  Their full token/allowance cost was not measured. The module pilot has no
  matched old-path cost; savings, payback and attributable subscription allowance
  remain UNKNOWN. This offline rehearsal adds zero inference invocations, not
  zero maintainer cost.
- Complexity: one maintainer regression; no installed workflow, service,
  persistent role, timer, progress store or additional repair loop was added.
- Verdict: retain the frozen candidate for release review. Do not repeat the
  completed paid screens or rebuild Guard/memory to improve the report. Publish
  only with an explicit release decision and an honest adoption scope; actual
  project activation remains with its owner. Stage 5 is not marked universally
  complete by fixture acceptance.
