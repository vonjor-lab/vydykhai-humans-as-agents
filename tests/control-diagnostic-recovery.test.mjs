import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverDiagnosticPart} from '../scripts/reconcile-control-review-diagnostic.mjs';
import {sha256} from '../scripts/memory-brief.mjs';

function fixture(){
  const source={id:'contract',status:'AVAILABLE',sha256:'a'.repeat(64)};
  const answer={schema:'control.review-answer.v2',rowGroups:[{
    ids:['C01.01'],status:'UNKNOWN',sourceIds:['contract'],findingId:'C01.01-gap'}],
    newFindings:[{id:'C01.01-gap',checkId:'C01.01',sourceIds:['contract'],evidence:'No accepted goal proof',
      owner:'owner',work:'goal-repair',reviewAt:'2026-10-08T00:00:00Z',blocksResume:true}],resolutions:[]};
  const events=[{type:'item.completed',item:{type:'mcp_tool_call',server:'vydykhai_review',tool:'read_source',
    status:'completed',result:{content:[{type:'text',text:JSON.stringify(source)}]}}},
    {type:'item.completed',item:{type:'agent_message',text:JSON.stringify(answer)}},
    {type:'turn.completed',usage:{input_tokens:100,output_tokens:20}}];
  const trace={output:events.map(JSON.stringify).join('\n'),timing:{elapsedMs:10}};
  return {trace,observation:{state:'STOPPED',code:0,signal:null,outputSha256:sha256(trace.output),
    finishedAt:'2026-10-07T12:00:00Z',reason:'MISSING_REASON:C01.01'},
    ids:['C01.01'],offer:{key:'b'.repeat(64),input:{previousFindings:[]}},snapshot:{rows:[source]}};
}
const recover=x=>recoverDiagnosticPart(x.trace,x.observation,x.ids,x.offer,x.snapshot);
test('diagnostic recovery preserves a failed observation and normalizes only complete retained evidence',()=>{
  const x=fixture(),before=structuredClone(x),got=recover(x);
  assert.equal(got.rows,1);assert.equal(got.findings,1);
  assert.deepEqual(got.usage,{input_tokens:100,output_tokens:20});
  assert.equal(got.answer.rowGroups[0].reason,undefined);
  assert.deepEqual(x,before);assert.equal(got.verdict,undefined);assert.equal(got.authority,undefined);
});
test('diagnostic recovery rejects incomplete transport, changed output and missing source acquisition',()=>{
  for(const change of [x=>x.observation.state='UNKNOWN',x=>x.observation.code=1,
    x=>x.observation.signal='SIGTERM',x=>x.trace.output+=' ',
    x=>x.snapshot.rows[0].sha256='c'.repeat(64),
    x=>x.snapshot.rows.push({id:'unread',status:'MISSING'})]){
    const x=fixture();change(x);assert.throws(()=>recover(x));
  }
});
test('diagnostic recovery rejects absent or duplicate completion even when output hash is consistent',()=>{
  for(const change of [e=>e.filter(x=>x.type!=='turn.completed'),e=>[...e,e.at(-1)],
    e=>[...e,{type:'turn.failed'}]]){
    const x=fixture();x.trace.output=change(x.trace.output.split('\n').map(JSON.parse)).map(JSON.stringify).join('\n');
    x.observation.outputSha256=sha256(x.trace.output);
    assert.throws(()=>recover(x),/TURN_INCOMPLETE/);
  }
});
test('diagnostic recovery rejects wrong criterion coverage rather than filling missing rows',()=>{
  const x=fixture();x.ids.push('C01.02');assert.throws(()=>recover(x),/COVERAGE_INVALID/);
});
