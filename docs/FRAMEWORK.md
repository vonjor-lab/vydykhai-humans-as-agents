# Vydykhai Collaboration Framework

Version: 1.10.0
Status: canonical operating core

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
- Idea Memory keeps confirmed useful ideas outside current scope and recalls them when planning touches the relevant product surface.
- Task contexts own implementation, corrective fixes, `$accept-work`, exact-current-code smoke, manual merge after human confirmation, and automatic return sync to the orchestrator.
- The orchestrator owns sequence, alignment, task dispatch, human requests, health checks, and next-best-action.
- One product phase has one active implementation context and one canonical candidate unless the brief explicitly defines parallel-safe work.

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

## Agent Profile

The default policy is `latest available flagship / deepest bounded reasoning`: the strongest broadly capable coding and agentic model available to that participant, with the deepest stable reasoning mode inside the agreed burn boundary.

- Resolve by current agent-environment availability and current authoritative model guidance, not by version number alone.
- Record the policy, resolved model id, reasoning effort, check date/source, and fallback in Project State.
- Re-resolve at bootstrap, framework update, new or rotated orchestrator, model rejection/deprecation, and active-project Health Review at least every seven days.
- Pass the resolved profile explicitly to new and resumed contexts when tools support it.
- If discovery is unavailable, use the agent environment's recommended flagship and mark verification pending.
- Map the policy to Extra High / `xhigh` when that label exists. Otherwise use the closest supported bounded mode and record it; do not automatically choose Max, Ultra, or an unbounded tier.
- Never silently downgrade. A human may explicitly choose a cheaper or faster profile for a named scope.

Universal rules never pin today's model id, allowing the project to adopt a future flagship without a framework release.

## Source Precedence

When sources disagree, use this order:

1. The latest explicit human decision for the affected scope.
2. The approved compass, brief, DOD, Brief Patch, or Team Alignment Delta.
3. Current task issue, PR, accepted artifact, and verified repository state.
4. Agent plans, summaries, and handoffs.
5. Inference from code, chat history, or local state.

An agent plan never overrides a later human correction. Record the correction in durable state before dependent work continues. Stop only the affected scope; unrelated work may continue within named boundaries.

## Proactive Guardrails

Framework rules are active guidance, not hidden compliance. When a human or agent proposes a route that conflicts with a rule, the orchestrator or task context should politely state:

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

Before dispatching or resuming work, compare the task with the latest DOD and decisions, upstream results, affected entities and contracts, active work, Idea Memory, and current code.

- `UNCHANGED`: the contract is still current.
- `PATCH_REQUIRED`: a bounded Brief Patch is required.
- `REBRIEF_REQUIRED`: goal, DOD, sequence, ownership, or core assumptions must be shaped again.

Age triggers re-reading, not automatic scope change. Seven days without a freshness check is the default signal unless the project sets another interval. Approve a material patch or re-brief before implementation or burn continues.

### Expansion Check
Task size is a signal, not a verdict. Run an Expansion Check and pause only affected growth when first human-verifiable evidence misses the agreed appetite, a local goal crosses unplanned layers or contracts, the same incidental platform problem recurs across tasks, a second same-class correction appears, or data/operating cost grows without DOD movement.
State `Expected`, `Expanded into`, `Likely cause`, and one route:
- `CONTINUE`: the cross-cut is necessary; approve the updated boundary and appetite.
- `REBRIEF`: several outcomes were mixed; restore one product result and sequence the rest.
- `LAB`: the hypothesis can be proved more cheaply outside the full product path, with a defined production exit.
- `MAINTENANCE`: recurring architecture, data, or tooling friction should be removed before affected delivery continues.
Maintenance must name the friction source, preserve the Accepted Baseline, change the smallest shared cause, prove the original representative flow became materially smaller or faster, test against recurrence, and return explicitly to the original task. Backup, cleanup, migration, or a cap contains impact but does not close the debt unless the recurrence source is removed or deliberately deferred. Set appetite from the task and repository; file, line, or time counts are warnings, never universal verdicts.

### DOD Focus And Idea Memory

New ideas must not delay the nearest DOD, and useful ideas must not disappear. People may say everything they consider important; the orchestrator separates what is required now from what should be remembered.

- A missing requirement for the promised outcome is a DOD gap, not a future idea. Keep it in the task or re-brief.
- A safety, quality, or product boundary required for correct delivery is a guardrail, not optional scope.
- A deliberate change to the promised outcome requires a visible human scope decision and updated DOD, burn, and sequence.
- A useful extension that is not needed for the current DOD should stay out of the task. After human confirmation, upsert it into shared Idea Memory with its value, affected surfaces, source, and recall trigger.

At every brief, re-brief, sequence decision, and milestone plan, compare the touched outcome, entities, surfaces, contracts, and DOD rows with Idea Memory and active work. For each match, recommend one action: use as a guard, shape separately, keep remembered, or retire as absorbed, duplicated, or superseded. Record the compact result in the planning checkpoint; never turn an idea into scope or a task silently.

When a person asks what else could be done, return the relevant current ideas filtered by the named topic, horizon, or compass. Do not make the person search the memory artifact or read its full archive.

### 2. Route

Choose the smallest useful context:

- Research Context: a bounded product or technical question is not ready for a brief. No product-code changes. Return a short Research Packet and close or archive the context after incorporation.
- Lab Mode: isolated implementation or experimentation reduces risk, cost, or time-to-feedback. Define the decision, Accepted Baseline, one main variable, human-verifiable proof, stop/burn limit, and promote/reject/re-brief route before starting. Exit through production transfer, tests, and risk-based real-flow smoke.
- Task Context: the outcome and acceptance boundary are clear enough to implement in the real product path.

Research reduces uncertainty. Lab reduces execution cost. A task delivers accepted product or enabling work.

### One Success Line

Build from success; learn from failure.

- `Accepted Baseline` is the last proven working state.
- `Candidate` is the current proposed delta.
- `Rejected Candidate` is evidence, never the implicit base for another correction.
- A successor starts from the Accepted Baseline, keeps proven changes, and rebuilds failed changes using the rejected candidate's lessons.

Record a compact Learning Delta: `Keep`, `Rebuild`, `Drop`, and `Unknown`. Repeated correction of the same failure class triggers a check of baseline, scope, and approach before another attempt.

### 3. Dispatch

The minimum task contract contains:

- Goal and DOD impact;
- Scope and out of scope;
- Scope freshness and Accepted Baseline;
- Product loop or linked enabling contract;
- Human checkpoint;
- Burn / stop and expansion appetite when material;
- Verification and completion route;
- Return destination and event triggers.

Add Lab Mode, Peer Compass Review, model profile, or detailed contracts only when relevant. The orchestrator creates or prepares the task context, verifies its title or stable handle, records its link, and checks that execution started. A plan-only child response is not progress.

### 4. Execute

The task context starts implementation instead of repeating approved planning, then continues autonomously until a human checkpoint, real blocker, or terminal result. It returns for re-brief when the goal, source of truth, shared contract, burn cap, or freshness status changes.

At every checkpoint, blocker, or terminal result, the task context publishes a compact Return Sync without waiting for a human prompt. Use native cross-context messaging when available; otherwise write the result to the shared tracker and trigger the available event or hook. A monitor is only the fallback when neither route can wake the orchestrator.

### 5. Align

Use `$daily-alignment` after a meaningful meeting or event that changes another participant's safe next action. Publish the participant's local packet, reconcile relevant packets, rebuild the current dashboard, and state what can continue.

Missing participants do not block unrelated work. Work touching their active surface or contract continues only within explicit cautions or waits for their packet.

Mark affected queued or paused tasks `PATCH_REQUIRED` or `REBRIEF_REQUIRED` when the event makes their contracts stale.

### 6. Accept

The task context runs `$accept-work` before completion. Acceptance compares the Candidate with its Accepted Baseline, the latest human decision, brief, DOD, deltas, product loop, burn, tests, and smoke evidence.

Verify the risks changed by the Candidate. For runtime, integration, or state changes, smoke the exact branch, worktree, commit, frontend, backend, and browser target being accepted; do not use an old server or another branch. Avoid a paid setup path when an equivalent controlled entry proves the changed risk and that paid path did not change. Product capability is not closed by backend state, UI shell, or lab proof alone.

After acceptance and the required human checkpoint, promote the Candidate to Accepted Baseline. A rejected candidate remains evidence only. Merge manually through the task context, which publishes its terminal Return Sync; the orchestrator then updates DOD burn, alignment, parent closure, and next-best-action.

### 7. Review Health

Run a short Health Review after a milestone, several accepted slices, repeated follow-ups, unexpected expansion, stalled DOD burn, owner dropout, repeated context compaction, or when work starts relying on chat archaeology.

Check progress toward compass and DOD; blockers, repeated costs, and technical slicing without product progress; unexpected expansion or recurring architecture/data/tooling tax; stale scope, competing candidates, and corrections built on rejected work; research or lab outputs missing from the real path; stale operational artifacts or trapped decisions; Idea Memory hygiene; and whether the active orchestrator should rotate.

## Humans As Agents

Humans are event-driven participants in the system, not its hidden schedulers. When human action is required, the orchestrator states who acts, what to inspect or decide, the exact link/task/prompt, where the result will be written, what may continue, and what Return Sync resumes the flow.

Every task declares one `Human checkpoint`: `none`, `product decision`, `visual review`, `paid or external action approval`, or `manual smoke and merge`.

The orchestrator should not say that a human is unnecessary when a named checkpoint is still ahead.

## Asynchronous Collaboration

Keep two required durable artifacts and one optional memory artifact:

- Project State: compass, DOD, participant registry, active orchestrator contexts, current tasks, and latest alignment window.
- Alignment Window: append-only packets and deltas for one meeting, milestone, or compact work period.
- Idea Memory: a compact current view of confirmed useful ideas that are not tasks or current scope. Create it when the first idea must be remembered and link it from Project State.

The participant registry includes: participant, orchestrator context link, installed framework version, resolved agent profile and check date, latest packet, active task, and status.

Before starting or resuming work on a shared surface, each participant's orchestrator checks its registry row and publishes a new packet when local or meeting state materially changed. Never invent another participant's uncommitted state.

When publishing a Team Alignment Delta, rebuild the issue body in the same operation. Rotate the Alignment Window after a milestone or when it stops being quickly scannable; link the archived window from Project State.

## Meetings

Meetings, recordings, transcripts, team chats, and notes are one coordination input layer. They are raw inputs until the orchestrator distills them into the shared tracker and a human approves changes to compass, scope, sequence, ownership, or DOD.

After a meeting, one short request such as `run daily alignment` should be enough. The orchestrator reads the available source, updates durable state, asks for missing packets only where they matter, and returns continue, continue with cautions, wait, or blocked.

## Peer Compass Review

Propose Peer Compass Review when tasks, PRs, product surfaces, contracts, or DOD rows overlap across owners. The orchestrator prepares the review request and tells the human whom to contact, what to inspect, where to return the packet, and what may continue meanwhile.

## Monitor Contract

- One monitor follows one named gate or active stream.
- Stay quiet while state is unchanged and work remains inside scope.
- Notify only on a blocker, decision, drift, human checkpoint, or terminal result.
- Do not create new scope, merge, spend money, or reinterpret the compass from a monitor.
- Update a monitor when its gate changes; do not stack duplicate monitors.
- Delete it at terminal state or when it no longer produces a useful action.

## Orchestrator Rotation

One active orchestrator is authoritative for one participant and stream. Rotation is a two-phase handoff, not an automatic replacement:

1. Keep the previous orchestrator context active, intact, and linked. It publishes a Rotation Memory Packet covering compass/DOD, decisions, queued/promised/deferred work, human requests to remember, working rules, monitors/follow-ups, checkpoints, participants, and ambiguous or stale items.
2. Compare the packet with Project State, issues/PRs, project instructions/docs, current repository state, and available context history. Classify each item as already durable, missing durable state, ambiguous, or stale/superseded.
3. Create the candidate orchestrator from the current repo/framework in read-only mode. It independently runs Memory Coverage Check and reports omissions, conflicts, and proposed durable destinations.
4. Put still-current missing items into their correct durable source only after the human sees the coverage delta; do not mass-create tasks or silently promote old ideas.
5. Ask the human to confirm the active switch. Until confirmation, the candidate must not dispatch new work and the active pointer does not change.
6. After confirmation, register the candidate as active and keep the previous context as a pinned historical/reference link. Never delete or archive it automatically.

If the previous orchestrator is unavailable, mark recovery as incomplete, preserve safe boundaries, and ask the human before claiming full memory coverage or changing shared direction.

## Rules

- Keep the orchestrator organization-only.
- Keep universal rules in the canonical framework and project rules in the product repo.
- Keep human conversation product-focused; hide branch and worktree mechanics unless they affect a decision or risk.
- Do not start implementation without a goal, boundary, DOD impact, human checkpoint, and verification route.
- Do not claim team alignment while shared repo/tracker or relevant input access is `SYNC_LIMITED`.
- Check scope freshness before dispatch or resume; do not continue material stale scope without an approved patch or re-brief.
- Treat unexpected task expansion as a diagnostic trigger; do not normalize recurring architecture tax or close containment as root-cause repair.
- Protect the nearest DOD from optional scope growth, and preserve confirmed future ideas in Idea Memory instead of relying on chat or human recall.
- Keep one Success Line: build successor candidates from the Accepted Baseline while carrying forward lessons from rejected candidates.
- Do not close a parent from an accepted sub-slice unless its promised product loop and DOD are closed or explicitly moved out of scope.
- Do not accept Lab Mode as product completion without production transfer and real-flow verification.
- Do not expose secrets, transcripts, private product data, proprietary prompts, or customer information in public framework artifacts.
- Preserve the framework license, creator metadata, and required notice in installed or redistributed framework copies; they do not claim ownership of project-specific work.
- Use `latest available flagship / deepest bounded reasoning`, keep the resolved profile and check date in Project State, and make fallback visible. Do not hardcode a model version or vendor-specific reasoning label in universal rules.
- Preserve append-only evidence, but keep current dashboards short and current.
- Return task events to the orchestrator automatically; do not make people poll completed contexts.
- Prefer next-best-action over status-only reporting.
- Do not switch active orchestrators without a Rotation Memory Packet, candidate Memory Coverage Check, and explicit human confirmation.

## Skills And Human Interface

Canonical repo-scoped skills:

- `$project-launch`: activate a project and create its operating brief.
- `$framework-orchestrator`: restore state, coordinate, dispatch, supervise, and choose next-best-action.
- `$start-work`: shape a large topic into an epic and task map.
- `$daily-alignment`: reconcile meeting and event changes asynchronously.
- `$accept-work`: accept a task, milestone, or epic against current intent and evidence.

The `SKILL.md` contracts own behavior. Environments may expose them as `$skills`, commands, rules, or automatic routes; optional interface metadata does not change their meaning.

People should not need to select skills manually. In the orchestrator context, natural requests are enough:

- `Start this project.`
- `Continue this stream.`
- `Process the latest meeting.`
- `Check the work and continue.`
- `What else could we do here?`

The orchestrator chooses and applies the required skill.
