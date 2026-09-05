import { readFileSync } from "node:fs";
import { buildBundle } from "./candidate.mjs";
const oracle = JSON.parse(readFileSync("oracle.json", "utf8"));
const observations = JSON.parse(process.env.VYDYKHAI_REQUIRED_EXAMPLES).map(id => {
  const example = oracle.examples.find(example => example.id === id);
  let observed;
  try { observed = buildBundle(example.input); }
  catch (error) { observed = { error: error.message }; }
  return { id, observed };
});
console.log(JSON.stringify({ schema: "context.observations.v1",
  candidateSha256: process.env.VYDYKHAI_CANDIDATE_SHA256,
  oracleSha256: process.env.VYDYKHAI_ORACLE_SHA256, observations }));
