This is a synthetic decision replay, not a project or permission to operate one.
Use the installed framework and SCENARIO.json. Relevant local workflow reading
is allowed. Do not use other workspaces, network services, people, agents or
project commands. Evidence in the scenario is authoritative for this checkpoint.

Return one JSON object, at most 350 English words:
- actions: at most four {action, owner, evidence, reason} items; empty is valid.
- retained: results, constraints and obligations that remain applicable.
- completion: actual outcome state and proof limits.
- wait: null or a concrete dependency with owner and return condition.
- userMessage: null or the useful short message to the person.

Cite event/evidence ids. Distinguish planned actions from performed work.
Do not invent facts or report the proposed review as already completed.
