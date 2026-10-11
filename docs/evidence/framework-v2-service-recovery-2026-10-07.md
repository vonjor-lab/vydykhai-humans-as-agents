# Service Recovery And Delivery Qualification

Status: bounded candidate verification, NO_RELEASE. Manifest remains 1.34.1.
No product inspection, installation, data mutation, merge or release was performed.

## Implemented And Executed

- `control-recovery.mjs` releases a stopped observer only after trusted supervisor
  close evidence, absent original process, exact lease/journal readback and no
  unknown review or command effect. It appends recovery evidence before releasing
  exclusivity. A real disposable child exited with its lease held; recovery
  preserved pause, budget and both journals byte-for-byte. Unknown outcomes and
  a live supervisor are refused. An interrupted recovery marker is not stolen.
- Reset-aware health uses an explicit trusted allowance observation. Missing or
  stale observations produce an owned follow-up, not an invented recurring reset.
  Safety triggers do not wait for periodic scheduling. Completed reset epochs,
  pending obligations, pause and repair history survive reopening. No call budget
  is replenished. The allowance metadata adapter itself is not installed.
- A bounded CAS notification outbox records pending notices, exact-token owner
  readback and separately observed actual owner dispositions. Receipt creation is
  not delivery; an acknowledgment is not application. Changed observations can
  supersede old notices without erasing their bodies/history or claiming closure.
  Pausing does not supersede pending notices. Repeated identical ticks are quiet.
- The real native CLI with a local scripted provider read and acknowledged a
  notification, acquired the retained verdict and recorded the actual disposition.
  The host then recorded application. No inference was used in this test; it is
  transport proof, not semantic judgment or proof of waking an inactive chat.
- Actual disposable macOS SESSION and LOGIN launchd registrations woke the copied
  observer with the owner absent and project paused. They spent no review calls,
  preserved the allocation and were unregistered, retaining state until fixture
  cleanup. LOGIN registration/wakeup is observed; logout/reboot behavior is not.
- `control-migration.mjs` appends a paused prototype host v1-to-v2 migration at an
  explicitly trusted quiescent boundary. It binds both journals and configs,
  preserves history/results and review allocation, expires old unused grants,
  and enrolls initial health. Same-intent retry does not reinitialize it. The old
  reader refuses the new schema. Rollback assessment never restores an old
  snapshot or drops new health obligations. Actual service cutover is separate.

## Counterexamples And Repairs

Independent review reproduced two reset scheduling defects despite green initial
tests: a later observation could replace an already due epoch, and a blocking
repair could lose the epoch identity after observation expiry. Durable pending
epoch retention and repair association now have explicit regression tests.

The follow-up independent checks found four more defects: reset bookkeeping could
invalidate an active review; an old disposition could falsely apply a new due or
cadence notice; incomplete error-only observations could hide outstanding notices;
and an exception could mutate the outbox while paused. Five targeted regressions
first failed, then passed after repair. Application now requires the exact
OWNER_DISPOSITION_DUE obligation; only complete observations supersede earlier
notices; the exception route rereads pause; active leases precede cadence writes.
The journal-migration slice received independent SCOPED_PASS under its explicit
trusted writer-exclusion capability. This does not prove an active service switch.

The first native notice integration attempt failed because its tools were not in
the isolated owner allowlist; the second exposed missing per-tool approval policy.
Both failed results were treated as failures. The corrected native test passed.
These are narrowly configured private control tools, not global permission changes.
The per-tool setting is documented in the official
[Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

## Verification

Frozen full suite, native cases and explicit disposable LOGIN qualification enabled:
**640 PASS, 0 FAIL, 1 platform-inapplicable skip; 641 total**, 25.82 seconds.
Local retained log: `framework-service-recovery-suite-fixed.log` in the 2026-10-07
maintainer artifact directory. Framework validator and whitespace checks pass.
Independent final recheck returned SCOPED_PASS for notification supersession and
application, pause-error guards and in-flight cadence state: 14 notification tests,
three selected activation/health tests and separate counterexample probes. Its
error-path dependency probes were stubbed, not live infrastructure failures.
The earlier independent migration SCOPED_PASS remains valid in its trusted-boundary
scope; neither verdict certifies all of 2.0.
Runtime fingerprint (54 files, candidate source version 1.34.1):
`40832bc8461f9509df553f74c9da941eb45a20095c2a391507e988001d4ffae0`.
The earlier 636-pass run remains evidence for its earlier revision, not acceptance
of the subsequently discovered defects.

Implementation/review agents used the authorized Sol 6.1 High profile. No new
semantic qualification inference runs were dispatched. Agent/coordinator cost was
not measured as attributable subscription usage; these tests prove no savings.

## Unresolved Release Conditions

This is not the frozen combined preparation/application/acceptance/retention/
independent-control/continuation cycle. It does not certify inherited-project
adoption, active service switch, rollback of a running installation, or economics.
The earlier open C12.01 failed repair remains open; this checkpoint never retries
or closes that episode. Notification polling does not wake an inactive owner or
deliver a human alert. Finite notification allocation must not be described as
unbounded operational storage. Unknown-dispatch recovery still requires actual
external process/effect evidence; this module deliberately refuses to invent it.
