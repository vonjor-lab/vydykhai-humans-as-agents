# Vydykhai Collaboration Framework

Version: 1.18.0 | Status: canonical operating core

Vydykhai is a framework for collaborative work between people and AI agents. It grew out of collaborative vibe coding, but extends to broader vibe work: helping a group turn an unclear goal into a shared compass, split work without losing coherence, preserve emerging ideas, accept results, and reconverge around the next step. People remain agents of meaning and judgment, while the AI orchestrator maintains the shared picture, sequence, alignment, acceptance, and next-best-action.

## Sources

The framework comes from product meetings and practical work with several humans, repositories, branches, AI agents, long-running tasks, lab experiments, failed handoffs, and expensive restarts. Those lessons shaped the rules below; project-specific details do not belong in this repository.

## Purpose

The framework applies when a shared goal can be shaped into durable briefs, bounded tasks, verifiable results, and accepted next steps. Collaborative vibe coding is its primary proven use; broader vibe work follows the same operating cycle.

Use Vydykhai when several humans and AI agents work asynchronously on one product or shared outcome and can otherwise:

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
- Each participant has one active Framework Orchestrator for a product stream. It organizes work and never implements product code.
- Research, lab, and implementation run in separate focused contexts.
- A shared Git-backed project repo carries the framework and project files. GitHub Issues and PRs are the recommended durable sync space; an equivalent tracker is valid only when every participant and orchestrator can reach the same linked state. Local copies and chat history are evidence, not the source of truth.
- Project Memory Graph links stable product anchors to current decisions, reusable lessons, confirmed future ideas, and safe operational pointers in one compact shared view.
- The orchestrator decides what, why, when, and who, and maintains what changed: compass, sequence, alignment, dispatch, human requests, shared memory, health, parent closure, and next-best-action.
- Task contexts decide how to deliver and prove one accepted increment: local planning, implementation, debugging, corrective fixes, `$accept-work`, exact-current-code smoke, manual merge after human confirmation, and automatic return at declared triggers.
- A task detects an execution boundary; the orchestrator decides the project response. Neither role silently takes over the other's work.
- One accepted increment has one owning execution context and one canonical Candidate unless the brief explicitly defines parallel-safe work. The orchestrator sequences later increments instead of stretching one task across the product route.

An agent context is a logical boundary, not a vendor feature. It may be implemented as a thread, chat, session, run, workspace, or tracker-linked agent.

One active orchestrator does not mean one eternal context. Rotate it when its memory is no longer compact or reliable.

## Activation

The framework is active only when its kit is installed in the target product repository and the agent starts from that repository. The normal human interface is one request to the coding agent attached to the target repo:

```text
Connect Vydykhai to this project and start the orchestrator. Follow BOOTSTRAP.md end to end and ask me only for missing access or a decision: https://github.com/vonjor-lab/vydykhai-humans-as-agents
```

Required launch path:

1. The bootstrap agent identifies the target repo, preserves existing work, installs or updates the kit, and runs `doctor`.
2. It reviews the diff, prepares the setup commit or PR, and keeps project rules outside managed files.
3. It creates Project State and starts a personal Framework Orchestrator context from the target repo.
4. `$project-launch` creates the Project Operating Brief, compass, first DOD, participant registry, Shared Sync Contract, and first route.
5. After the setup change is accepted, every participant pulls it and confirms framework and sync access through their orchestrator.

The bootstrap request authorizes setup branch/PR and shared operating artifacts. It does not authorize merge, destructive overwrite, paid actions, production changes, or disclosure of private data. If tools or access are missing, the agent asks only for that capability instead of delegating setup commands to the human.

Bootstrap maps the current agent environment to project instructions, skill/rule invocation, separate resumable contexts, durable shared state, and execution/verification. If native skill discovery or context creation is unavailable, it creates one thin native adapter that points to the canonical files and records the mapping in Project State. It never copies the operating logic into environment-specific rules.

### Shared Sync Contract
Distributed Vydykhai requires one shared Git-backed project repo and one durable tracker. GitHub with Issues and PRs is the recommended and best-supported default, including for non-code work. An equivalent must provide stable links, history, participant-owned updates, access control, and agent read/write access.
At launch, record and test the repo/tracker, each participant and orchestrator's required access, and the coordination-input route from meetings, recordings, transcripts, chat, docs, or manual notes. Fathom is the recommended meeting recorder when available; Read AI, tl;dv, or another accessible source is valid.
A local notebook such as Obsidian is an input or view unless it is shared, versioned, and agent-accessible. Missing coverage is `SYNC_LIMITED`: name what is invisible, never claim full alignment, and keep overlapping work inside explicit cautions or wait.

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

A human may explicitly override the recommendation. Record the reason, limits, and condition for returning to the normal route. Do not repeat the warning without new evidence or risk.

## Operating Cycle

### 0. Launch

Connect the repo, participants, coordination inputs, source of truth, privacy rules, compass, and first DOD. Register each active orchestrator context in Project State.

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

New ideas must not delay the nearest DOD, useful ideas must not disappear, and meaningful intent, decisions, lessons, and operational knowledge must survive people, tasks, and orchestrator changes. Project State is current working memory; one shared Project Memory Graph is reusable semantic and decision memory; raw history is linked evidence; each task receives only a working capsule. Sensitive values stay in protected systems as safe pointers.

- A missing requirement is a DOD gap; a required safety, quality, or product boundary is a guardrail. Keep both in the task or re-brief.
- A deliberate change to the promised outcome requires a visible human scope decision and updated DOD, burn, and sequence.
- A useful extension not needed for the current DOD stays out of the task. After human confirmation, store it as an `IDEA` node with value, anchors, source, and recall trigger.
- Give outcomes, actors, entities, surfaces, contracts, data, and operations stable anchors and aliases. Keep one reusable meaning per node: `INVARIANT`, current `DECISION`, failed-path `LESSON`, future `IDEA`, or safe operational `POINTER`, with typed relations, applicability, exceptions, and evidence.

Message length is not a trigger. Explicit remember/important/always/never/do-it-differently language, repeated owner explanation, and accepted pivots trigger Memory Reflection. Before apologizing or patching, the orchestrator records `Before / Now / Why / scope`, retrieves related nodes, and classifies `ABSENT`, `RETRIEVAL_MISS`, `APPLICATION_MISS`, or `VERIFICATION_MISS`; inferred wider intent stays `PROVISIONAL`. It integrates one `ADD / REFINE / SUPERSEDE / RETIRE / CONFLICT / NO_CHANGE` event, reruns retrieval, and checks affected active and queued tasks. Task contexts return candidates but never rewrite shared memory.

At each cold-path brief, re-brief, dispatch, consultation or sequence decision, parent acceptance, milestone, and rotation, the orchestrator resolves exact anchors and aliases from the Touch Set, adds semantic candidates, traverses relevant typed relations one or two hops, and filters by source precedence, status, scope, applicability, and supersession. It returns no more than seven nodes and fewer when fewer apply as executable items: `Because / Apply / Avoid / Verify / Source`; opaque ids alone are invalid. Raise `MEMORY_COVERAGE_GAP` when required meaning is unproven. Re-read the graph watermark before integration, preserve evidence, and do not repeat retrieval on a hot-path continue.

### 2. Route

Choose the smallest useful context:

- Orchestrator Work: project-wide synthesis, prioritization, sequencing, or an owner decision stays in the `ORCHESTRATOR` control context.
- Research Context: a bounded product or technical question is not ready for a brief. Run it as `DISCOVERY`, make no product-code changes, return a short Decision Packet, and close or archive the context after incorporation.
- Lab Mode: isolated implementation or experimentation reduces risk, cost, or time-to-feedback. Define the decision, Accepted Baseline, one main variable, human-verifiable proof, stop/burn limit, and promote/reject/re-brief route before starting. Exit through production transfer, tests, and risk-based real-flow smoke.
- Task Context: the outcome and acceptance boundary are clear enough for `EXECUTION` in the real product path.
- Stale Or Re-brief: the current card is outdated, mixed, too broad, contradictory, or missing required inputs. Revise or split it before creating a task context.

Research reduces uncertainty. Lab reduces execution cost. A task delivers accepted product or enabling work.
A Discovery Decision Packet names the chosen approach, material rejected options and lessons, affected entities or interfaces, acceptance or visual evidence, risks, and unresolved owner decisions. The orchestrator integrates it with the compass and memory before writing execution tasks. Discovery does not produce production implementation by default; a disposable lab artifact must be explicit.

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

Keep raw Project State, Touch Set, transcripts, full memory views, task map, and orchestration deliberation outside the task. The task continues the accepted mechanism by default; a new shared mechanism or system change must be explicit or resolved through consultation. Add Lab Mode, Peer Compass Review, model profile, or detailed contracts only when relevant. Before patching a running task, the orchestrator reads events newer than its last Return Sync and reconciles newer human direction. It creates or prepares the context, verifies its title/handle and link, and checks that execution started. A plan-only child response is not progress.

### 4. Execute

The task context starts implementation instead of repeating approved planning. It owns local implementation planning, debugging, tests, and corrective fixes, resolves ordinary failures autonomously inside scope and burn, and continues until a named human checkpoint, irreducible blocker, or terminal result. It does not run project launch, shaping, alignment, or orchestration workflows.

At an undeclared scope, authority, safety, shared mechanism/contract, ownership overlap, stale upstream state, unresolved solution choice, impossible DOD, or repeated no-progress boundary, the task sends one `CONSULT`: `Boundary`, `Evidence`, `Proposed move`, and `Safe continuation`, then pauses only that boundary. The orchestrator retrieves only the needed durable truth and decides `CONTINUE`, `PATCH_REQUIRED`, `REBRIEF_REQUIRED`, `DISCOVERY`, or `NEEDS_DECISION`; Peer Compass Review may support that route. A support, demo, review, or transport task never acquires product DOD or burn merely because its files are isolated.
Do not mechanically escalate a struggling task through reasoning levels. First distinguish an implementation defect, a weak acceptance oracle, and missing solution work. Rebuild from the Accepted Baseline with learned evidence, re-brief, or launch bounded Discovery. High-consequence execution may still use the efficient profile only with explicit invariants, deterministic guards, and maximum-profile orchestrator review of evidence and project coherence before human merge or action approval; task acceptance stays in the task.

At a declared return trigger, the task publishes one compact Return Sync with `NO_MEMORY_DELTA`, `task-local only`, or reusable graph candidates without waiting for human polling. It sends no routine progress return for a locally resolved failure. Use native cross-context messaging when available; otherwise use the shared tracker event/hook. Cross-person delivery is complete only after recipient access to the exact artifact/revision and the agreed check. Runnable data-backed work also proves exact environment, schema/migration revision, reproducible safe test data, and recipient access. Missing required data makes the handoff `BLOCKED`, not evidence of product failure; never copy production data or secrets into framework memory. A monitor is only the fallback when neither return route can wake the orchestrator.

### 5. Align

Use `$daily-alignment` only in an orchestrator after a meaningful meeting or external event that materially changes another participant's safe next action. Task-local debugging, routine progress, urgency, a locally resolved blocker, and ordinary continue are not alignment events.

Missing participants do not block unrelated work. Work touching their active surface or contract continues only within explicit cautions or waits for their packet.

Intersect each material delta with active, queued, and paused tasks. Leave unaffected tasks asleep. Send an affected active task only `what changed / applies to / preserved / action`: compatible work continues; an invalidating change pauses only the affected boundary for `PATCH_REQUIRED` or `REBRIEF_REQUIRED`. Tasks never process raw meeting inputs.

### 6. Accept

The owning task context runs `$accept-work` before completion. It compares the Candidate with its contract, Accepted Baseline, direct human corrections, targeted orchestrator patches, product loop, burn, tests, smoke evidence, and every executable Memory Brief item as applied, missed, contradicted, or not exercised; it does not reconstruct unrelated project memory. Material deltas are `Inherited`, `Deliberately changed`, or `Unexpectedly changed`; unexplained unexpected change is `NEEDS_FIXES`.

Verify the risks changed by the Candidate. For runtime, integration, or state changes, smoke the exact branch, worktree, commit, frontend, backend, and browser target being accepted; do not use an old server or another branch. Avoid a paid setup path when an equivalent controlled entry proves the changed risk and that paid path did not change. For zero-spend or no-mutation work, disable the dangerous capability when practical and prove before/after counters; any breach remains disclosed and cannot be reported as zero. Product capability is not closed by backend state, UI shell, lab proof, or an enabler without its named product continuation.

After acceptance and the required human checkpoint, promote the Candidate to Accepted Baseline. A rejected candidate remains evidence only. Merge manually through the task context, which publishes its terminal Return Sync with `NO_MEMORY_DELTA` or compact memory candidates and any brief miss. The orchestrator integrates reusable meaning, turns a miss into a retrieval regression scenario, and updates affected tasks, DOD burn, alignment, parent closure, tracker projection, and next-best-action without repeating acceptance.

### 7. Review Health

Run a short Health Review after a milestone, several accepted slices, repeated follow-ups, unexpected expansion, stalled DOD burn, owner dropout, repeated context compaction, or when work starts relying on chat archaeology.

Check progress toward compass and DOD; blockers, repeated costs, and technical slicing without product progress; unexpected expansion or recurring architecture/data/tooling tax; stale scope, competing candidates, and corrections built on rejected work; research or lab outputs missing from the real path; stale operational artifacts or trapped decisions; atomic graph anchors/nodes, duplicate or conflicting meaning, Memory Misses, and fresh-evaluator retrieval scenarios; tracker truthfulness; and whether the active orchestrator should rotate.

## Humans As Agents

Humans are event-driven participants in the system, not its hidden schedulers. When human action is required, the orchestrator states who acts, what judgment that person owns, what to inspect or decide, the exact link/task/prompt, where the result will be written, what may continue, and what Return Sync resumes the flow. Agents own technical verification; humans receive observable product, visual, spend, external-action, smoke, or merge questions that fit their role.

Every task declares one `Human checkpoint`: `none`, `product decision`, `visual review`, `paid or external action approval`, or `manual smoke and merge`.

The orchestrator should not say that a human is unnecessary when a named checkpoint is still ahead.

## Asynchronous Collaboration

Keep one authoritative current dashboard snapshot and create linked artifacts only when their trigger exists:

- Project State: the required compass, DOD, participant registry, active orchestrator contexts, current tasks, and latest alignment state.
- Alignment Window: use when meeting, milestone, or local-work packets need reconciliation.
- Project Memory Graph: one compact current graph of stable anchors, atomic invariants, decisions, lessons, future ideas, safe pointers, typed relations, and retrieval scenarios. Existing graphs, Idea Memory, and Intent Trail are migration inputs, not parallel active truth.

The participant registry includes: participant, orchestrator context link, installed framework version, resolved orchestrator profile and check date, latest packet, active task, and status.

Before dispatch or material resume on a shared surface, each participant's orchestrator checks its registry row and publishes a packet only when local or meeting state materially changed. Ordinary execution inside a current contract does not create a packet. Never invent another participant's uncommitted state.

The task issue body is its one current execution contract; comments are evidence. The shared tracker is a human-readable projection of Project State and current issues, not a second planner. Use `Todo -> Next -> In Progress -> In Review -> Done`, plus `Blocked` and `Parked`, with owner, priority, formal parent/dependencies where supported, milestone or delivery window, checkpoint, and PR/artifact. Keep compact views for current work, roadmap, parked work, recent completion, and control; use fixed sprints only when the team actually works that way.
At dispatch, material re-brief, blocker, acceptance, and close, update the task contract, Project State, and tracker projection together before announcing the new state. Routine progress does not rewrite dashboards or Alignment. When publishing a Team Alignment Delta or graph change, rebuild its affected current view in the same operation. Link history instead of retaining stale or conflicting sections and rotate an Alignment Window when it stops being quickly scannable.

## Meetings
Meetings, recordings, transcripts, team chats, and notes are one coordination input layer. They are raw inputs until the orchestrator distills them into the shared tracker and a human approves changes to compass, scope, sequence, ownership, or DOD.

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
4. Create the candidate orchestrator from the current repo/framework in read-only mode. It independently checks durable state, high-signal human sources, and task Return Syncs, then reconstructs expected executable briefs for representative current, upcoming, and prior-miss Touch Sets. It must recover applicable decisions, rejected paths, ideas, operational pointers, and acceptance implications; matching ids or packet-to-dashboard consistency alone is not memory coverage.
5. Put still-current missing items into their correct durable source only after the human sees the coverage delta; do not mass-create tasks or silently promote old ideas.
6. Ask the human to confirm the active switch. Until confirmation, the candidate must not dispatch new work and the active pointer does not change.
7. After confirmation, register the candidate as active, move return routes and monitors away from the previous context, bring the new context forward, pin it when supported, and publish one clear activation message with its link and next-best-action.
8. Rename the previous context as retired/superseded, unpin it, and make its final message a prominent localized notice that it must not receive new work and links to the active orchestrator. Keep it accessible as unpinned history; never delete or archive it automatically.
9. Report rotation complete only after Project State, context links, pin state, titles, return routes, and the previous context's final notice agree. When the environment cannot control these surfaces, give the human one exact action and mark cutover visibility incomplete rather than hiding the limitation.

If the previous orchestrator is unavailable, mark recovery as incomplete, preserve safe boundaries, and ask the human before claiming full memory coverage or changing shared direction.

## Rules

- On the first active orchestrator use after that participant's framework check becomes 24 hours old, compare the installed version with canonical upstream. Stay silent when current; when newer, read every release where `installed < release <= latest` from oldest to newest, report the range and one short delta per release, then record the combined impact, one shared update plan, and the safest window in next-best-action. Prepare or reuse one normal update change at that window; never omit an intermediate release, duplicate the update, overwrite conflicts, merge silently, or change active-task rules mid-flight. An unavailable check remains pending without blocking otherwise safe work.
- Keep the orchestrator organization-only.
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
- Do not expose secret values, transcripts, private product data, proprietary prompts, or customer information in public framework artifacts or shared memory. Store only least-privilege pointers to protected secret systems and private operational runbooks.
- Preserve the framework license, creator metadata, and required notice in installed or redistributed framework copies; they do not claim ownership of project-specific work.
- Route the latest available flagship by role: maximum reasoning for the orchestrator, deep bounded reasoning for Discovery, and efficient bounded reasoning for Execution. Keep all resolved mappings and check date in Project State; do not pin a model version or silently substitute a profile.
- Preserve append-only evidence, but atomically rebuild current dashboards and reject duplicate or contradictory current sections.
- Return declared human checkpoints, irreducible blockers, and terminal task results to the orchestrator automatically; do not make people poll contexts or sync routine progress.
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
