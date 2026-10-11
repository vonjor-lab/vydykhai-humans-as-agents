// Real local HTTP effect with a lost reply. The independent readback is trusted
// adapter evidence, not an assertion from the worker or a production API canary.
import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {endpointFixture,endpointServices} from "./control-endpoint-fixture.mjs";
import {openControlHost} from "../scripts/control-host.mjs";
import {canonicalJson,sha256} from "../scripts/memory-brief.mjs";
const hash=v=>sha256(canonicalJson(v));
test("lost external response is reconciled by actual id-bound readback without repeating effect",async t=>{
  const x=await endpointFixture(t);await x.approve();
  const grant=Object.values((await x.host.snapshot()).grants)[0];
  const claim=await x.host.control.reserve(await x.host.control.authorize(grant.binding));
  const receiptFile=path.join(x.privateRoot,"external-effect.json");let posts=0;
  const server=createServer(async(req,res)=>{
    if(req.method==="POST") {
      posts++;const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const input=JSON.parse(Buffer.concat(chunks));
      assert.equal(input.id,claim.reservationId);assert.equal(input.bindingSha256,grant.bindingSha256);
      const receipt={id:input.id,bindingSha256:input.bindingSha256,status:"COMPLETED",result:{value:7}};
      await writeFile(receiptFile,canonicalJson(receipt),{mode:0o600,flag:"wx"});
      req.socket.destroy();return;
    }
    if(req.method==="GET"&&req.url===`/result/${claim.reservationId}`){res.end(await readFile(receiptFile));return;}
    res.writeHead(404);res.end();
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  const url=`http://127.0.0.1:${server.address().port}`;
  await assert.rejects(fetch(url,{method:"POST",body:JSON.stringify({id:claim.reservationId,bindingSha256:grant.bindingSha256})}));
  assert.equal(posts,1);
  const resumed=await openControlHost(x.profile.directory,x.profile.config,endpointServices);
  assert.equal((await resumed.snapshot()).reservations[claim.reservationId].status,"IN_FLIGHT");
  await assert.rejects(resumed.control.authorize(grant.binding),/COMMAND_NOT_APPROVED/);
  const wrong=await fetch(`${url}/result/unknown`);assert.equal(wrong.status,404);
  assert.equal((await resumed.snapshot()).reservations[claim.reservationId].status,"IN_FLIGHT");
  const readback=await (await fetch(`${url}/result/${claim.reservationId}`)).json();
  assert.equal(readback.id,claim.reservationId);assert.equal(readback.bindingSha256,grant.bindingSha256);
  assert.equal(readback.status,"COMPLETED");
  const observed={outcome:"COMPLETED",bindingSha256:readback.bindingSha256,resultSha256:hash(readback.result)};
  await resumed.control.observe(claim,observed);
  await resumed.control.observe(claim,observed);
  await assert.rejects(resumed.control.observe(claim,{...observed,resultSha256:hash("different")}),/OBSERVATION_CONFLICT/);
  assert.equal((await resumed.snapshot()).reservations[claim.reservationId].status,"COMPLETED");
  await assert.rejects(resumed.control.authorize(grant.binding),/COMMAND_NOT_APPROVED/);
  assert.equal(posts,1);
});
