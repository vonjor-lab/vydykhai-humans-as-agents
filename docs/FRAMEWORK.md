# Vydykhai Collaboration Framework

Version: 1.5.0
Status: canonical operating core

Vydykhai is a framework for collaborative vibe coding with humans as agents. People hold product meaning, direction, and judgment. The AI orchestrator turns a raw goal into a compass, briefs, coordinated task threads, alignment, acceptance, and the next-best-action.

## Sources

The framework comes from product meetings and practical work with several humans, repositories, branches, AI agents, long-running tasks, lab experiments, failed handoffs, and expensive restarts. Those lessons shaped the rules below; project-specific details do not belong in this repository.

## Purpose

Use Vydykhai when several humans and AI agents work asynchronously on one product and can otherwise:

- interpret the same goal differently;
- duplicate or invalidate each other's work;
- build plausible technical slices that do not close a user flow;
- lose decisions inside chats, local worktrees, or uncommitted state;
- spend heavily before discovering that the direction was wrong.

The framework should reduce coordination work for people. Humans should discuss the product and make judgments; the orchestrator should maintain sequence, shared memory, handoffs, and gates.

## Diagnosis

Two common modes fail when used alone:

- Manual mode keeps a human beside every agent and stops when the human leaves.
- Epic mode gives an agent a large goal but becomes expensive when the brief, constraints, or checkpoints are weak.

Vydykhai combines them: design the compass and task contract top-down, let agents execute autonomously, and ask humans only at named checkpoints.

## Operating Model

- The product compass holds the goal, users, desired outcome, DOD, non-goals, constraints, and current decisions. It may evolve, but never silently.
- Each participant has one active Framework Orchestrator for a product stream. It organizes work and never implements product code.
- Research, lab, and implementation run in separate focused contexts.
- GitHub issues and PRs, or an equivalent shared tracker, hold durable state. Chat history is evidence, not the source of truth.
- Task threads own implementation, corrective fixes, `$accept-work`, exact-current-code smoke, and manual merge after human confirmation.
- The orchestrator owns sequence, alignment, task dispatch, human requests, health checks, and next-best-action.

One active orchestrator does not mean one eternal thread. Rotate it when its context is no longer compact or reliable.

## Activation

The framework is active only when its kit is installed in the target product repository and the agent session starts from that repository.

Required launch path:

1. Install or update the framework kit in the target repo.
2. Commit the managed framework files and let all participants pull them.
3. Keep project-specific rules outside framework-managed files.
4. Start a personal Framework Orchestrator from the target repo.
5. Run `$project-launch` to create the Project Operating Brief, compass, first DOD, participant registry, shared state location, and first route.

The reference installer is:

```text
node scripts/vydykhai.mjs install /path/to/product-repo
```

From an installed product repo, use `node scripts/vydykhai.mjs doctor` to inspect local integrity and upstream version, and `node scripts/vydykhai.mjs update` to pull the current canonical kit.

## Source Precedence

When sources disagree, use this order:

1. The latest explicit human decision for the affected scope.
2. The approved compass, brief, DOD, Brief Patch, or Team Alignment Delta.
3. Current task issue, PR, accepted artifact, and verified repository state.
4. Agent plans, summaries, and handoffs.
5. Inference from code, chat history, or local state.

An agent plan never overrides a later human correction. Record the correction in durable state before dependent work continues. Stop only the affected scope; unrelated work may continue within named boundaries.

## Operating Cycle

### 0. Launch

Connect the repo, participants, coordination inputs, source of truth, privacy rules, compass, and first DOD. Register each active orchestrator in Project State.

### 1. Shape

Use `$start-work` to turn a raw goal, meeting insight, or large topic into an epic brief and task map. Start from the product outcome, then identify entities, contracts, dependencies, risks, sequence, ownership, and acceptance.

If the compass changes, publish a visible patch or re-brief. Do not silently mutate active tasks.

### 2. Route

Choose the smallest useful context:

- Research Thread: a bounded product or technical question is not ready for a brief. No product-code changes. Return a short Research Packet and archive the thread after incorporation.
- Lab Mode: isolated implementation or experimentation reduces risk, cost, or time-to-feedback. Define proof, stop condition, burn cap, and production-transfer plan before starting.
- Task Thread: the outcome and acceptance boundary are clear enough to implement in the real product path.

Research reduces uncertainty. Lab reduces execution cost. A task delivers accepted product or enabling work.

### 3. Dispatch

The minimum task contract contains:

- Goal and DOD impact;
- Scope and out of scope;
- Product loop or linked enabling contract;
- Human checkpoint;
- Burn / limits when material;
- Verification and completion route.

Add Lab Mode, Peer Compass Review, model profile, or detailed contracts only when relevant. The orchestrator creates or prepares the task thread, verifies its actual title, records its link, and checks that execution started. A plan-only child response is not progress.

### 4. Execute

The task thread implements autonomously inside its contract. It stops and returns for re-brief when the goal, source of truth, shared contract, burn cap, or human checkpoint changes.

### 5. Align

Use `$daily-alignment` after a meaningful meeting or event that changes another participant's safe next action. Publish the participant's local packet, reconcile relevant packets, rebuild the current dashboard, and state what can continue.

Missing participants do not block unrelated work. Work touching their active surface or contract continues only within explicit cautions or waits for their packet.

### 6. Accept

The task thread runs `$accept-work` before completion. Acceptance compares the result with the latest human decision, brief, DOD, deltas, product loop, burn, tests, and smoke evidence.

For runtime work, smoke the exact branch, worktree, commit, frontend, backend, and browser target being accepted. Do not use an old server or another branch. Product capability is not closed by backend state, UI shell, or lab proof alone.

After human smoke, merge manually from the task thread. The orchestrator then updates DOD burn, alignment, parent closure, and next-best-action.

### 7. Review Health

Run a short Health Review after a milestone, several accepted slices, repeated follow-ups, stalled DOD burn, owner dropout, repeated context compaction, or when work starts relying on chat archaeology.

Check:

- progress toward compass and DOD;
- blockers, repeated costs, and technical slicing without product progress;
- research and lab outputs that never entered the real product path;
- stale tasks, PRs, branches, worktrees, monitors, and alignment windows;
- decisions trapped outside durable state;
- whether the active orchestrator should rotate.

## Humans As Agents

Humans are event-driven participants in the system, not its hidden schedulers. When human action is required, the orchestrator must state:

- who should act;
- what to inspect or decide;
- the exact link, task, or prompt;
- where the result will be written;
- what may continue safely meanwhile;
- what return sync will resume the flow.

Every task declares one `Human checkpoint`:

- `none`;
- `product decision`;
- `visual review`;
- `paid or external action approval`;
- `manual smoke and merge`.

The orchestrator should not say that a human is unnecessary when a named checkpoint is still ahead.

## Asynchronous Collaboration

Keep two compact durable artifacts:

- Project State: compass, DOD, participant registry, active orchestrators, current tasks, and latest alignment window.
- Alignment Window: append-only packets and deltas for one meeting, milestone, or compact work period.

The participant registry includes: participant, orchestrator link, installed framework version, latest packet, active task, and status.

Before starting or resuming work on a shared surface, each participant's orchestrator checks its registry row and publishes a new packet when local or meeting state materially changed. Never invent another participant's uncommitted state.

When publishing a Team Alignment Delta, rebuild the issue body in the same operation. Rotate the Alignment Window after a milestone or when it stops being quickly scannable; link the archived window from Project State.

## Meetings

Meetings, recordings, transcripts, team chats, and notes are one coordination input layer. They are raw inputs until the orchestrator distills them and a human approves changes to compass, scope, sequence, ownership, or DOD.

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

One active orchestrator is authoritative for one participant and stream. When rotation is needed:

1. Write a compact state snapshot to Project State.
2. Create a fresh orchestrator from the current repository and framework version.
3. Register the new thread and mark the old one superseded.
4. Verify the new thread can name the compass, active DOD, tasks, blockers, latest delta, and next-best-action.
5. Archive the old thread after successful handoff.

## Rules

- Keep the orchestrator organization-only.
- Keep universal rules in the canonical framework and project rules in the product repo.
- Keep human conversation product-focused; hide branch and worktree mechanics unless they affect a decision or risk.
- Do not start implementation without a goal, boundary, DOD impact, human checkpoint, and verification route.
- Do not close a parent from an accepted sub-slice unless its promised product loop and DOD are closed or explicitly moved out of scope.
- Do not accept Lab Mode as product completion without production transfer and real-flow verification.
- Do not expose secrets, transcripts, private product data, proprietary prompts, or customer information in public framework artifacts.
- Keep the model and reasoning profile in project configuration. Use the current approved profile and make fallback visible; do not hardcode a model version in universal rules.
- Preserve append-only evidence, but keep current dashboards short and current.
- Prefer next-best-action over status-only reporting.

## Skills And Human Interface

Internal repo-scoped skills:

- `$project-launch`: activate a project and create its operating brief.
- `$framework-orchestrator`: restore state, coordinate, dispatch, supervise, and choose next-best-action.
- `$start-work`: shape a large topic into an epic and task map.
- `$daily-alignment`: reconcile meeting and event changes asynchronously.
- `$accept-work`: accept a task, milestone, or epic against current intent and evidence.

People should not need to select skills manually. In the orchestrator, natural requests are enough:

- `Start this project.`
- `Continue this stream.`
- `Process the latest meeting.`
- `Check the work and continue.`

The orchestrator chooses and applies the required skill.
