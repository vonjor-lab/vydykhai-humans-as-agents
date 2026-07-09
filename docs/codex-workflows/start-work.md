# Start Work Workflow

Goal: turn a raw or changed product topic into an approved epic brief and executable task map.

## 1. Restore Intent

Read:

- latest explicit human decision;
- product compass and DOD;
- relevant meetings, docs, issues, PRs, deltas, and verified repo state;
- overlapping work and participant ownership.

Apply source precedence. Classify new commentary as current scope change, DOD gap, guardrail, or future option.

## 2. Decide Whether To Research

Use Research Thread when one bounded question prevents a useful brief: source of truth, option comparison, product model, foundation, or affected contract.

Give it one question, sources, non-goals, stop condition, and expected Research Packet. Do not change product code. Incorporate the packet and archive the thread before resuming the brief.

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

Propose:

- Lab Mode when isolation reduces cost/risk, including proof, stop, burn, transfer, and real-flow smoke;
- Peer Compass Review when another owner can prevent drift.

## 5. Build The Task Map

For each task, write only:

```md
Title / owner / backup:
Goal and DOD impact:
Scope / out of scope:
Product loop or linked enabler:
Human checkpoint:
Burn / stop limit:
Verification / completion route:
Dependencies / parallel boundary:
```

Classify task as product capability, technical enabler, maintenance, research, or future option. Use the project model profile and make fallback visible only in dispatch metadata.

Before adding another slice, show what already closed, what remains before parent acceptance, and why this is a DOD gap rather than polish.

## 6. Approve And Publish

Show the brief, task map, sequence, ownership, human checkpoints, open decisions, and risks. Ask for human approval.

After approval, create/update GitHub issues and return the sequence to the Framework Orchestrator. Every implementation issue must instruct its task thread to run `$accept-work` before completion.

Do not implement in this workflow.
