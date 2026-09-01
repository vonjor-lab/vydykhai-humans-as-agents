# Vydykhai: Team Autopilot for People and AI

Version: 1.24.0 | Status: canonical operating core

Vydykhai is a team autopilot for people working on one project with AI. It helps a solo builder across several AI sessions and a distributed team across different computers, models, and agent environments turn an unclear goal into a shared compass, split work without losing coherence, preserve emerging ideas, accept results, and reconverge around the next step. People remain agents of meaning and judgment, while their AI orchestrators maintain the shared picture, sequence, alignment, acceptance, and next-best-action. Operationally, Vydykhai is delivered as a lightweight collaboration framework that the agents execute after setup; people do not need to learn or manually operate its internal workflows.

## Sources

The framework comes from product meetings and practical work with several humans, repositories, branches, AI agents, long-running tasks, lab experiments, failed handoffs, and expensive restarts. Those lessons shaped the rules below; project-specific details do not belong in this repository.

## Purpose

The framework applies when a shared goal can be shaped into durable briefs, bounded tasks, verifiable results, and accepted next steps. Collaborative vibe coding is its primary proven use; broader vibe work follows the same operating cycle.

Use Vydykhai when one person works through several AI contexts, or when several humans and AI agents work asynchronously on one product or shared outcome and can otherwise:

- interpret the same goal differently;
- duplicate or invalidate each other's work;
- build plausible technical slices that do not close a user flow;
- lose decisions inside chats, local worktrees, or uncommitted state;
- spend heavily before discovering that the direction was wrong.

The framework should reduce coordination work for people. Humans should discuss the product and make judgments; the orchestrator should maintain sequence, shared memory, handoffs, and gates. People should be able to voice useful ideas without either expanding the current task or becoming responsible for remembering them later.

## Diagnosis

Two common modes fail when used alone:

- Manual mode keeps a human beside every agent and stops when the human leaves.
- Epic mode gives an agent a large goal but becomes expensive when the brief, constraints, or checkpoints are weak.

Vydykhai combines them: design the compass and task contract top-down, let agents execute autonomously, and ask humans only at named checkpoints.

## Operating Model

- The product compass holds the goal, users, desired outcome, DOD, non-goals, constraints, and current decisions. It may evolve, but never silently.
- The canonical framework maintenance context evolves universal rules, releases, and tooling only; it never installs into product repositories or operates their orchestrators. Separately, each participant has one active Framework Orchestrator for a product stream. It organizes that project and never implements product code.
- Research, lab, implementation, and project maintenance run in separate focused contexts. These are the only contexts that perform project work.
- A shared Git-backed project repo carries the framework and project files. GitHub Repo + Issues/Projects/PRs is the recommended durable sync space; an equivalent tracker is valid only when every participant and orchestrator can reach the same linked state. Local copies and chat history are evidence, not the source of truth.
- Project Memory Graph links stable product anchors to current decisions, reusable lessons, confirmed future ideas, and safe operational pointers in one compact shared view.
- The orchestrator decides what, why, when, and who, and maintains the DOD Control Line, sequence, alignment, dispatch, human requests, shared memory, parent closure, and next-best-action. After an observable dispatch it releases the control turn and relies on the durable return route instead of polling a valid task. A project-owned external Project Guard survives the orchestrator context: events and a schedule run deterministic checks, while a fresh maximum-profile Governor evaluates only anomalies and routes bounded repair or rotation. Neither performs project work. The maximum-profile orchestrator may use bounded internal advisory agents to improve a control decision, but their analysis is disposable and cannot own a project result, create accepted project evidence, or replace a focused context.
- Task contexts decide how to deliver and prove one accepted increment: local planning, implementation, debugging, corrective fixes, `$accept-work`, exact-current-code smoke, manual merge after human confirmation, and automatic return at declared triggers.
- A task detects an execution boundary; the orchestrator decides the project response. Neither role silently takes over the other's work. Focused work and framework update tasks return only to the project orchestrator, which owns adoption without upstream supervision. A possible universal lesson goes upstream only as a separate explicit sanitized compatibility packet, never as project task state or next-best-action.
- One accepted increment has one owning execution context, one Execution Lease, and one canonical Candidate unless the brief explicitly defines parallel-safe work. The orchestrator sequences later increments instead of stretching one task across the product route.

An agent context is a logical boundary, not a vendor feature. It may be implemented as a thread, chat, session, run, workspace, or tracker-linked agent. Names are navigation, not a second tracker: project-goal contexts and every human-facing work reference use `<work-id> [<track>] [<mode>] — <short outcome>` in the project's language with the number first and fixed tags. GitHub uses the owning Issue; another tracker uses its stable task key; a PR or context id never replaces work identity. Normal execution omits mode; other modes are `[DISCOVERY]`, `[LAB]`, `[MAINT]`, or `[REVIEW]`. Only service work that maintains the coordination system rather than advancing a project goal puts a concise unique service id first, such as framework version, rotation generation, or Guard incident; it never reuses the Project State issue as work id. Say `PR #456 → #123 [DOD1] — <short outcome>`, never a bare task, PR, or context number. A sanitized upstream packet contains no project or person names, task ids or links, backlog, private evidence, current project state, or project next-best-action.

One active orchestrator does not mean one eternal context. Name it `[ORCHESTRATOR] <project> — Vydykhai <version>` and its replaced predecessor `[RETIRED][ORCHESTRATOR] <project> — Vydykhai <version>`; `[FRAMEWORK] Vydykhai — maintenance` is reserved for universal maintenance. Keep mutable status in durable Project State, pin or foreground exactly one active orchestrator, and archive focused work only after terminal Return Sync and artifact disposition. Project Guard independently detects liveness drift; Governor decides from observable evidence whether to continue, repair, or enter confirmed rotation. Compaction alone is only a signal.

## Activation

The framework kit is installed once in the target repository and reaches every participant through that shared repo. The normal human interface is one request to the coding agent attached to the target project, even when the project is still only an idea:

```text
Connect Vydykhai to this project and start the orchestrator. Follow BOOTSTRAP.md end to end and ask me only for missing access or a decision: https://github.com/vonjor-lab/vydykhai-humans-as-agents
```

Required launch path:

1. Bootstrap discovers or prepares the private project home, preserves existing work, installs or updates the kit, and inventories current project artifacts before creating new ones.
2. `doctor` verifies only framework integrity; `$project-launch` proves live repo/tracker permissions, participants, inputs, first-DOD operations, course, and control loop.
3. `$project-launch` shapes an unclear goal when needed, then creates the Operating Brief, atomic Project State v2, Project Memory Graph v3, first DOD Control Line, Shared Sync Contract, tracker route, and safe operational pointers.
4. Each participant pulls the accepted setup; their own orchestrator proves local `doctor` plus required repo/tracker/input access because one machine cannot certify another. After an update, activation is proven only from the active orchestrator's own working directory at the accepted project revision, never from the update task or a temporary merged-source checkout. Its own live/offline `doctor`, updated core readback, title, and Project State must agree; otherwise Governor returns `REPAIR` or confirmed-path `ROTATE`.
5. The active orchestrator, external Project Guard runner, Governor baseline, Execution Lease route, and durable-outbox-plus-wakeup Return Sync are read back, then one Project Activation Receipt states the evidence, safe limits, first route, and next-best-action. Without an independent scheduler, activation is visibly limited and cannot promise background recovery.

The bootstrap request authorizes setup branch/PR and shared operating artifacts, not merge, destructive overwrite, paid action, production change, or private-data disclosure. Idea shaping may continue while a private home is prepared, but shared execution and team-alignment claims wait for relevant activation gates. Missing tools or access produce one exact human action.

### Shared Sync Contract And Project Readiness
Distributed Vydykhai requires one shared writable Git-backed repo and durable tracker. GitHub Repo + Issues/Projects/PRs is the recommended and best-supported default; an equivalent must provide stable links, history, permissions, participant-owned updates, and agent read/write access.
Project launch records `PASS / LIMITED / BLOCKED / NOT_REQUIRED` for home/kit, shared sync, people, inputs, first-DOD operations, course, and control loop. The first real Project State write/readback proves tracker access; disposable probe artifacts are forbidden.
Coordination input may be direct for each relevant orchestrator or pass through a named intake owner into an approved traceable delta. Fathom is recommended; another recorder, chat, docs, manual notes, or a shared agent-accessible notebook is valid by capability.
Operational readiness covers only the current DOD: environment owners, current deployed baseline/revision, safe protected pointers, merge/deploy authority, non-destructive check, recovery route, and stop conditions. It never requests all credentials, stores secret values, or infers production authority.
Only an evidence-backed receipt returns `PROJECT_READY`; non-critical gaps are `PROJECT_READY_WITH_LIMITS`, a real choice is `NEEDS_DECISION`, and access that blocks the first safe route is `BLOCKED_BY_ACCESS`. Missing participants block only overlapping work.

## Role-Routed Agent Profiles
Use the latest available flagship model and spend reasoning where the work is decided:
- `ORCHESTRATOR`: maximum available stable reasoning for compass, memory, routing, task design, consultation, integration, and next-best-action. Map to `Ultra` when that label exists.
- `DISCOVERY`: deep bounded reasoning for a solution that is not yet defined: bounded research, product or architecture choices, unresolved UX/UI or visual direction, and experiment design. Map to `XHigh` when available.
- `EXECUTION`: efficient bounded reasoning for a task whose solution and acceptance boundary are already defined. Map to `Low` when available.
These labels are environment mappings, not vendor requirements. Resolve by current availability and authoritative guidance, record the actual model and all three mappings in Project State, and recheck at bootstrap, framework update, orchestrator rotation, model rejection/deprecation, and active Health Review at least every seven days. Pass the selected role explicitly to a new context when tools support it; never silently substitute another profile. A resumed current task keeps its accepted profile unless a re-brief changes it.
A human may override a profile for a named scope. Maximum reasoning never authorizes unbounded spend or external action, and no profile replaces tests, smoke, acceptance, or human checkpoints. Universal rules never pin today's model id.

## Source Precedence

When sources disagree, use this order:

1. The latest explicit human decision for the affected scope.
2. The approved compass, brief, DOD, Brief Patch, or Team Alignment Delta.
3. Current task issue, PR, accepted artifact, and verified repository state.
4. Agent plans, summaries, and handoffs.
5. Inference from code, chat history, or local state.

An agent plan never overrides a later human correction. Treat a material correction as a memory event: investigate whether knowledge was absent, not retrieved, not applied, or not verified; record the repaired meaning before dependent work continues. Stop only the affected scope.

## Proactive Guardrails

Framework rules are active guidance, not hidden compliance. The orchestrator owns product and coordination guardrails. A task applies local safety and its execution contract; at a wider boundary it consults instead of running a framework-wide review. When a human or agent proposes a conflicting route, the responsible context should politely state:

- the relevant rule and concrete risk;
- the recommended route and exact next action;
- what can be preserved and what must be rebuilt.

A human may explicitly override the recommendation. Record the reason, limits, and return condition. A command, prompt, plan, or send attempt is not a completed transition: its owner reads back `Trigger / Retrieved rule / Expected / Observed / Evidence / PASS|MISMATCH|UNVERIFIED|OUTCOME_UNKNOWN`. The orchestrator owns task-launch/resume, Return Sync, and memory-reflection/detour receipts; the acting context owns protected-access receipts; the task owns acceptance/live and side-effect receipts. Only `PASS` closes a transition. A Governor receipt applies only when its audited event exactly matches the current atomic Project State event. A mismatch stops only that transition; an uncertain external outcome freezes replay until exact durable state is reconciled.

## Operating Cycle

### 0. Launch

Connect and prove the repo, participants, inputs, current-DOD operations, source of truth, privacy rules, compass, atomic Project State/graph, DOD Control Line, external Project Guard, and Governor baseline. Register each active orchestrator and publish the Project Activation Receipt before first dispatch.

### 1. Shape

Use `$start-work` to turn a raw goal, meeting insight, or large topic into an epic brief and task map. Start from the product outcome, then identify entities, contracts, dependencies, risks, sequence, ownership, and acceptance.

If the compass changes, publish a visible patch or re-brief. Do not silently mutate active tasks.

### Scope Freshness

Before dispatching, re-briefing, or materially resuming stale or paused work, the orchestrator compares the task with the latest DOD and decisions, upstream results, affected entities and contracts, active work, applicable Project Memory Graph nodes, and current code. An ordinary continue inside a current active contract is a hot path: read only the newest relevant task event and do not rerun alignment, memory retrieval, scope freshness, or dashboard rebuild.

- `UNCHANGED`: the contract is still current.
- `PATCH_REQUIRED`: a bounded Brief Patch is required.
- `REBRIEF_REQUIRED`: goal, DOD, sequence, ownership, or core assumptions must be shaped again.

Age triggers re-reading, not automatic scope change. Seven days without a freshness check is the default signal unless the project sets another interval. Approve a material patch or re-brief before implementation or burn continues. A re-brief or split maps prior progress as `Preserved`, `Replaced`, `Added`, and `Remaining`; it never silently resets demonstrated progress.

### Expansion Check
Task size is a signal, not a verdict. Run an Expansion Check and pause only affected growth when first human-verifiable evidence misses the agreed appetite, a local goal crosses unplanned layers or contracts, the same incidental platform problem recurs across tasks, a second same-class correction appears, or data/operating cost grows without DOD movement.
State `Expected`, `Expanded into`, `Likely cause`, and one route:
- `CONTINUE`: the cross-cut is necessary; approve the updated boundary and appetite.
- `REBRIEF`: several outcomes were mixed; restore one product result and sequence the rest.
- `LAB`: the hypothesis can be proved more cheaply outside the full product path, with a defined production exit.
- `MAINTENANCE`: recurring architecture, data, or tooling friction should be removed before affected delivery continues.
Maintenance must name the friction source, preserve the Accepted Baseline, change the smallest shared cause, prove the original representative flow became materially smaller or faster, test against recurrence, and return explicitly to the original task. Backup, cleanup, migration, or a cap contains impact but does not close the debt unless the recurrence source is removed or deliberately deferred. Set appetite from the task and repository; file, line, or time counts are warnings, never universal verdicts.

### DOD Focus And Project Memory Graph

New ideas must not delay the nearest DOD, useful ideas must not disappear, and meaningful intent, decisions, lessons, and operational knowledge must survive people, tasks, and orchestrator changes. Project State is the atomic control snapshot; its single DOD Control Line names accepted proof, exact remaining gap, and next-best-action. Project Memory Graph is reusable semantic memory; raw history is linked evidence; each task receives only a working capsule.

- A missing requirement is a DOD gap; a required safety, quality, or product boundary is a guardrail. Keep both in the task or re-brief.
- A deliberate change to the promised outcome requires a visible human scope decision and updated DOD, burn, and sequence.
- A useful extension not needed for the current DOD stays out of the task. After human confirmation, store it as an `IDEA` node with value, anchors, source, and recall trigger.
- A human request to remember and revisit something is a recall commitment, not ordinary history. Preserve its current meaning, source, capability aliases and trigger, applicability/timing with plan or checkpoint relation, and any pending human question. If timing is unresolved, return the question at the first matching planning touch instead of choosing a horizon.
- A deliberate “step aside, then return” creates a detour gate with owner, target DOD or lease, return condition, and review-by. The route is restored or deliberately replaced before the detour closes.
- Give outcomes, actors, entities, surfaces, contracts, data, and operations stable anchors and aliases. Keep one reusable meaning per node: `INVARIANT`, current `DECISION`, failed-path `LESSON`, future `IDEA`, or safe operational `POINTER`, with typed relations, applicability, exceptions, and evidence. A protected `POINTER` is executable only when current memory names its owner, protected reference without the value, environment and scope, allowed non-destructive route, last safe check with time/result/source, and expiry or re-entry condition.
Message length is not a trigger. Explicit remember/important/always/never/do-it-differently language, repeated owner explanation, and accepted pivots trigger Memory Reflection. Before apologizing or patching, the orchestrator records `Before / Now / Why / scope`, retrieves related nodes, and classifies `ABSENT`, `RETRIEVAL_MISS`, `APPLICATION_MISS`, or `VERIFICATION_MISS`; inferred wider intent stays `PROVISIONAL`. It integrates one `ADD / REFINE / SUPERSEDE / RETIRE / CONFLICT / NO_CHANGE` event, reruns retrieval, and checks affected active and queued tasks. Task contexts return candidates but never rewrite shared memory.

At each cold-path brief, re-brief, dispatch, consultation or sequence decision, parent acceptance, milestone, and rotation, the orchestrator resolves exact anchors and aliases from the Touch Set, intersects matching open recall commitments and checkpoints before filtering dormant items, adds semantic candidates, traverses relevant typed relations one or two hops, and filters by source precedence, status, scope, applicability, and supersession. It returns no more than seven nodes and fewer when fewer apply as executable items: `Because / Apply / Avoid / Verify / Source`; opaque ids alone are invalid. Raise `MEMORY_COVERAGE_GAP` when required meaning is unproven. Compaction or migration passes only when an ordinary future-work query retrieves the commitment's concrete meaning, source, return condition, and human gate; complete id mapping is not semantic coverage. An incomplete protected pointer blocks only the affected action before secret re-request, historical reconstruction, or live mutation; repair it from linked durable evidence, rerun retrieval, and continue only after the complete safe pointer and current non-destructive check are proven. Re-read the graph watermark before integration, preserve evidence, and do not repeat retrieval on a hot-path continue.

### 2. Route

Choose the smallest useful context:

- Orchestrator Work: project-wide synthesis, prioritization, sequencing, or an owner decision stays in the `ORCHESTRATOR` control context. Internal advisory agents are allowed when the durable result is only a control artifact and their notes can be discarded after synthesis. Give each one `Control decision / Available sources / Expected orchestration output / Route to focused context when`; it returns `CONTROL_ONLY` or `ROUTE_TO_FOCUSED_CONTEXT` in the same control cycle.
- Research Context: a bounded product or technical question is not ready for a brief. Run it as `DISCOVERY`, make no product-code changes, return a short Decision Packet, and close or archive the context after incorporation.
- Lab Mode: isolated implementation or experimentation reduces risk, cost, or time-to-feedback. Define the decision, Accepted Baseline, one main variable, human-verifiable proof, stop/burn limit, and promote/reject/re-brief route before starting. Exit through production transfer, tests, and risk-based real-flow smoke.
- Task Context: the outcome and acceptance boundary are clear enough for `EXECUTION` in the real product path.
- Stale Or Re-brief: the current card is outdated, mixed, too broad, contradictory, or missing required inputs. Revise or split it before creating a task context.

Research reduces uncertainty. Lab reduces execution cost. A task delivers accepted product or enabling work.
A Discovery Decision Packet names the chosen approach, material rejected options and lessons, affected entities or interfaces, acceptance or visual evidence, risks, and unresolved owner decisions. The orchestrator integrates it with the compass and memory before writing execution tasks. Discovery does not produce production implementation by default; a disposable lab artifact must be explicit.
The boundary is the owned result, not the topic or the use of subagents. Advisory analysis may inspect existing durable product context, including a verified repository, only far enough to improve the control decision. Route to a focused context when the answer would establish a new diagnosis, product or technical solution, runtime/data fact, experiment, test, Candidate, acceptance proof, side effect, independently useful artifact, or work that outlives the current control cycle. Advisory output is never accepted project evidence; a material project claim must trace to a human decision, durable source, or focused-context receipt.
### One Success Line

Build from success; learn from failure.

- `Accepted Baseline` is the last proven working state.
- `Candidate` is the current proposed delta.
- `Rejected Candidate` is evidence, never the implicit base for another correction.
- A successor starts from the Accepted Baseline plus applicable Memory Brief, keeps proven changes, and rebuilds failed changes using the rejected candidate's lessons.

Record compact learning evidence: `Keep`, `Rebuild`, `Drop`, and `Unknown`, then return any reusable lesson as a graph candidate. Repeated correction of the same failure class triggers a check of baseline, scope, prior memory, and approach before another attempt.

### 3. Dispatch
Dispatch role `EXECUTION` only when the work is Low-ready: one concrete outcome and executable first action; no unresolved product or architecture decision; explicit scope, touch boundaries, and non-goals; objective DOD, tests/smoke/evidence, and acceptance oracle; current baseline plus required data, access, and environment; and compact material `CONSULT` triggers.
If any item is missing, the orchestrator resolves it, re-briefs or splits the card, or launches `DISCOVERY`. Consultation is a safety valve for a newly discovered boundary, not a substitute for task design.

The minimum role-`EXECUTION` task contract contains:

- Goal and DOD impact;
- Scope, out of scope, outcome owner, and dependency/recipient boundary;
- Scope freshness, Accepted Baseline, accepted mechanism, and no more than seven executable Memory Brief items;
- Product loop or linked enabling contract; an enabler states `Unlocks`, `Still missing`, and the next product slice;
- Authority/safety envelope and human checkpoint;
- Burn / stop and expansion appetite when material;
- Verification and completion route;
- Narrow Consult when / Return to, triggered only by a named human checkpoint, irreducible blocker, or terminal result.

Keep raw Project State, Touch Set, transcripts, full memory views, task map, and orchestration deliberation outside the task. Before launch the orchestrator records one `PREPARED` Execution Lease with work identity, owner/context, exact base, profile, DOD contribution, review-by, and return route; duplicate launch is blocked while disposition is unresolved. It reads back title/link/profile/base and the first safe observable action before `STARTED`. Plan-only is not progress; after one direct execute-or-block repair, a repeated plan-only result is `EXECUTION_STALLED` and routes replacement or re-brief from durable evidence.

### 4. Execute

The task context starts with a safe observable action instead of repeating approved planning. It owns local implementation, debugging, tests, corrective fixes, and durable checkpoints; it resolves ordinary failures inside scope and burn until a named human checkpoint, irreducible blocker, or terminal result. It does not run project launch, shaping, alignment, orchestration, or Governor workflows.

At an undeclared scope, authority, safety, shared mechanism/contract, ownership overlap, stale upstream state, unresolved solution choice, impossible DOD, or repeated no-progress boundary, the task sends one `CONSULT`: `Boundary`, `Evidence`, `Proposed move`, and `Safe continuation`, then pauses only that boundary. The orchestrator retrieves only the needed durable truth and decides `CONTINUE`, `PATCH_REQUIRED`, `REBRIEF_REQUIRED`, `DISCOVERY`, or `NEEDS_DECISION`; Peer Compass Review may support that route. A support, demo, review, or transport task never acquires product DOD or burn merely because its files are isolated.
Do not mechanically escalate a struggling task through reasoning levels. First distinguish an implementation defect, a weak acceptance oracle, and missing solution work. Rebuild from the Accepted Baseline with learned evidence, re-brief, or launch bounded Discovery. High-consequence execution may still use the efficient profile only with explicit invariants, deterministic guards, and maximum-profile orchestrator review of evidence and project coherence before human merge or action approval; task acceptance stays in the task.

At a declared return trigger, the task first writes one compact Return Sync with a unique receipt id and `NO_MEMORY_DELTA`, task-local evidence, or reusable candidates to the durable task/tracker outbox, then sends the same id as a native wakeup. The orchestrator reconciles `WRITTEN -> SENT -> RECEIVED -> CONSUMED -> ROUTED` on every cold path and Governor Check, so a lost message cannot lose the result or require human polling. It verifies sender, evidence, DOD route, and next action before closing the lease. Cross-person delivery still requires exact artifact/revision, environment, reproducible safe data when relevant, recipient access, and the agreed check. A monitor is only fallback when neither normal route exists.

### 5. Align

Use `$daily-alignment` only in an orchestrator after a meaningful meeting or external event that materially changes another participant's safe next action. Task-local debugging, routine progress, urgency, a locally resolved blocker, and ordinary continue are not alignment events.

Missing participants do not block unrelated work. Work touching their active surface or contract continues only within explicit cautions or waits for their packet.

Intersect each material delta with active, queued, and paused tasks. Leave unaffected tasks asleep. Send an affected active task only `what changed / applies to / preserved / action`: compatible work continues; an invalidating change pauses only the affected boundary for `PATCH_REQUIRED` or `REBRIEF_REQUIRED`. Tasks never process raw meeting inputs.

### 6. Accept

The owning task context runs `$accept-work` before completion. It compares the Candidate with its contract, Accepted Baseline, direct human corrections, targeted orchestrator patches, product loop, burn, tests, smoke evidence, and every executable Memory Brief item as applied, missed, contradicted, or not exercised; it does not reconstruct unrelated project memory. Material deltas are `Inherited`, `Deliberately changed`, or `Unexpectedly changed`; unexplained unexpected change is `NEEDS_FIXES`.

Verify the risks changed by the Candidate. For runtime, integration, or state changes, smoke the exact branch, worktree, commit, frontend, backend, and browser target being accepted; do not use an old server or another branch. Avoid a paid setup path when an equivalent controlled entry proves the changed risk and that paid path did not change. For zero-spend or no-mutation work, disable the dangerous capability when practical and prove before/after counters; any breach remains disclosed and cannot be reported as zero. Product capability is not closed by backend state, UI shell, lab proof, or an enabler without its named product continuation.

After acceptance and the required human checkpoint, promote the Candidate to Accepted Baseline. A rejected candidate remains evidence only. Merge manually through the task context, which writes its terminal Return Sync to the durable outbox before wakeup. Before merge, deploy, spend, or shared-state mutation, write an Action Receipt and read back owning acceptance plus fresh exact actor, environment, revision, permitted mutation, and stop conditions. The orchestrator integrates reusable meaning, turns a miss into a retrieval regression, updates the DOD Control Line and affected work, then closes the lease only after the return is routed.

### 7. Review Health

Project Guard is an operation, not a permanent context. One project-owned runner outside the orchestrator invokes deterministic `guard-check` from activation, dispatch/material resume, Return Sync written, human correction/detour, lease review due, milestone/update, context-loss signals, and an independent timer. Healthy checks and unchanged delivered incidents are silent and model-free; waiting durable work produces one idempotent wakeup, while anomaly or an unresolved repeat incident starts a fresh maximum-profile Governor. It reads durable state and actual context metadata independently and returns `HEALTHY`, bounded `REPAIR`, or confirmed-path `ROTATE` without project work. Before intervention it preserves any Pending Human Action; afterward the orchestrator restores that plain-language request or explicitly supersedes it. A broader Health Review remains for several slices, stalled DOD burn, recurring expansion/tax, owner dropout, memory quality, and work hygiene.

Check progress toward compass and DOD; blockers, repeated costs, and technical slicing without product progress; unexpected expansion or recurring architecture/data/tooling tax; stale scope, competing candidates, corrections built on rejected work, research or lab outputs missing from the real path, trapped decisions, tracker truthfulness, graph quality and retrieval, and whether the active orchestrator should rotate. After adoption into an existing project or a proven memory miss, route a bounded read-only memory backfill from the accepted brief or earliest reliable baseline: compare high-signal human corrections, meeting decisions, pivots, open recall commitments, checkpoints, and accepted lessons with current memory; let later evidence supersede earlier meaning; deeply inspect only missing, ambiguous, or conflicting clusters; and test them through ordinary future-work queries before human-confirmed integration. Include a `Work Hygiene Check` across every live task, PR, branch, context, worktree, runtime, and monitor that exists: each needs an owner, relation to the current goal/DOD, state, and exit or re-entry trigger, then is classified `ACTIVE`, `WAITING`, `FINISH`, `SALVAGE`, or `RETIRE`. Shared artifacts come from shared metadata; local-only artifacts come from their owner's focused maintenance task, so one machine never claims global cleanliness. Age is a review signal, never deletion authority or a fixed branch limit. The orchestrator only classifies, routes, and stores the check date plus unresolved exceptions in Project State; owning or focused tasks inspect and clean. Preserve evidence and unique work, salvage useful stale work onto the current Accepted Baseline instead of reviving it wholesale, and keep artifact inventory out of the semantic graph except for reusable decisions and lessons.

## Humans As Agents

Humans are event-driven participants in the system, not its hidden schedulers. When human action is required, the orchestrator states who acts, what judgment that person owns, what to inspect or decide, the exact link/task/prompt, where the result will be written, what may continue, and what Return Sync resumes the flow. It stores that request as one Pending Human Action until answered, combined, or explicitly superseded; Guard, repair, rotation, and unrelated returns cannot bury it. Agents own technical verification; humans receive observable product, visual, spend, external-action, smoke, or merge questions that fit their role.

Every task declares one `Human checkpoint`: `none`, `product decision`, `visual review`, `paid or external action approval`, or `manual smoke and merge`.

The orchestrator should not say that a human is unnecessary when a named checkpoint is still ahead.

## Asynchronous Collaboration

Keep one authoritative current dashboard snapshot and create linked artifacts only when their trigger exists:

- Project State: the required compass, DOD, participant registry, active orchestrator contexts, current tasks, and latest alignment state.
- Alignment Window: use when meeting, milestone, or local-work packets need reconciliation.
- Project Memory Graph: one compact current graph of stable anchors, atomic invariants, decisions, lessons, future ideas, safe pointers, typed relations, and retrieval scenarios. Existing graphs, Idea Memory, and Intent Trail are migration inputs, not parallel active truth.

The participant registry includes: participant and role/decision scope, backup or absence route, orchestrator context link, installed framework and `doctor` check, resolved profile, repo/tracker/input access, self-published readiness receipt, latest packet, active task, availability, and status. One machine never certifies another.

Before dispatch or material resume on a shared surface, each participant's orchestrator checks its registry row and publishes a packet only when local or meeting state materially changed. Ordinary execution inside a current contract does not create a packet. Never invent another participant's uncommitted state.

The task issue body is its one current execution contract; comments are evidence. The shared tracker is a human-readable projection of Project State and current issues, not a second planner. Use `Todo -> Next -> In Progress -> In Review -> Done`, plus `Blocked` and `Parked`, with owner, priority, formal parent/dependencies where supported, milestone or delivery window, checkpoint, and PR/artifact. Keep compact views for current work, roadmap, parked work, recent completion, and control; use fixed sprints only when the team actually works that way.
At dispatch, material re-brief, blocker, acceptance, and close, update the task contract, Project State, and tracker projection together before announcing the new state. Routine progress does not rewrite dashboards or Alignment. When publishing a Team Alignment Delta or graph change, rebuild its affected current view in the same operation. Link history instead of retaining stale or conflicting sections and rotate an Alignment Window when it stops being quickly scannable.

## Meetings
Meetings, recordings, transcripts, team chats, and notes are one coordination input layer. They are raw until directly accessible orchestrators or one named intake owner distills them into a traceable shared delta and a human approves changes to compass, scope, sequence, ownership, or DOD.

After a meeting, one short request such as `run daily alignment` should be enough. The orchestrator reads the available source, updates durable state, asks for missing packets only where they matter, and returns continue, continue with cautions, wait, or blocked.

## Peer Compass Review

Propose Peer Compass Review when tasks, PRs, product surfaces, contracts, or DOD rows overlap across owners. The orchestrator prepares the review request and tells the human whom to contact, what to inspect, where to return the packet, and what may continue meanwhile.

## Monitor Contract

- One monitor follows one named gate or active stream.
- While state is unchanged and work remains inside scope, create no context message, no-op trace, or model wake-up.
- Notify only on a blocker, decision, drift, human checkpoint, or terminal result.
- Do not create new scope, merge, spend money, or reinterpret the compass from a monitor.
- Update a monitor when its gate changes; do not stack duplicate monitors.
- Delete it at terminal state or when it no longer produces a useful action.

## Orchestrator Rotation

One active orchestrator is authoritative for one participant and stream. Rotation is a two-phase handoff with a visible cutover, not an automatic replacement:

1. Before starting, tell the human why rotation is recommended, what will move, what will remain unchanged, how memory will be checked, and that one explicit confirmation will activate the replacement.
2. Keep the previous orchestrator context active, intact, and linked. It publishes a Rotation Memory Packet covering compass/DOD, decision families and material task-local pivots, queued/promised/deferred work, remembered requests, safe operational pointers, monitors/follow-ups, checkpoints, participants, and ambiguous or stale items.
3. Rebuild stale memory bodies from evidence, group related decisions, and compare with Project State, issues/PRs, project instructions/docs, repository state, and available context history. Classify each item as already durable, missing durable state, ambiguous, or stale/superseded.
4. Create the candidate orchestrator from the current repo/framework in read-only mode. It independently checks Project State v2, DOD Control Line, unresolved leases, Pending Return Inbox, detour gates, high-signal human sources, and graph v3, then reconstructs executable briefs for current, upcoming, and prior-miss Touch Sets. Matching ids or packet-to-dashboard consistency alone is not memory coverage.
5. Put still-current missing items into their correct durable source only after the human sees the coverage delta; do not mass-create tasks or silently promote old ideas.
6. Ask the human to confirm the active switch. Until confirmation, the candidate must not dispatch new work and the active pointer does not change.
7. After confirmation, register the candidate as active, retarget every unresolved lease and durable/native return route, reconcile the Pending Return Inbox, move monitors, bring the new context forward, and publish one clear activation message.
8. Rename the previous context as retired/superseded, unpin it, and make its final message a prominent localized notice that it must not receive new work and links to the active orchestrator. Keep it accessible as unpinned history; never delete or archive it automatically.
9. Report rotation complete only after Project State, context links, pin state, titles, return routes, and the previous context's final notice agree. When the environment cannot control these surfaces, give the human one exact action and mark cutover visibility incomplete rather than hiding the limitation.

If the previous orchestrator is unavailable, mark recovery as incomplete, preserve safe boundaries, and ask the human before claiming full memory coverage or changing shared direction.

## Rules

- On the first active orchestrator use after that participant's framework check becomes 24 hours old, compare the installed version with canonical upstream. Stay silent when current; when newer, read every release where `installed < release <= latest` from oldest to newest, report the range and one short delta per release, then record the combined impact, one shared update plan, and the safest window in next-best-action. Prepare or reuse one normal update change at that window; never omit an intermediate release, duplicate the update, overwrite conflicts, merge silently, or change active-task rules mid-flight. An unavailable check remains pending without blocking otherwise safe work.
- Keep the orchestrator organization-only: `ORCHESTRATOR_WORK` may use bounded advisory agents for control decisions, but every material project claim requires accepted work origin. `UNOWNED_PROJECT_WORK` receives one bounded repair; repetition after repair is a rotation signal.
- Keep universal rules in the canonical framework and project rules in the product repo.
- Keep human conversation product-focused; hide branch and worktree mechanics unless they affect a decision or risk.
- Do not start implementation without a goal, boundary, DOD impact, human checkpoint, and verification route.
- Do not claim team alignment while shared repo/tracker or relevant input access is `SYNC_LIMITED`.
- Check scope freshness before dispatch, re-brief, or material resume of stale/paused work; ordinary continue inside a current active contract does not trigger it.
- Treat unexpected task expansion as a diagnostic trigger; do not normalize recurring architecture tax or close containment as root-cause repair.
- Protect the nearest DOD from optional scope growth and preserve reusable decisions, future ideas, pivots, lessons, and safe operational pointers in one Project Memory Graph instead of relying on chat or human recall.
- Keep one Success Line: build successor candidates from the Accepted Baseline plus applicable Memory Brief while carrying forward lessons from rejected candidates.
- Do not close a parent from an accepted sub-slice unless its promised product loop and DOD are closed or explicitly moved out of scope.
- Do not accept Lab Mode as product completion without production transfer and real-flow verification.
- Do not expose secret values, transcripts, private product data, proprietary prompts, or customer information in public framework artifacts or shared memory. A protected pointer stores only owner, protected reference, environment/scope, allowed non-destructive route, last safe check with source, and expiry/re-entry condition; if any required field is missing, mark the affected action `MEMORY_COVERAGE_GAP / BLOCKED` until repaired and rechecked.
- Preserve the framework license, creator metadata, and required notice in installed or redistributed framework copies; they do not claim ownership of project-specific work.
- Route the latest available flagship by role: maximum reasoning for the orchestrator, deep bounded reasoning for Discovery, and efficient bounded reasoning for Execution. Keep all resolved mappings and check date in Project State; do not pin a model version or silently substitute a profile.
- Preserve append-only evidence, but atomically rebuild current dashboards and reject duplicate or contradictory current sections.
- Keep one DOD Control Line, one unresolved Execution Lease per increment, durable-outbox-first Return Sync, explicit detour return gates, and one external Project Guard. Healthy checks stay silent; anomaly routes bounded repair or confirmed rotation even when the orchestrator stops invoking its own rules. People never poll tasks or remember postponed work for the system.
- Prefer next-best-action over status-only reporting.
- Do not switch active orchestrators without a Rotation Memory Packet, candidate Memory Coverage Check, and explicit human confirmation.
## Skills And Human Interface

Canonical repo-scoped skills:

- `$project-launch`: activate a project and create its operating brief.
- `$framework-orchestrator`: coordinate, dispatch, supervise, integrate, and choose next-best-action through hot or cold path.
- `$start-work`: shape a large topic into an epic and task map.
- `$daily-alignment`: reconcile meeting and event changes asynchronously.
- `$accept-work`: accept a task, PR, lab/maintenance result, or product increment in its owning execution context.

The `SKILL.md` contracts own behavior. Environments may expose them as `$skills`, commands, rules, or automatic routes; optional interface metadata does not change their meaning.

People should not need to select skills manually. In the orchestrator context, natural requests are enough:

- `Start this project.`
- `Continue this stream.`
- `Process the latest meeting.`
- `Check the work and continue.`
- `What else could we do here?`

The orchestrator chooses and applies the required skill.
