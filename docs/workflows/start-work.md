# Start Work Workflow

Goal: turn a raw or changed product topic into an approved epic brief and executable task map.

## 1. Restore Intent

Read:

- latest explicit human decision;
- product compass and DOD;
- current Project Memory Graph, safe operational pointers, watermark, and last retrieval check;
- relevant meetings, docs, issues, PRs, deltas, and verified repo state;
- overlapping work and participant ownership.

Apply source precedence. Classify new commentary as scope change, DOD gap, guardrail, future option, or a reusable memory candidate. A meaningful method change may become a `DECISION` even when DOD is unchanged.

Before dispatching, re-briefing, or materially resuming a stale or paused task, compare it with current DOD/decisions, upstream results, affected entities/contracts, active work, memory, safe operational sources, and code. Identify the accepted existing mechanism the task continues; do not infer permission to create a parallel one. Record `UNCHANGED`, `PATCH_REQUIRED`, or `REBRIEF_REQUIRED`. Seven days is a re-read signal, not an automatic change. A patch, split, or re-brief maps earlier progress as `Preserved`, `Replaced`, `Added`, and `Remaining`. An ordinary continue inside a current active contract is not a re-brief or freshness event.

If a future option is useful but unnecessary for the nearest DOD, recommend keeping it out of current work. After human confirmation, return an `IDEA / ADD or REFINE` candidate with its value, touch keys, source, and recall trigger.

## 2. Decide Whether To Discover

Use role `DISCOVERY` when one bounded question prevents a useful brief: source of truth, option comparison, product model, architecture, unresolved UX/UI or visual direction, foundation, or affected contract. Use Research Context when product code is unnecessary; use a disposable Lab only when a working proof materially improves the decision.

Give it one question, sources, non-goals, stop condition, and expected Decision Packet: chosen approach, material rejected options and lessons, affected entities/interfaces, acceptance or visual evidence, risks, and unresolved owner decisions. Do not create production implementation. Incorporate the packet and close or archive the context before resuming the brief.

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

Compare with active epics, shared contracts, deltas, and known lessons. Surface overlap in code or intended outcome, duplicated work, conflicting assumptions, and unsafe parallel edits. A support, demo, review, or transport task stays separate from the product task's DOD and burn even when its files are isolated.

Derive a `Touch Set` from the proposed outcome, actors, entities, surfaces, contracts/authorities, and data/operational realms. Resolve stable graph anchors and aliases, add semantic candidates when wording differs, traverse relevant typed relations one or two hops, then filter by source precedence, status, scope, applicability, and supersession.

Record the smallest complete `Memory Brief`, no more than seven nodes and fewer when fewer apply. Each item must say `Because <anchor>, apply <rule>, avoid <path>, verify <evidence>, source <link>` and may expose a conflict or `MEMORY_COVERAGE_GAP`; ids alone are invalid. Drop an item that changes neither first action, boundary, guardrail, nor acceptance. Keep the Touch Set and retrieval reasoning in the orchestrator.

Propose:

- Lab Mode when isolation reduces cost/risk, including decision, Accepted Baseline, one main variable, human-verifiable proof, stop/burn, production transfer, and risk-based real-flow smoke;
- Peer Compass Review when another owner can prevent drift.

When a local outcome is likely to pull unrelated layers, name the expected surface, first human-verifiable evidence, and a task-specific expansion appetite. File, line, and time counts may trigger review but are never universal verdicts. If recurring friction already affects several tasks, shape the smallest maintenance task that removes the shared cause, proves the representative original flow became smaller/faster, tests recurrence, and returns to delivery; containment alone does not close it.

## 5. Build The Task Map

For each task, write only the execution contract. Project-wide reasoning stays with the orchestrator:

```md
Title / outcome owner / backup / recipient:
Role / profile: EXECUTION / <resolved efficient mapping>
Goal and DOD impact:
Scope / out of scope:
Scope freshness / Accepted Baseline:
Continue from: <accepted mechanism/reference>
Applicable Memory Brief: <maximum 7 executable Because / Apply / Avoid / Verify / Source items with node ids, or MEMORY_COVERAGE_GAP / none>
Product loop or linked enabler:
For enabler: Unlocks / Still missing / next product slice:
Authority / safety envelope:
Human checkpoint:
Burn / stop limit:
Expected surface / first evidence: <only when expansion risk is material>
Verification / completion route:
Consult when: <undeclared scope/authority/shared-contract/safety boundary, impossible DOD, or repeated no-progress stop>
Return to / triggers: <orchestrator or tracker / named human checkpoint, irreducible blocker, terminal result>
Dependencies / parallel boundary:
Progress continuity: <Preserved / Replaced / Added / Remaining when patched, split, or re-briefed>
```

Before dispatch, classify each item as `ORCHESTRATOR_WORK`, `DISCOVERY`, `EXECUTION`, or `STALE_OR_REBRIEF`. An execution item is Low-ready only when it has one outcome and first action, no unresolved solution decision, explicit boundaries, objective acceptance, current baseline/data/access/environment, and compact material consult triggers. Otherwise resolve the gap, re-brief/split, or run Discovery.

Also classify the work as product capability, technical enabler, maintenance, research, or future option. A technical enabler does not close its parent product loop; name the product continuation and owner. Pass the resolved role profile and make its environment mapping or fallback visible only in dispatch metadata.

Keep one owning execution context and canonical Candidate per accepted increment. Before dispatching the next increment, show what closed, what remains before parent acceptance, and why the next slice is a DOD gap rather than polish. Do not stretch one task across the whole product route.

## 6. Approve And Publish

Show the brief, task map, sequence, ownership, checkpoints, Memory Brief, open decisions, and risks. Ask for human approval.

After approval, create/update each task's one current contract, formal parent/dependencies where supported, and tracker projection together, then return the sequence to the Framework Orchestrator. Every implementation task starts in role `EXECUTION` on the efficient profile: it continues the accepted mechanism, resolves ordinary failures autonomously, consults only at a material undeclared boundary, never climbs effort levels mechanically, runs `$accept-work`, records each Memory Brief item as applied/missed/contradicted/not exercised, and publishes Return Sync with `NO_MEMORY_DELTA` or compact candidates only at a named human checkpoint, irreducible blocker, or terminal result. It does not run orchestration or alignment workflows.

Do not implement in this workflow.
