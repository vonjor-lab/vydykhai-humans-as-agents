# Project Launch Workflow

Goal: turn one installation request into a proven shared operating project before implementation starts.

## 1. Discover Before Asking

1. Confirm the target product repo and agent working directory from observed state. Inspect local path, remote, host, owner, visibility, git state, instructions, and privacy constraints.
2. Run `node scripts/vydykhai.mjs doctor` when the kit is installed. `doctor` proves framework integrity only; it never proves live project readiness. Inventory Project State/graph schema before reuse; migrate old current-state artifacts side by side rather than appending new sections to them.
3. If the kit is missing and the user supplied the canonical link, execute `BOOTSTRAP.md` yourself. If no repo exists, ask only unresolved host, owner, or visibility and prepare a private Git-backed repo when tools allow.
4. Inventory existing briefs, tasks, board, Project State, memory, branches, PRs, environments, deployment instructions, and accepted operating rules before creating anything. Reuse current truth.
5. Use available repo-host, tracker, context, meeting, and operational tools directly. Ask the human only for missing access, trust, or a decision; never hand them setup commands.
6. Use the first real Project State create/update plus readback as the tracker write test. Never create disposable probe issues, branches, or credentials.
7. Resolve role-routed profiles on the latest available flagship: maximum available for `ORCHESTRATOR`, deep bounded for `DISCOVERY`, and efficient bounded for `EXECUTION`; record actual mappings, check source/date, and fallback.
8. Configure each task to write the marked Return Sync to a durable tracker outbox before sending the same id through native cross-context messaging; after consumption the orchestrator appends the paired marked Return Route receipt. Native delivery is the wakeup; the outbox is authority. Verify `WRITTEN -> SENT -> RECEIVED -> CONSUMED -> ROUTED` on the first real dispatch and a scheduled Guard `NOOP` afterward without human polling.
9. Reuse the registered active orchestrator when healthy and create one only when absent. Replace it only through confirmed rotation, never by leaving two active contexts. Name it `[ORCHESTRATOR] <project> — Vydykhai <version>`, read back its actual title and maximum profile, and pin or foreground exactly that one context when supported; Project State owns the current pointer.
10. Install one project-owned Project Guard outside the active orchestrator context using the cheapest available independent scheduler. Prove event and timed routes, deterministic `guard-check`, actual-context and `Human attention` read, native wakeup, fresh maximum evaluator, and semantic incident handling. Use one real emitted Return Sync/Route pair, then prove the installed schedule produces `NOOP` with no wake, queued message, or model call; malformed or mismatched routing must audit. Adapter implementation and smoke stay in a focused service task. The runner targets the Project State pointer so it survives rotation; if no independent scheduler exists, report the exact `LIMITED` boundary instead of claiming background recovery.

## 2. Project Activation Gate

Record each gate as `PASS`, `LIMITED`, `BLOCKED`, or `NOT_REQUIRED`, with observed evidence and one repair action:

1. **Home and kit:** exact target repo, private-by-default visibility when newly created, accepted framework change, and passing `doctor` on this participant's checkout.
2. **Shared sync:** one writable Git-backed repo and durable tracker with stable links, history, permissions, and read/write access. GitHub Repo + Issues/Projects/PRs is the recommended and best-supported default; an equivalent is valid by capability.
3. **People:** current participants, role/decision scope, owner/backup or absence route, availability, agent environment, active orchestrator, framework check, and a self-published readiness receipt. One machine cannot certify another.
4. **Inputs:** an accessible route from meetings, recordings, transcripts, chat, docs, or approved manual notes into durable shared state. Prefer direct access for each relevant orchestrator; otherwise name one intake owner and a traceable approval route.
5. **Operations for the first DOD:** only required environments/services, current deployed baseline or revision, protected pointers, merge/deploy authority, backup/rollback route, and stop conditions. Future-only access is `NOT_REQUIRED`; secret values never enter shared state.
6. **Course:** accepted goal, users/actors, first useful outcome, nearest DOD, non-goals, initial `now / next / blocked / done` route, and named open decisions.
7. **Control loop:** Project State v2, Project Memory Graph v3, active registered orchestrator, external Project Guard, Governor baseline, DOD Control Line, tracker projection, Execution Lease and Return Sync mapping, and one exact next-best-action. First live Return Sync proof is recorded automatically when the first task returns.

Use one overall result:

- `PROJECT_READY`: every gate needed by the first DOD passes.
- `PROJECT_READY_WITH_LIMITS`: named gaps do not affect the first route; state the safe boundary and repair owner.
- `NEEDS_DECISION`: a real human choice about goal, ownership, host, privacy, or authority remains.
- `BLOCKED_BY_ACCESS`: missing access prevents the first safe route.

An idea may be shaped while its private project home is being prepared, but do not dispatch shared execution or claim team alignment before the relevant gates pass. A missing participant blocks only overlapping work.

## 3. Project Operating Brief

Capture only:

- project, target repo, durable tracker, source of truth, and privacy boundary;
- product goal, first useful outcome, users/actors, first DOD, non-goals, and constraints;
- participants, role/decision scope, owner/backup convention, and availability;
- coordination inputs, direct or intake-owner route, access evidence, and approval path;
- safe operational sources for the first DOD: environment/service owner, current baseline/revision, protected references, runbooks, merge/deploy authority, recovery route, and last safe check, never secret values;
- agent environment adapter, role mappings, context mapping, Return Sync route, Project Guard runner, and scope-freshness interval;
- tracker projection, open decisions, immediate risks, and first next action.

Treat coordination inputs as raw until distilled and approved. Fathom is the recommended meeting recorder when available; Read AI, tl;dv, another recorder, team chat, docs, or manual notes are valid by capability. A local notebook is an input/view unless it is shared, versioned, and agent-accessible.

## 4. Durable State

Create or update one compact Project State using `project-state-template.md`. Store the activation receipt, Project Guard registration, `Human attention: NONE`, DOD Control Line, Governor receipt, Execution Leases, Pending Return Inbox, detour/recall return gates, and participant readiness there. Render a complete Candidate away from the accepted body, run `control-check` and retain its SHA-256, publish once with an exact-current guard when available, then export and verify the exact hash plus validation. Restore and verify the last accepted body on mismatch; never let a partial or failed write become current or append state after the end marker.

Create one Project Memory Graph when the first reusable decision, idea, lesson, or safe operational pointer must survive its source context. Start stable anchors as relevant; keep one meaning per node and link operations to protected runbooks or secret systems.

For an existing project with meaningful history, route an early bounded read-only memory backfill without blocking safe current work. Start from the accepted brief or earliest reliable baseline; inventory high-signal human corrections, meeting decisions, accepted pivots, open recall commitments, checkpoints, and accepted lessons; cluster by stable anchors; let later evidence supersede earlier meaning; and deeply inspect only missing, ambiguous, or conflicting clusters. A fresh evaluator uses ordinary future-work questions to recover concrete meaning, source, return condition, and human gate before confirmed integration. Do not copy the full transcript or model narration.

For an old graph, build a side-by-side read-only v3 candidate, preserve ids/sources, compare `CURRENT / NEXT / PRIOR_MISS` practical retrieval, show loss/conflict/delta, and switch only after human confirmation. Map old Idea Memory and Intent Trail before making them read-only evidence. Run `node scripts/vydykhai.mjs control-check --state <exported-state.md> --graph <exported-graph.md>` before activation or schema cutover.

Configure one lightweight tracker projection. The task issue body is the current contract; Project State holds the route; the board or equivalent shows `Todo`, `Next`, `In Progress`, `In Review`, `Blocked`, `Done`, and `Parked`. Record owner, priority, formal parent/dependencies where supported, milestone or delivery window, checkpoint, and PR/artifact. Use fixed sprints only when the team needs them.

Use one navigation grammar from the first task onward: `<work-id> [<track>] [<mode>] — <short outcome>`. GitHub uses the owning Issue, never a PR number; another tracker uses its stable key. Preserve this number-first format for every project-goal task. Only service work that maintains the coordination system instead of advancing a project goal puts a concise unique service id first, such as framework version, rotation generation, or Guard incident; never reuse the Project State issue as that work id.

## 5. Team Onboarding

Commit the framework once into the project repo. Each participant pulls the accepted setup change; their own orchestrator runs `doctor`, proves repo/tracker/input access, and writes its readiness receipt. The project orchestrator records, but never invents, another participant's state.

Keep that receipt to one durable event: participant/role, agent environment and orchestrator link, framework/`doctor`, repo/tracker/input checks, availability/backup route, result, date, and exact gap if any.

Explain only the working loop:

- speak naturally to the personal orchestrator; it creates and names focused contexts and keeps the tracker current;
- after a meaningful meeting, process it asynchronously; unrelated work continues when someone is absent;
- keep discovery, lab, implementation, and maintenance in separate contexts; tasks finish with `$accept-work`, exact-current-code smoke, human confirmation, and manual merge in the task context;
- tasks solve ordinary local failures and return automatically at named checkpoints, irreducible blockers, or terminal results; people do not poll them;
- say ideas and corrections freely; the orchestrator protects the nearest DOD, updates shared memory, and routes only affected work.

## 6. First Route And Finish

- Use `$start-work` inside the launch flow when the goal, brief, first DOD, or task map still needs shaping.
- Use `$daily-alignment` when recent coordination inputs materially changed another participant's safe next action.
- Use `$framework-orchestrator` only after the first route is clear and its relevant activation gates pass.
- Do not implement, deploy, smoke, or merge in the launch/orchestrator context.

Publish and read back one Project Activation Receipt containing gate evidence, Project State, compass/DOD, participants, Shared Sync, operational readiness, active orchestrator, external Project Guard proof, Governor `HEALTHY` receipt, first route, safe limits, and one exact next action. Return `PROJECT_READY`, `PROJECT_READY_WITH_LIMITS`, `NEEDS_DECISION`, or `BLOCKED_BY_ACCESS`; never stop at a setup summary without next-best-action.
