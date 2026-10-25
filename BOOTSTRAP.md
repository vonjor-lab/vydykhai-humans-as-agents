# Vydykhai Agent Bootstrap

This file is for the coding agent, not the human. When a user asks to connect Vydykhai to the current project, own the technical setup end to end.

The bootstrap request authorizes creation of a setup branch, framework install/update, validation, a setup commit or PR, Project State, a dedicated Framework Orchestrator, and one read-only project-owned Project Guard schedule. When the user explicitly starts a project with no repository, it also authorizes preparation of a private Git-backed operating repo after owner/host confirmation. It does not authorize merge, public visibility, destructive overwrite, paid actions, production changes, or disclosure of private data.

## Preconditions

1. Confirm the target project repository. If none exists, ask only for unresolved host, owner, or visibility, then create or prepare a private Git-backed operating repo when tools allow. If the target is otherwise ambiguous, ask one short question and nothing else.
2. Inspect existing `AGENTS.md`, repository instructions, git state, remotes, and privacy constraints. Preserve unrelated and uncommitted work.
3. Use available shell, network, repository host, tracker, and context tools yourself. Ask the human only for missing access, trust, or a decision; do not ask them to type setup commands.
4. Never treat the standalone Vydykhai repository as the target product repository.
5. Inspect how the current agent environment loads project instructions and skills, creates or resumes contexts, accesses durable shared state, returns events between contexts, and runs verification.
6. Identify the durable tracker, coordination-input sources, and protected operational sources. GitHub with Issues, Projects, and PRs is the default; meeting inputs may come from Fathom, Read AI, tl;dv, another recorder, team chat, docs, or manual notes. Keep secret values in the project's secret system. For each protected source record only its owner, protected reference, environment/scope, allowed non-destructive route, last safe check time/result/source, and expiry or re-entry condition.
7. Inventory existing project artifacts before creating new ones: brief, tracker tasks, board, Project State, memory, branches, PRs, environments, deployment instructions, and accepted operating rules. Reuse current truth and route meaningful history through the bounded backfill instead of starting a parallel project.
8. Keep `doctor` and live activation distinct. `doctor` verifies the installed kit; only `$project-launch` can prove repo/tracker permissions, participant readiness, coordination inputs, operational routes, compass/DOD, and the working control loop.

## Install

1. Fetch the canonical repository into a temporary directory or reuse a verified local canonical checkout.
2. Read `vydykhai.json` and this file from the same revision.
3. Create a setup branch when repository policy allows it.
4. Run the canonical installer against the target repository, then run `node scripts/vydykhai.mjs doctor` from the target.
5. Do not use `--force` when managed files were changed locally. Reconcile them explicitly or request approval.
6. Preserve the managed `docs/VYDYKHAI_NOTICE.md`, creator/license metadata, and required notice. They cover the imported framework kit, not the target project's own code, license, or content.
7. If the environment does not read `AGENTS.md` or `.agents/skills` natively, create one thin project-local adapter in its supported instruction format. Point it to the canonical files; do not copy their rules.
8. Review the complete diff. Keep project rules outside the managed `AGENTS.md` block and reject secrets, transcripts, customer data, private links, or product internals in universal files.
9. Commit and open a setup change or PR when repository-host access exists. Follow the target repository's merge policy; do not merge merely because bootstrap was requested.

### Version Channels And Explicit Transitions

Automatic update and live doctor select the installed target's major: `1.x` uses
`main`, `2.x` uses the opt-in `release/2.x` branch. A missing, malformed, regressed
or wrong-major channel is not permission to fall back. Keep remote default HEAD
and `main` on compatible 1.x while historical updaters remain supported.

A major change or downgrade needs an approved exact source/target version pair,
preservation and migration/rollback evidence at a safe boundary. Use the reviewed
new canonical installer with `--approve-transition <from-version>:<to-version>`;
`update` additionally requires explicit `--from <trusted-local-source>`.
`--force` only concerns approved managed-file conflicts, never transition consent.
Old installed CLIs cannot enforce this guard and must not be used for an explicit
cross-major `--from`. A matching version flag is an agent-supplied assertion of
human consent, not independent authentication or successful project migration.
Do not infer that the unreleased candidate is available merely because the CLI
supports this route. Confirm published source/tag/archive and actual adoption.

### Private Control Runtime

When private control activation is explicitly authorized, own its followthrough after normal install/update; do not leave the technical step for a separate human reminder. Keep kit integrity, private activation and project adoption as distinct outcomes.

Use the installed `node scripts/vydykhai.mjs control-activate --runtime-source <trusted-source> --input <private-request.json>`. Retain a standalone canonical source with its own `LICENSE.md` and `NOTICE.md`; never stage from product-local licenses or add those root files to the managed kit. The installed kit and source must have the same version. Obtain the expected runtime digest from separately trusted release/candidate evidence; a self-derived hash verifies bytes, not source authenticity or release status.

The private request has exactly `expectedDigest`, `runtimeDirectory`, `root`, and `profile`. Prepare owned canonical 0700 runtime/state directories outside the product and outside each other, a 0600 request outside the product/source/runtime directory, and the profile's private source registry. Use explicit native/auth references; never provision or copy credentials. The command verifies the source snapshot, stages its immutable inventory, imports activation only from the verified private copy, and reads back its descriptor. It does not update the kit, start an observer, register/restart a scheduler, or certify project readiness. Same-profile repetition preserves existing journals, budgets and pauses; a different selected digest requires explicit cutover rather than activation. Unsupported hosts or failed activation stay visibly blocked; an earlier successful kit update is not rolled back or promoted to adoption.

For the event-bound route, select host `requirePreparation:true` and ordinary
mechanical reconciliation with `health.periodicReview:false`; initial HEALTH and
explicit reset-cadence obligations remain. Preserve legacy history through the
supported migration boundary, not an in-place config rewrite.
With scope and finite budget established, the same setup owner uses the selected
runtime's `startScheduledControl({descriptorFile,mode,intervalSeconds})`. The first
natural interval starts the observer; registration alone proves no work occurred.
Use `waitControlObservation` and its receipt hash cursor to observe completion.
`PENDING/WAIT_TIMEOUT` ends only waiting, never work; do not repeat dispatch or
message active workers. A terminal receipt includes owner/continuation processing,
not just the earlier review checkpoint. Preserve failed/unknown outcomes and spend.
Observe a further quiet interval separately. Legacy synchronous startup remains
compatible, but does not prove wait/execution separation. A paused initial receipt
certifies neither diagnosis nor adoption. The setup owner follows through without
another human reminder; missing authorization stays explicit.

An expired initial profile without delivery is a setup gap, not permission to edit
its immutable file or refill its journal. After qualified runtime selection, use
the trusted `changeControlProfile` operator API from `control-profile-change.mjs`
at a paused, stopped boundary. Keep host config/authority and all old journals;
new review allocation and first owner-handler allocation need separate explicit
limits/evidence. New allocations have separate journals. Do not replace existing
owner allocation through this route. A crashed transition retains ownership and
needs exact stopped-operator recovery, never automatic replay. Recovery can resume
the bound unused staging or roll back with an exact `resumeFrom` archive; spent or
unknown allocations never become fresh. Profile selection
does not start a timer, unpause work or certify adoption. The same setup owner
then proves actual initial, recurring, delivery and application receipts.

## Resolve Agent Routing

Resolve capability-and-cost profiles from the current agent environment; do not equate price with task capability:

1. `ORCHESTRATOR`: current flagship at `Low`; temporary `High` after a control failure survives one targeted correction, then `Low` after verified recovery. Use `effortPolicy`, not legacy profile fields.
2. `DISCOVERY`: current flagship at `High` for unresolved solution work.
3. `EXECUTION`: efficient bounded reasoning; map to `Low`. Use the lowest model proven for the task class, otherwise retain the accepted profile or explicit flagship fallback.
4. `PREPARATION`: opt-in bounded retrieval at `Low`, using a proven low-cost model and `docs/workflows/context-preparation.md`. The orchestrator owns initial/supplementary assignments and review under `context-routing.md`; the executor consults it, not the preparer. Resolve current availability, evidence and fallback; never silently downgrade orchestration or unresolved discovery from flagship.
5. Use the closest supported profile when a preferred label is unavailable and record the fallback; never silently run a different profile.
6. Record policy, actual model/effort for each adopted profile, comparable evidence, check date/source and fallback in Project State. Missing preparation proof leaves the established route working.
7. Re-resolve at framework update, new or rotated orchestrator, model rejection/deprecation, and active-project Health Review at least every seven days.
8. Pass the selected role profile explicitly to every new context when tools support it. A resumed current task keeps its accepted profile unless a re-brief changes it.

An explicit human decision may choose another profile for a named scope. Maximum reasoning does not authorize unbounded spend or external actions. Universal framework files never pin a model id or require a vendor-specific configuration file.

## Activate

1. Apply `$project-launch` from the installed target repository. Do not report project readiness from `doctor` alone.
2. Confirm the project home from observed local path, remote, host, owner, and visibility. When no repo exists, ask only unresolved host/owner/visibility and prepare a private Git-backed repo when tools allow.
3. Prove shared sync through one Git-backed repo and durable tracker. Prefer GitHub Repo + Issues/Projects/PRs. Use creation or update plus readback of the first real Project State artifact as the write test; never create disposable probe issues.
4. Create or update Project Operating Brief, atomic Project State v2, Shared Sync Contract, Project Memory Graph v4, tracker projection, and safe operational pointers. Link existing current Module Contracts; route missing product documentation to a focused owning task instead of writing it in the orchestrator. State records each current fact once in its owning control section; activation evidence is immutable and tracker/legacy summary sections are non-authoritative views. Graph v4 separates a stable entity spine from atomic current meaning, links durable modules/capabilities to their documentation and implementation boundaries, includes Pending Memory Events plus `CURRENT / NEXT / CROSS_DOMAIN / PRIOR_MISS` probes, and advances only for a semantic memory delta. Render and validate one complete State Candidate before publication, retain its SHA-256 and the last accepted body, then read back the exact hash plus `control-check`; restore the accepted body on mismatch. Keep a valid v3 readable while a side-by-side v4 Candidate is proven and human-confirmed; never append new current sections to old bodies.
5. For an existing project with meaningful history, have the orchestrator route one focused side-by-side reconstruction from the accepted brief or earliest reliable baseline through the current watermark without mutating accepted shared state. That focused task records every bounded source range and participant contribution in the Source Coverage Ledger, processes each range once, and builds the entity spine plus missing Module Contracts in one reviewable Candidate before attaching high-signal human corrections, meeting decisions, pivots, open commitments, checkpoints and accepted lessons as atomic current meaning; later evidence explicitly supersedes earlier meaning. Deeply inspect only missing, ambiguous or conflicting clusters. Run 3-4 ordinary unhinted real-task probes, one cross-domain route and one full `source -> task brief -> application -> acceptance/return -> memory update` replay; a miss stops promotion and receives targeted repair/regression before human-confirmed cutover. Preserve source links without copying full transcripts or model narration, and do not block unaffected execution.
6. Register each current participant's role and decision scope, backup/absence route, agent environment, active orchestrator, framework/doctor state, repo/tracker/input access, and availability. The kit is committed once and pulled by the team; each participant's own orchestrator publishes its readiness receipt because one machine cannot certify another.
7. Establish one coordination-input route. Prefer direct least-privilege source access for each relevant orchestrator. When that is unavailable or unnecessary, name one intake owner whose accessible source is distilled into an approved, traceable shared delta. Treat raw meetings, transcripts, chats, and notes as inputs, not project truth.
   Ordinary updates include necessary activation/checks under `docs/workflows/framework-activation.md`; consume the installed `adoption-plan --json` even after an older updater. The active orchestrator applies release requirements automatically at the safe checkpoint, with one focused executor. New qualifying tasks use supported preparation by default, old workers at safe rebrief/readback; unsupported capability stays scoped pending. No expert prompt or automatic native hook inheritance is required.
8. Map only operational access required by the first DOD: environments/services, current deployed baseline or revision, merge and deploy authority, secret-system references, non-destructive access check, backup/rollback route, and stop conditions. Never request every credential up front, store a secret value, infer production authority, or treat merge as deploy. Missing future-only access is `NOT_REQUIRED`; a required incomplete protected pointer blocks only its dependent action.
9. Test each current participant's required human and orchestrator access with individual least-privilege authentication. Record non-critical gaps as `SYNC_LIMITED`; do not claim complete alignment for affected work and do not block unrelated work.
10. Reuse the registered organization-only Framework Orchestrator when current and healthy; create one only when absent. Read back its title/handle and effective profile, then run a Governor baseline from durable sources. A replacement uses confirmed rotation rather than creating a second active context.
11. Install one Project Guard outside the orchestrator context with a native harness automation, OS scheduler plus agent CLI, CI scheduler, or equivalent. Select and prove supported capabilities through `docs/workflows/project-guard.md#checkpoint-review-without-runtime-observation`; missing runtime metadata need not block neutral checkpoint review. For observation/recovery require deterministic `guard-check`, actual-context and Human attention read, one runner-owned incident ledger, silent routine State changes and accepted incidents, native wakeup, maximum evaluator only for anomaly, one-repair circuit breaker, and changed-condition audit; target the Project State pointer rather than one context id. Keep adapter implementation and smoke in a focused service task. Record `LIMITED` when independent scheduling is unavailable.
12. Configure the marked Return Sync as durable task/tracker outbox first and notification by its single accepted owner second (native by default, never parallel Guard delivery); after consumption the orchestrator writes the paired marked Return Route receipt. Reuse the installed canonical parser and prove bounded source refresh and recipient-aware delivery under `docs/workflows/project-guard.md`, including when updating an existing adapter. Verify one real emitted id through `WRITTEN / SENT / RECEIVED / CONSUMED / ROUTED`, then prove the installed schedule returns `NOOP` with no wake, queued message, or model call. Malformed or mismatched routing must audit. Use one monitor only when neither normal route exists; never require human polling.
13. If the environment cannot create resumable contexts, use the closest tracker-linked handle and explain the limitation once.
14. Run `node scripts/vydykhai.mjs control-check --state <exported-state.md> --graph <exported-graph.md>` and `guard-check` on the same snapshot, publish and read back Project Guard proof, the Governor baseline, and Project Activation Receipt, then use `PROJECT_READY`, `PROJECT_READY_WITH_LIMITS`, `NEEDS_DECISION`, or `BLOCKED_BY_ACCESS`; never collapse a gap into readiness.
15. Tell other participants to pull the accepted setup change. Their orchestrators run `doctor`, prove their own Shared Sync/input readiness, and update their receipt when they next resume. Missing participants block only overlapping work.

## Return

Report only:

- installed version and `doctor` result;
- creator, license, and attribution integrity;
- environment adapter and context mapping;
- Project Activation Receipt and its evidence-backed status;
- Shared Sync Contract, coordination-input route, safe operational source pointers, and access status;
- DOD Control Line, Project Guard registration, Governor state, Execution Lease and task Return Sync mapping;
- setup change/PR or the exact access blocker;
- Project State and orchestrator link/status;
- resolved agent routing and last-check date;
- one next human action, if any.
