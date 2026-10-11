# Runtime Staging And Boundary Repair

Date: 2026-10-06. Candidate only, NO_RELEASE. No live project changed.

## Installed Bytes, Not Installation Claims

`control-runtime.mjs` snapshots an explicit set of runtime modules and existing
managed script dependencies. Inputs are a trusted framework source, expected
content digest, private destination and canonical workspace. Outputs are a
verified content-addressed package and STAGED_NOT_ACTIVATED receipt. LICENSE and
NOTICE are retained. The package is outside the writable workspace. It does not
copy credentials, change project files, initialize/reset journals or create a
service. The digest identifies an approved source snapshot, not a signature or
independent proof that code is trustworthy.

Loading verifies declared files and rejects changed sources, corruption, missing
files, symlinks, undeclared files and an in-project runtime. An existing damaged
version is never reconstructed in place. A new version is staged separately;
interrupted unpublished staging is not an active package. The caller selects the
exact verified package; there is no global mutable current-version pointer.

Actual disposable tests established:

- The staged host opens the existing control journal and retains a human pause
  and unfinished unique product file, without modifying either.
- A second package differing only in a source comment can open the same journal;
  reopening the prior package preserves the exact paused state and IN_FLIGHT
  reservation. This is same-schema rollback, not a migration proof.
- An unsupported future journal schema is refused and retained, not reset or
  interpreted as an empty history.
- The actual native CLI launched from the staged package performs one approved
  registered command. Direct writes, fabricated approval and replay are refused.
  This uses a local scripted provider, not paid inference or semantic judgment.

This module does not switch an active service, prove that old processes stopped,
enroll project health or migrate older schema semantics. Those remain activation
work. Ordinary 1.x install/update is deliberately unchanged: it must not silently
opt users into an incompatible or partly installed controlled mode.

## Independent Counterexamples And Repair

A fresh Sol 6.1 High reviewer found two further defects despite green tests:

1. A legacy full verdict could close a previously failed repair with unchanged
   attempt count. Its assessment returned CONTROL_CONFIRMED. The common retained
   history validator now requires a later PASSED attempt, including the existing
   transition-bound independent retry decision, regardless of wire dialect.
2. An already-open model reviewer retained the original registry while the host
   refreshed it. The host could offer a new key without matching reviewer
   acquisition. Preflight now rereads registry identity and workspace, compares
   the exact offered source snapshot, and refuses changed allocation scope before
   model dispatch. Registry and source bytes are checked again after the run.

Both regression tests were observed failing before the implementation changes.
Additional native tests changed the registry during acquisition and confirmed
rejection. A pre-dispatch refusal is retained as STOPPED/dispatched=false; it does
not masquerade as an unknown executed effect or replenish the allocation.

A different fresh reviewer then returned SCOPED_PASS: 29 targeted tests, no
skips, seven additional failed-closure bypass probes rejected, authorized retry
accepted. The three staging tests were rerun on the final observed packaging
code. Review was read-only, with no live project, nested model or full-suite run.
Model review usage was unavailable and is not recorded as zero.
Final full repository run: **540/540 PASS**, native cases enabled, no skips.

## Limits And Decision

No concurrent hostile host-filesystem mutation resistance is claimed. The trusted
launcher and OS boundary remain necessary; a hash is not authentication. The
model-review allocation identity was tightened to include source workspace;
developmental old allocation journals remain evidence, not implicitly migrated
authorization to launch new work. Their immutable traces and host observations
must be retained. A versioned replacement allocation needs explicit bounds.

Benefit: packaged execution no longer depends on mutable developer source, and
two concrete false-confirmation paths are closed. Added cost is a bounded package
verification and common validation, not another manager or model on each action.
Verdict: keep candidate qualification moving; do not publish 2.0 or claim ordinary
project adoption from these results.
