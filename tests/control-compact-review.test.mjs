import test from "node:test";
import assert from "node:assert/strict";
import {expandControlRows,controlCheckIds,checkControlCoverage,controlCatalog} from "../scripts/control-catalog.mjs";
import {modelReviewCatalog,modelReviewPrompt} from "../scripts/control-model-review.mjs";

test("compact prompt preserves every criterion, group and source without applicability defaults",()=>{
  const text=modelReviewCatalog(), lines=text.split("\n");
  assert.deepEqual(lines.filter(line=>/^C\d{2}\.\d{2} /.test(line)).map(line=>line.split(" ")[0]),controlCheckIds);
  for(const group of controlCatalog){
    assert.ok(lines.includes(`${group.id} ${group.title} [${group.source}]`));
    for(const check of group.checks)assert.ok(lines.includes(`${check.id} ${check.criterion}`));
  }
  assert.ok(Buffer.byteLength(text)<Buffer.byteLength(JSON.stringify(controlCatalog)));
  const prompt=modelReviewPrompt({phase:"HEALTH"},{});
  assert.ok(prompt.includes(text));assert.match(prompt,/Include every criterion exactly once/);
  assert.match(prompt,/NOT_APPLICABLE requires a source-backed scoped reason/);
});

const compact=()=>({evidence:{S1:"source:fixture:"+"a".repeat(64)},rowGroups:[{ids:[...controlCheckIds],status:"NOT_APPLICABLE",
  evidenceRef:"S1",reason:"Protocol fixture only; not evidence of semantic applicability"}],findings:[]});
test("compact wire groups expand all 87 criteria without inferring missing status or evidence",()=>{
  const answer=compact(),rows=expandControlRows(answer);
  assert.equal(rows.length,87);assert.equal(checkControlCoverage(rows).ok,true);
  assert.equal(rows[0].evidence,answer.evidence.S1);assert.deepEqual(rows.map(r=>r.id),controlCheckIds);
  const legacy={rows};assert.deepEqual(expandControlRows(legacy),rows);
});
test("compact verdicts cannot hide omitted, duplicate, invented, unowned or unsupported checks",()=>{
  for(const mutate of [
    a=>a.rowGroups[0].ids.pop(),a=>a.rowGroups[0].ids.push(controlCheckIds[0]),
    a=>a.rowGroups[0].ids.splice(0,1,"C99.01"),a=>delete a.evidence.S1,
    a=>a.rowGroups[0].status="UNKNOWN",a=>a.rowGroups[0].id="override",
    a=>a.rowGroups[0].evidence="unread",a=>a.rows=[],a=>delete a.rowGroups[0].reason
  ]) {const answer=compact();mutate(answer);assert.throws(()=>expandControlRows(answer));}
});
