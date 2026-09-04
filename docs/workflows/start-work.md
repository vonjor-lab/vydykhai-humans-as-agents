# Start Work Workflow

Goal: turn a raw or changed product topic into an approved epic brief and executable task map. Use [Context Route](context-route.md) to connect the goal, accepted architecture, decisions, existing artifacts and verification; completeness takes priority over context length.

## 1. Restore Intent

Read the current Project State control snapshot and `DOD Control Line` first, then:

- latest explicit human decision;
- product compass and DOD;
- current Project Memory Graph, safe operational pointers, watermark, and last retrieval check;
- relevant meetings, docs, issues, PRs, deltas, and verified repo state;
- overlapping work and participant ownership.

Apply source precedence. Classify new commentary as scope change, DOD gap, guardrail, future option, or a reusable memory candidate. A meaningful method change may become a `DECISION` even when DOD is unchanged.

Before dispatching, re-briefing, or materially resuming a stale or paused task, compare it with current DOD/decisions, upstream results, affected entities/contracts, active work, memory, safe operational sources, and code. Identify the accepted existing mechanism the task continues; do not infer permission to create a parallel one. Record `UNCHANGED`, `PATCH_REQUIRED`, or `REBRIEF_REQUIRED`. Seven days is a re-read signal, not an automatic change. A patch, split, or re-brief maps earlier progress as `Preserved`, `Replaced`, `Added`, and `Remaining`. An ordinary continue inside a current active contract is not a re-brief or freshness event.

If a future option is useful but unnecessary for the nearest DOD, recommend keeping it out of current work. After human confirmation, return an `IDEA / ADD or REFINE` candidate with its value, touch keys, source, and recall trigger. If work deliberately steps aside, record the detour owner, target DOD/lease, return condition, and review-by before changing sequence.

## 2. Decide Whether To Discover

Use [Context Route](context-route.md#choose-preparation-depth) to choose direct execution, bounded `DISCOVERY`, or Discovery with a bounded lead. Recover missing/stale/conflicting understanding before replacement work; age alone is not a trigger. A lead is justified by ongoing cross-task coherence that a one-time brief cannot cover, not task size. Use Research Context when product code is unnecessary; use a disposable Lab only when a working proof materially improves the decision.

Give it one question, sources, non-goals, stop condition, and expected Decision Packet: chosen approach, material rejected options and lessons, affected entities/interfaces, acceptance or visual evidence, risks, and unresolved owner decisions. Do not create production implementation. Incorporate the packet and close ordinary Discovery; for an explicit bounded lead, retain only its named consultation/integration obligations and follow the checkpoint/wait/exit contract in Context Route. Explain the preparation and next user-visible result briefly.

## 3. Draft The Epic Brief

Include:

- actor, problem, desired outcome, and why now;
- current state and target behavior;
- non-goals and constraints;
- product loop;
- affected entities, surfaces, data, APIs, permissions, and integrations;
- dependencies, risks, decision owner, DOD, and acceptance.

If its outcome or ownership remains ambiguous, resolve the decision or split at a meaningful responsibility boundary before tasking; length alone is not a reason to fragment coherent work.

## 4. Check Coherence

Compare with active epics, shared contracts, deltas, and known lessons. Surface overlap in code or intended outcome, duplicated work, conflicting assumptions, and unsafe parallel edits. A support, demo, review, or transport task stays separate from the product task's DOD and burn even when its files are isolated.

Derive a `Touch Set` from the proposed outcome, journeys, modules/capabilities, actors, entities, surfaces, contracts/authorities, data/artifacts, and systems/operations. Resolve stable graph anchors and aliases, then traverse the vertical spine and reverse consumer routes until the applicable goal, inputs, outputs, storage, current decisions, open commitments, accepted artifacts, and verification are complete. Filter only after those routes are assembled, using source precedence, status, scope, applicability, and supersession.

For every touched durable module or capability, read its current [Module Contract](module-contract-template.md) before inspecting current code and tests. This graph -> documentation -> code sequence is the minimum preparation for any implementation task, not a separate Discovery ritual. If a required route, contract, accepted artifact, or implementation cannot be reconciled, raise `MEMORY_COVERAGE_GAP` and choose bounded Discovery for that gap.

Record the complete applicable `Memory Brief` without a fixed node cap. Each item must say `Because <anchor>, apply <rule>, avoid <path>, verify <evidence>, source <link>` and may expose a conflict or `MEMORY_COVERAGE_GAP`; ids alone are invalid. Preserve rationale that explains purpose, existing choices and material qualifications even when it does not alter the first action. Remove unrelated repetition, not inherited obligations. Keep the Touch Set and retrieval reasoning in the orchestrator.

If one omitted, merged or reordered clause would invalidate an exact sequence, path matrix, safety gate or previously missed obligation, compile only that indivisible portion through [Executable Memory Brief](memory-brief-envelope.md). Put its exact `atomicRender` beside the ordinary brief and require the bound application receipt. Do not rigidly encode all context or use the envelope as authority.

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
DOD Control Line contribution: <accepted proof -> gap closed -> remaining continuation>
Scope / out of scope:
Scope freshness / Accepted Baseline:
Continue from: <accepted mechanism/reference>
Applicable Memory Brief: <complete applicable Because / Apply / Avoid / Verify / Source items with node ids, or MEMORY_COVERAGE_GAP / none>
Executable Memory Brief: <none | exact compiler-produced atomicRender and required application receipt>
Context route: <goal/brief -> journey -> modules/capabilities -> inputs/entities/contracts/data/artifacts/systems -> current meaning/commitments -> consumers -> accepted artifacts/verification; checked sources and gaps>
Module contracts / implementation: <current docs and exact code/test boundaries read before work>
Documentation impact: <expected NONE or named module-contract sections that may change>
Product loop or linked enabler:
For enabler: Unlocks / Still missing / next product slice:
Authority / safety envelope:
Human checkpoint:
Burn / stop limit:
Expected surface / first evidence: <only when expansion risk is material>
Verification / completion route:
Consult when: <undeclared scope/authority/shared-contract/safety boundary, impossible DOD, or repeated no-progress stop>
Return to / triggers: <orchestrator or tracker / named human checkpoint, irreducible blocker, terminal result>
Execution Lease / durable return: <PREPARED identity, review-by, outbox, native wakeup>
Dependencies / parallel boundary:
Progress continuity: <Preserved / Replaced / Added / Remaining when patched, split, or re-briefed>
```

Before dispatch, classify each item as `ORCHESTRATOR_WORK`, `DISCOVERY`, `EXECUTION`, or `STALE_OR_REBRIEF`. Classify by who owns the durable result, not by topic, read-only status, tool, or subagent use. `ORCHESTRATOR_WORK` may use bounded disposable advisory analysis only to improve a control decision. A new diagnosis, solution, empirical fact, experiment, test, Candidate, acceptance proof, side effect, independently useful artifact, or work that outlives the control cycle requires a focused context. An execution item is Low-ready only when it has one outcome and first action, no unresolved solution decision, explicit boundaries, objective acceptance, current baseline/data/access/environment, and compact material consult triggers. Otherwise resolve the gap, re-brief/split, or run Discovery.

Also classify the work as product capability, technical enabler, maintenance, research, or future option. A technical enabler does not close its parent product loop; name the product continuation and owner. Pass the resolved role profile and make its environment mapping or fallback visible only in dispatch metadata.

Keep one owning execution context, Execution Lease, and canonical Candidate per accepted increment. Block duplicate launch while a lease remains unresolved. Before dispatching the next increment, show what closed, what remains before parent acceptance, and why the next slice is a DOD gap rather than polish.

## 6. Approve And Publish

Show the brief, task map, sequence, ownership, checkpoints, Memory Brief, open decisions, and risks. Ask for human approval.

Require each implementation task to read its supplied graph route and Module Contracts, verify them against current code, update affected Module Contracts in the same Candidate when behavior changes, and return exact documentation impact with acceptance evidence.

After approval, create/update each task's one current contract, formal parent/dependencies where supported, and tracker projection together, then return the sequence to the Framework Orchestrator. Compile any declared atomic Memory Brief before dispatch; a hand-written manifest or shortened render is invalid. Every implementation task starts in role `EXECUTION` on the efficient profile: it continues the accepted mechanism, performs the first safe observable action in the launch/resume turn, resolves ordinary failures autonomously, consults only at a material undeclared boundary, never climbs effort levels mechanically, and runs `$accept-work`. At every declared readiness, checkpoint, blocker, or terminal return trigger it writes the full marked unique-id Return Sync to the durable outbox before attempting the same id as a native wakeup; an Action Receipt never substitutes, and the orchestrator later appends the paired marked Return Route receipt. Its title is `<work-id> [<track>] [<mode>] — <short outcome>` using the owning Issue or stable tracker key, never a PR; normal execution omits the mode. Before declaring launch, the orchestrator reads back title, actual link, role/profile, exact base, `PREPARED -> STARTED` lease evidence, and return route. The task does not run orchestration or alignment workflows.

Do not implement in this workflow.
