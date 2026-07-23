# Start Work Workflow

Goal: turn a raw or changed product topic into an approved epic brief and executable task map.

## 1. Restore Intent

Read:

- latest explicit human decision;
- product compass and DOD;
- current Idea Memory and its last intersection;
- relevant meetings, docs, issues, PRs, deltas, and verified repo state;
- overlapping work and participant ownership.

Apply source precedence. Classify new commentary as current scope change, DOD gap, guardrail, or future option.

Before dispatching or resuming a task, compare it with current DOD/decisions, upstream results, affected entities/contracts, active work, Idea Memory, and code. Record `UNCHANGED`, `PATCH_REQUIRED`, or `REBRIEF_REQUIRED`. Seven days is the default re-read signal, not an automatic change; approve material updates before implementation continues.

If a future option is useful but unnecessary for the nearest DOD, recommend keeping it out of the current work. After human confirmation, upsert it in Idea Memory with its value, touched surfaces, source, and recall trigger.

## 2. Decide Whether To Research

Use Research Context when one bounded question prevents a useful brief: source of truth, option comparison, product model, foundation, or affected contract.

Give it one question, sources, non-goals, stop condition, and expected Research Packet. Do not change product code. Incorporate the packet and close or archive the context before resuming the brief.

## 3. Draft The Epic Brief

Include:

- actor, problem, desired outcome, and why now;
- current state and target behavior;
- non-goals and constraints;
- product loop;
- affected entities, surfaces, data, APIs, permissions, and integrations;
- dependencies, risks, decision owner, DOD, and acceptance.

If it cannot be explained compactly, split the topic before tasking.

## 4. Check Coherence

Compare with active epics, shared contracts, deltas, and known lessons. Surface overlap, duplicated work, conflicting assumptions, and unsafe parallel edits.

Run Idea Memory intersection against the proposed outcome, entities, surfaces, contracts, and DOD rows. For each match, recommend use as a guard, shape separately, keep remembered, or retire. Record the compact result in the brief; do not silently create scope or tasks.

Propose:

- Lab Mode when isolation reduces cost/risk, including decision, Accepted Baseline, one main variable, human-verifiable proof, stop/burn, production transfer, and risk-based real-flow smoke;
- Peer Compass Review when another owner can prevent drift.

When a local outcome is likely to pull unrelated layers, name the expected surface, first human-verifiable evidence, and a task-specific expansion appetite. File, line, and time counts may trigger review but are never universal verdicts. If recurring friction already affects several tasks, shape the smallest maintenance task that removes the shared cause, proves the representative original flow became smaller/faster, tests recurrence, and returns to delivery; containment alone does not close it.

## 5. Build The Task Map

For each task, write only:

```md
Title / owner / backup:
Goal and DOD impact:
Scope / out of scope:
Scope freshness / Accepted Baseline:
Product loop or linked enabler:
Human checkpoint:
Burn / stop limit:
Expected surface / first evidence: <only when expansion risk is material>
Verification / completion route:
Return destination / triggers:
Dependencies / parallel boundary:
```

Classify task as product capability, technical enabler, maintenance, research, or future option. Use the current resolved flagship / deepest bounded reasoning profile and make its environment mapping or fallback visible only in dispatch metadata.

Keep one active implementation context and canonical Candidate per product phase. Before adding another slice, show what already closed, what remains before parent acceptance, and why this is a DOD gap rather than polish.

## 6. Approve And Publish

Show the brief, task map, sequence, ownership, human checkpoints, Idea Memory intersection, open decisions, and risks. Ask for human approval.

After approval, create/update tasks in the shared tracker and return the sequence to the Framework Orchestrator. Every implementation task must start execution, continue to a human checkpoint/real blocker/terminal result, run `$accept-work`, and publish Return Sync automatically.

Do not implement in this workflow.
