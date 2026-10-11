# Review Cycle Recovery Experiment

Status: experimental, uninstalled, NO_RELEASE. This is a maintainer experiment,
not another installed role, workflow or permission. Stable1.34.1 is unchanged.

## Question

Can completed independent judgments survive a later failed judgment and a
coordinator restart, without replaying the producer or granting incomplete work?
This removes recoverability coupling; it does not explain native model silence.

## Boundary

`scripts/control-review-cycle.mjs` reuses the protected append-only CAS store,
the existing catalog, scoped answer/acquisition validators and finding-history
rules. A cycle binds the full supplied evidence basis, action, phase, original
findings, catalog, reviewer, owner, expiry and finite allocation. Each attempt
has its own retained UUID. Completed receipts keep that original identity and
are idempotent; failures and spent reservations are not deleted or refunded.

Injected basis, epoch, result and recovery observers are trusted custody adapters.
Synthetic fixtures implement them in this experiment. This is NOT an adapter
to accept arbitrary caller/model assertions or rewrite an existing native run.
Reservations and recorded dispatches are separate; no native process is launched
by this prototype. Native usage is UNKNOWN, not an inferred account expenditure.

Known stopped failure permits explicit independent transition-bound recovery.
Invalid completed answers retain the proven stop and validation error before
rejection. UNKNOWN blocks dispatch until an explicit trusted later STOPPED
reconciliation; its original observation survives. A refused pre-dispatch attempt
is NOT_STARTED, not a running process or refunded slot. Retry approval expires
invocation and accepted completion authority, not merely the right to reserve.

Source, phase, action or finding-history change invalidates the entire epoch
conservatively and permanently, even if bytes later return. Asynchronous snapshot
rechecking alone cannot close the final-await window. The experiment therefore
requires a separate protected, monotone custody epoch in the basis and a synchronous
`readEpoch` adapter. Its value is checked inside publication and after the last
await, before returning dispatch/completion success. The fixture's source writer
advances that epoch on every change. A cached content hash, async getter, or writer
that bypasses this custody contract cannot prove the fence. Failed permission is
retained as NOT_STARTED; invalidated checkpoints remain historical evidence.
This does not atomically lock external files across a future native launch. Real
SDK epoch ownership, writer synchronization, launch-bound validation and immutable
source custody remain integration obligations, NOT proven by a synthetic callback.
Expiry and capacity cannot be renewed by reopening the store. Receipt retrieval
is historical readback, not refreshed authority. Source bodies are validated in
memory, but checkpoints retain digests/handles and original answer identity,
not repeated source text; real raw-blob custody belongs to the adapter. All87
criteria are represented with PENDING/ASSIGNED/COMPLETED/INVALIDATED bookkeeping;
pending criteria never become PASS or NOT_APPLICABLE. Host admission is always
DENIED_NOT_INTEGRATED, including a hypothetical complete synthetic ledger.

## Discriminator

Fake episode A completes C15.01-04. B is assigned C02.01-03 and stops in failure.
After restarting the coordinator, only B is explicitly recovered. A's receipt
hash and attempt stay unchanged. The result is7 completed criteria and80 pending,
three reserved/recorded-dispatched attempts, two completed episodes, no producer
call and no permission to continue. Negative branches test drift, unknown outcome,
lost checkpoint, expiry, failed-repair closure and invalid/duplicate evidence.

## Not Yet Implemented

Production integration needs actual observer custody and a host-owned cycle
membership contract, explicit finite cross-tick recovery, fresh source bindings,
complete87 global finding/dependency reconciliation, then actual owning disposition.
Old host leases, native runs and expired grants cannot be relabeled as cycle attempts.
The prototype's <=20 allocation/group-at-a-time experiment is not a configuration
for finishing all28 groups. The prospective episode/budget policy needs its own
bounded design and falsification before native use; do not simply raise a cap.

New tests are outside Freeze10's packaged runtime and candidate inventories.
Fourteen local tests passing does not imply native feasibility, semantic acceptance,
ordinary memory application, HEALTH/debt handling, economic benefit or safe adoption.
Those remain release gates. No further native trial is authorized by this document.
