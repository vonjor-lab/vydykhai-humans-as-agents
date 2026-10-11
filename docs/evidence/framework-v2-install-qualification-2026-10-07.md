# Disposable Inherited-Project Install Qualification

2026-10-07. **SCOPED_PASS / PAUSED_CUTOVER_VERIFIED / NO_RELEASE**.
Current evidence includes installed CLI activation and a paused same-profile
runtime switch. Live product adoption, hot swap and automatic scheduler restart
are not claimed. No live product was inspected or changed.

## Current Follow-Through

- The installed CLI offers explicit `control-activate` after ordinary kit update.
  Only its small runtime-packaging helper joins the managed product kit. Runtime
  scripts and framework licenses are staged from a separately trusted standalone
  source into private content-addressed storage; product licenses are not used.
- Exact source digest, installed-kit identity/version, private request permissions
  and workspace/state/package separation are checked before activation. Missing,
  altered, symlinked and in-product inputs refuse. A pin checks selected bytes,
  not source authenticity. Candidate packages remain explicitly not a release.
- Actual installed-CLI tests preserve product data/licenses, pause and allocation;
  same activation is idempotent. Changed active digest returns CUTOVER_REQUIRED.
  Source-independent copied observation works. Kit update, private activation,
  scheduling, owner application and project adoption remain separate outcomes.
- `control-cutover.mjs` switches only paused/quiescent, same-profile/schema state
  with stopped scheduling and external-writer exclusion. Actual copied observers
  run before/after selection. Failure and interrupted switch restore or retain an
  owned reconciliation hold without resetting journals, pause or budgets.
- Independent counterexamples exposed an unexcluded registrar, wrong rollback
  destination, false capacity refill, missing observer inventory and revoked
  continuation opt-in. These are regression-tested: supported registration shares
  the lease, restored destination is accurate, capacity cannot grow, activation
  requires observer capabilities and continuation rechecks exact current approval.
- Runtime verification can inspect an intact selected historical inventory without
  requiring today's added files. Activating that inventory separately requires
  the actual observer and selected-profile capabilities; inspection is not adoption.

Distribution tests: **21 PASS / 0 FAIL / 1 non-Darwin skip**. Independent targeted
cutover/continuation/runtime checks: **45 PASS / 0 FAIL / 1 non-Darwin skip**.
Latest full candidate: **823 PASS / 0 FAIL / 3 non-Darwin skips**, native local
provider and explicit disposable SESSION/LOGIN registrations enabled. These tests
spend no inference calls. The two earlier full runs retained a fixture startup
timeout and a registration-versus-final-lease-release race; both test assumptions
were corrected without weakening unknown-effect or lease ownership behavior.
Full candidate runtime: `7de37404c36336731ba34747a75557c30dd0e72ab333699d36285e8f06fd9d9f`.

The historical evidence below is retained, not current gate status. Its missing
paused-switch/installed-route APIs have now been implemented and tested above.
Owner-backed inherited-project diagnosis/repair and actual adoption remain open.

## Earlier Frozen Inputs

- Checkout HEAD: `3ea6ff0179d5d211df434cd6eeea4c68a6375416`; dirty candidate, not a release.
- Historical 1.32.8: `72086069e853e785392d8ec722b03a4b1bacba75`, local Git archive only.
- Candidate manifest: 1.34.1, unchanged by the harness.
- Frozen kit SHA256: `db1699bdf4de5490c3481775111a6639c3883e228122d516665fd3024d405589`.
- Protected runtime digest: `a19ad510c83bbbbedb1eefcc6ae65b688210f50029f57243efc5028390863c16`.

Kit hash covers sorted relative-path/content-hash pairs in the disposable source
snapshot, including explicitly packaged runtime dependencies. Tests print their
actual digests; later candidate changes require a new qualification.

## Earlier Actual Results

- Historical installed updater copied the current frozen managed kit, then a
  successful downgrade restored historical managed hashes/core and removed stale
  managed files. Product LICENSE/NOTICE, binary data, local workflow/skill, memory,
  unfinished task/code, failed-repair count, human pause/question and local AGENTS
  prefix/tail survived byte-for-byte; disposable Git metadata was unchanged.
- A local managed edit refused update before any writes. No blanket overwrite.
- Actual updater child injected EIO **after** copying changed core; another exited
  23 at that same point. Both left new bytes with the old lock; offline doctor
  reported failed integrity. Explicit historical `update --from ... --force`
  restored the kit and preserved product bytes. This narrowly authorized fixture
  recovery is not atomic update, automatic rollback or permission to erase edits.
- Actual staged candidate import threw; reopening the prior readable package
  retained exact host/review journals, acceptance/finding/failed attempt, human
  pause, IN_FLIGHT effect, UNKNOWN review and exhausted allocation. No replay.
  This is same-schema package reopening, not running-service rollback.
- Existing activation rejected a different valid package with
  `CONTROL_ACTIVATION_CONFLICT`; its descriptor/journals remained unchanged and
  the prior paused observer returned zero calls and `NOT_CERTIFIED`.
- Stale digest and in-workspace staging refused without changing product files.
  Current ordinary installation omits 39 protected runtime scripts; explicit
  staging packages them separately, not silently through the 1.x updater.
- Doctor passed installed-kit integrity while adoption stayed
  `UNPROVEN_BY_INSTALLER`; missing navigation checks produced
  `ASSIGN_MAINTENANCE`, not completed repair, NO_CHANGE or project readiness.

## Earlier Verification And Limits

`node --test tests/control-install-qualification.test.mjs`: 7 PASS / 0 FAIL /
1 platform skip. Final focused regression command:

```sh
env -u VYDYKHAI_CODEX_BINARY node --test tests/control-install-qualification.test.mjs tests/control-runtime.test.mjs tests/control-activation.test.mjs tests/control-migration.test.mjs tests/update-continuation.test.mjs
```

58 PASS / 0 FAIL / 3 skips (two non-Darwin checks; one optional native provider).
Existing migration coverage verifies paused journal-only migration, old-reader
refusal and compatibility-held rollback; it does not establish service cutover.
New fixtures use unique temporary repos/private roots, empty model homes and an
unlaunchable model binary; no native paid models or real auth/secrets are used.
The new repo has an unborn branch, not an accepted product HEAD; the existing
continuation regression separately preserves its synthetic committed HEAD.

**Concrete missing case:** run disposable service A, switch to candidate B, fail B
after old-writer shutdown but before readiness, then observe running A restored
with its descriptor and all retained state. No existing API can perform this case.

**Minimal missing change:** an explicit supported-host replacement entry point
that excludes/stops old writers with observed proof, binds compatible retained
journals, durably switches the pinned descriptor/service, verifies the new process
and retains/reconciles the prior route on failure without resetting unknown effects,
pause or budgets. Test interruption at that boundary. Then obtain owner-backed
inherited-project diagnosis/repair or NO_CHANGE and active adoption readback.
Neither manual package selection nor green doctor can satisfy that release gate.
