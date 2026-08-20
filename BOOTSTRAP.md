# Vydykhai Agent Bootstrap

This file is for the coding agent, not the human. When a user asks to connect Vydykhai to the current project, own the technical setup end to end.

The bootstrap request authorizes creation of a setup branch, framework install/update, validation, a setup commit or PR, Project State, and a dedicated Framework Orchestrator. When the user explicitly starts a project with no repository, it also authorizes preparation of a private Git-backed operating repo after owner/host confirmation. It does not authorize merge, public visibility, destructive overwrite, paid actions, production changes, or disclosure of private data.

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

## Resolve Agent Routing

Use the latest available flagship model and resolve three reasoning profiles from the current agent environment:

1. `ORCHESTRATOR`: maximum available stable reasoning; map to `Ultra` when that label exists.
2. `DISCOVERY`: deep bounded reasoning; map to `XHigh` when that label exists.
3. `EXECUTION`: efficient bounded reasoning; map to `Low` when that label exists.
4. Resolve by current model catalog or authoritative guidance, not version number alone. If discovery is unavailable, use the environment's recommended flagship and mark verification pending.
5. Use the closest supported profile when a preferred label is unavailable and record the fallback; never silently run a different profile.
6. Record the policy, resolved model id, all three mappings, check date/source, and any fallback in Project State.
7. Re-resolve at framework update, new or rotated orchestrator, model rejection/deprecation, and active-project Health Review at least every seven days.
8. Pass the selected role profile explicitly to every new context when tools support it. A resumed current task keeps its accepted profile unless a re-brief changes it.

An explicit human decision may choose another profile for a named scope. Maximum reasoning does not authorize unbounded spend or external actions. Universal framework files never pin a model id or require a vendor-specific configuration file.

## Activate

1. Apply `$project-launch` from the installed target repository. Do not report project readiness from `doctor` alone.
2. Confirm the project home from observed local path, remote, host, owner, and visibility. When no repo exists, ask only unresolved host/owner/visibility and prepare a private Git-backed repo when tools allow.
3. Prove shared sync through one Git-backed repo and durable tracker. Prefer GitHub Repo + Issues/Projects/PRs. Use creation or update plus readback of the first real Project State artifact as the write test; never create disposable probe issues.
4. Create or update the compact Project Operating Brief, Project State, Shared Sync Contract, one Project Memory Graph with stable anchors, atomic nodes, typed relations and executable retrieval, tracker projection, and safe operational pointers. Existing graph schemas, Idea Memory, and Intent Trail migrate through a side-by-side candidate, preserved ids/sources, practical retrieval comparison, visible delta, and human-confirmed cutover; they never become parallel current truth.
5. For an existing project with meaningful history, have the orchestrator route an early bounded read-only memory backfill from the accepted brief or earliest reliable baseline. Compare high-signal human corrections, meeting decisions, pivots, open recall commitments, checkpoints, and accepted lessons with current memory; deeply inspect only missing, ambiguous, or conflicting clusters; and require ordinary future-work retrieval before human-confirmed integration. Do not copy the full transcript or model narration, and do not block unaffected execution.
6. Register each current participant's role and decision scope, backup/absence route, agent environment, active orchestrator, framework/doctor state, repo/tracker/input access, and availability. The kit is committed once and pulled by the team; each participant's own orchestrator publishes its readiness receipt because one machine cannot certify another.
7. Establish one coordination-input route. Prefer direct least-privilege source access for each relevant orchestrator. When that is unavailable or unnecessary, name one intake owner whose accessible source is distilled into an approved, traceable shared delta. Treat raw meetings, transcripts, chats, and notes as inputs, not project truth.
8. Map only operational access required by the first DOD: environments/services, current deployed baseline or revision, merge and deploy authority, secret-system references, non-destructive access check, backup/rollback route, and stop conditions. Never request every credential up front, store a secret value, infer production authority, or treat merge as deploy. Missing future-only access is `NOT_REQUIRED`; a required incomplete protected pointer blocks only its dependent action.
9. Test each current participant's required human and orchestrator access with individual least-privilege authentication. Record non-critical gaps as `SYNC_LIMITED`; do not claim complete alignment for affected work and do not block unrelated work.
10. Reuse the registered organization-only Framework Orchestrator when it is current and healthy; create one only when none exists. A replacement uses the normal confirmed rotation rather than creating a second active context. Name it `[ORCHESTRATOR] <project> — Vydykhai <version>`, read back its title/handle and maximum profile, pin/foreground exactly that one context when supported, and confirm it can reconstruct compass, first DOD, active plan, blockers, and next-best-action.
11. Configure task Return Sync in this order: native cross-context message, shared-tracker event/hook, then one fallback monitor. Record the mapping in Project State and verify it on the first real dispatch through one receipt id matched across send, receive, consume, and routed next action; do not create a separate model run or make the human poll tasks only to test it.
12. If the environment cannot create resumable contexts, use the closest tracker-linked handle and explain the limitation once.
13. Publish and read back one Project Activation Receipt with every required check, evidence, limits, first route, and next-best-action. Use `PROJECT_READY`, `PROJECT_READY_WITH_LIMITS`, `NEEDS_DECISION`, or `BLOCKED_BY_ACCESS`; never collapse a gap into readiness.
14. Tell other participants to pull the accepted setup change. Their orchestrators run `doctor`, prove their own Shared Sync/input readiness, and update their receipt when they next resume. Missing participants block only overlapping work.

## Return

Report only:

- installed version and `doctor` result;
- creator, license, and attribution integrity;
- environment adapter and context mapping;
- Project Activation Receipt and its evidence-backed status;
- Shared Sync Contract, coordination-input route, safe operational source pointers, and access status;
- task Return Sync mapping;
- setup change/PR or the exact access blocker;
- Project State and orchestrator link/status;
- resolved agent routing and last-check date;
- one next human action, if any.
