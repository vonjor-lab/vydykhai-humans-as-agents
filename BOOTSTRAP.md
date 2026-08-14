# Vydykhai Agent Bootstrap

This file is for the coding agent, not the human. When a user asks to connect Vydykhai to the current project, own the technical setup end to end.

The bootstrap request authorizes creation of a setup branch, framework install/update, validation, a setup commit or PR, Project State, and a dedicated Framework Orchestrator. When the user explicitly starts a project with no repository, it also authorizes preparation of a private Git-backed operating repo after owner/host confirmation. It does not authorize merge, public visibility, destructive overwrite, paid actions, production changes, or disclosure of private data.

## Preconditions

1. Confirm the target project repository. If none exists, ask only for unresolved host, owner, or visibility, then create or prepare a private Git-backed operating repo when tools allow. If the target is otherwise ambiguous, ask one short question and nothing else.
2. Inspect existing `AGENTS.md`, repository instructions, git state, remotes, and privacy constraints. Preserve unrelated and uncommitted work.
3. Use available shell, network, repository host, tracker, and context tools yourself. Ask the human only for missing access, trust, or a decision; do not ask them to type setup commands.
4. Never treat the standalone Vydykhai repository as the target product repository.
5. Inspect how the current agent environment loads project instructions and skills, creates or resumes contexts, accesses durable shared state, returns events between contexts, and runs verification.
6. Identify the durable tracker, coordination-input sources, and protected operational sources. GitHub with Issues and PRs is the default; meeting inputs may come from Fathom, Read AI, tl;dv, another recorder, team chat, docs, or manual notes. Keep secret values in the project's secret system. For each protected source record only its owner, protected reference, environment/scope, allowed non-destructive route, last safe check time/result/source, and expiry or re-entry condition.

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

1. Apply `$project-launch` from the installed target repository.
2. Create or update the compact Project Operating Brief, Project State, Shared Sync Contract, one Project Memory Graph with stable anchors, atomic nodes, typed relations and executable retrieval, tracker projection, and safe operational pointers: Git-backed repo, durable tracker, coordination-input route, privacy boundary, and access coverage. Existing graph schemas, Idea Memory, and Intent Trail migrate through a side-by-side candidate, preserved ids/sources, practical retrieval comparison, visible delta, and human-confirmed cutover; they never become parallel current truth.
3. For an existing project with meaningful history, have the orchestrator route an early bounded read-only memory backfill from the accepted brief or earliest reliable baseline. Compare high-signal human corrections, meeting decisions, pivots, open recall commitments, checkpoints, and accepted lessons with current memory; deeply inspect only missing, ambiguous, or conflicting clusters; and require ordinary future-work retrieval before human-confirmed integration. Do not copy the full transcript or model narration, and do not block unaffected execution.
4. Register participants, active orchestrator links, framework versions, resolved role profiles, current tasks, sync readiness, and safe continuation.
5. Test each active participant's human access and their orchestrator's required read/write access to the repo/tracker plus read access to relevant meeting and operational instructions. Use individual least-privilege authentication, never shared credentials or copied secret values. For every protected route, prove the current pointer is complete and perform only its allowed non-destructive check; otherwise mark the affected action `MEMORY_COVERAGE_GAP / BLOCKED`. Record other missing coverage as `SYNC_LIMITED` and do not claim complete alignment for affected work.
6. Create the dedicated organization-only Framework Orchestrator context. Read back its actual title or stable handle and resolved maximum profile, pin/foreground it when the environment supports that control, and confirm it can reconstruct compass, DOD, tasks, blockers, and next-best-action.
7. Configure task Return Sync in this order: native cross-context message, shared-tracker event/hook, then one fallback monitor. Record the mapping in Project State and verify it on the first real dispatch through one receipt id matched across send, receive, consume, and routed next action; do not create a separate model run or make the human poll tasks only to test it.
8. If the environment cannot create resumable contexts, use the closest tracker-linked handle and explain the limitation once.
9. Tell other participants to pull the accepted setup change. Their orchestrators confirm `doctor` and Shared Sync access when they next resume.

## Return

Report only:

- installed version and `doctor` result;
- creator, license, and attribution integrity;
- environment adapter and context mapping;
- Shared Sync Contract, coordination-input route, safe operational source pointers, and access status;
- task Return Sync mapping;
- setup change/PR or the exact access blocker;
- Project State and orchestrator link/status;
- resolved agent routing and last-check date;
- one next human action, if any.
