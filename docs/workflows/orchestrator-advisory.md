# Orchestrator Advisory Workflow

Goal: let a maximum-profile orchestrator use internal advisory agents for stronger control decisions without turning them into hidden project workers.

## 1. Define The Control Question

Use advisory agents only for `ORCHESTRATOR_WORK`: DOD, memory, risk, ownership, sequence, brief quality, routing, or an owner decision. Give each bounded prompt:

```text
Control decision:
Available sources:
Expected orchestration output:
Route to focused context when:
```

Advisors may inspect existing durable product context, including a verified repository, only far enough to improve that control decision. Use them on a material cold-path ambiguity where parallel critique or alternative reasoning improves quality; routine continue stays on the orchestrator hot path without extra agents.

## 2. Keep The Result Control-Only

Return exactly one result in the same control cycle:

- `CONTROL_ONLY`: options, risks, conflicts, memory intersections, brief critique, ownership, sequence, or routing recommendation. The orchestrator synthesizes it and the notes may be discarded.
- `ROUTE_TO_FOCUSED_CONTEXT`: the answer now requires project work. Name the smallest suitable `DISCOVERY`, `EXECUTION`, `LAB`, or project `MAINTENANCE` outcome and stop.

Advisors have no Execution Lease, task Return Sync, direct participant route, Candidate ownership, acceptance authority, or independent durable deliverable. Analysis that outlives the control cycle becomes a focused context.

## 3. Detect The Project Boundary

Route to a focused context when the answer would establish a new diagnosis, product or technical solution, runtime or data fact, experiment, test, Candidate, acceptance proof, side effect, or independently useful artifact. Read-only activity and internal delegation do not make project work orchestration.

Before a material project claim changes a brief, task instruction, DOD, or current state, trace its work origin to one accepted source:

- human decision;
- durable source;
- focused-context receipt.

Advisory output may explain the orchestration choice but is not accepted project evidence. Missing or invalid origin is `UNOWNED_PROJECT_WORK`: discard the unsupported result, preserve unaffected execution, and route one bounded repair through the correct focused context. Repetition after repair is a rotation signal.

## 4. Keep The Guard Cheap

When harness metadata exposes internal activity, the external adapter checks the four-field prompt, terminal result, work origin, and absence of project ownership or side effects. A compliant pass is silent. Missing contract or ambiguous project evidence creates `AUDIT_REQUIRED`; a fresh maximum-profile evaluator decides `HEALTHY`, bounded `REPAIR`, or repeated-after-repair `ROTATE`. If the harness cannot expose work origin, report this Guard capability as `LIMITED` rather than claiming protection.
