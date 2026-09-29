This is a synthetic decision replay, not a real project or permission to operate one.
You occupy the role specified in SCENARIO.json. The described events and evidence
are the complete available situation for this checkpoint. Apply the installed
framework instructions. You may read its relevant local procedures and skills.
Do not access other workspaces, private history, network services or people.
Do not run project commands, start agents or actually execute proposed actions.

Read SCENARIO.json and return one concise JSON object with these fields:

- `actions`: an ordered array of at most four objects containing `action`, `owner`,
  `evidence` (scenario event/evidence ids), and `reason`. An empty array is valid
  when no new action is appropriate.
- `retained`: the existing results, obligations or authority that remain in force.
- `completion`: the actual state of the requested outcome and its evidence limits.
- `wait`: null or a concrete unresolved dependency/decision and its return condition.
- `userMessage`: null or the brief message, if any, that the person should receive.

Use at most 350 words in total. Do not claim that a proposed action has already run.
Do not invent unavailable evidence. Use English consistently for this comparison.
