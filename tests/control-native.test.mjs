// Actual CLI/OS transport qualification with a local fake Responses provider.
// No inference or credentials. Set VYDYKHAI_CODEX_BINARY to qualify a host.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdir, readFile} from "node:fs/promises";
import {createServer} from "node:http";
import {gunzipSync, brotliDecompressSync} from "node:zlib";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {endpointFixture} from "./control-endpoint-fixture.mjs";
import {runControlledWorker} from "../scripts/control-worker-run.mjs";
import {inspectControlRuntime, stageControlRuntime, loadControlRuntime} from "../scripts/control-runtime.mjs";

const binary = process.env.VYDYKHAI_CODEX_BINARY;
async function exists(file) {try {return await readFile(file, "utf8");} catch(e) {if(e.code === "ENOENT") return null; throw e;}}
for (const mode of ["approved", "denied", "missing-server"]) {
  test(`native controlled route ${mode}: no direct writes, fabricated approval or replay`,
    {skip: !binary || process.platform !== "darwin", timeout: 30000}, async t => {
      const x = await endpointFixture(t); if(mode === "approved") await x.approve();
      const home = path.join(x.privateRoot, "cli-home"); await mkdir(home, {mode: 0o700});
      let launch = runControlledWorker;
      if(mode === "approved") {
        const sourceRoot = fileURLToPath(new URL("..", import.meta.url)), directory = path.join(x.privateRoot,"installed-runtime");
        await mkdir(directory,{mode:0o700});
        const {digest} = await inspectControlRuntime(sourceRoot);
        const installed = await stageControlRuntime({sourceRoot,directory,workspace:x.f.root,expectedDigest:digest});
        launch = (await loadControlRuntime({packageRoot:installed.root,expectedDigest:digest,workspace:x.f.root})).worker.runControlledWorker;
      }
      const bodies = [];
      const server = createServer(async (req,res) => {
        if(req.method !== "POST") {res.writeHead(404);res.end("{}");return;}
        try {
          const parts = []; for await(const part of req) parts.push(part);
          let bytes = Buffer.concat(parts);
          if(req.headers["content-encoding"] === "gzip") bytes = gunzipSync(bytes);
          if(req.headers["content-encoding"] === "br") bytes = brotliDecompressSync(bytes);
          bodies.push(JSON.parse(bytes)); const n = bodies.length;
          const patches = [path.join(x.f.root,"BYPASS_PATCH"),path.join(x.privateRoot,"CONTROL_BYPASS")]
            .map(p => `try{text(await tools.apply_patch(${JSON.stringify(`*** Begin Patch\n*** Add File: ${p}\n+forbidden\n*** End Patch`)}))}catch(e){text('PATCH_REFUSED')}`).join("\n");
          const input = n === 1 ? "text(ALL_TOOLS.map(t=>t.name));" : n === 2
            ? `try{text(await tools.exec_command({cmd:'true'}))}catch(e){text('DIRECT_ACTION_REFUSED')}\n${patches}`
            : `const t=ALL_TOOLS.find(t=>t.name.includes('vydykhai_control')&&t.name.includes('execute_registered'));if(!t)throw Error('CONTROL_TOOL_ABSENT');text(await tools[t.name](${JSON.stringify(n===3?{requestId:"next",reviewer:"reviewer"}:{requestId:"next"})}));`;
          const item = n <= 5 ? {type:"custom_tool_call",id:`ct_${n}`,call_id:`call_${n}`,name:"exec",namespace:"functions",input,status:"completed"}
            : {type:"message",id:"msg_probe",role:"assistant",status:"completed",content:[{type:"output_text",text:"LOCAL_PROTOCOL_ONLY",annotations:[]}]};
          const response = {id:`resp_${n}`,object:"response",created_at:Math.floor(Date.now()/1000),model:"gpt-6.1-sol",
            status:"completed",output:[item],usage:{input_tokens:1,output_tokens:1,total_tokens:2}};
          res.writeHead(200,{"content-type":"text/event-stream"});
          for(const e of [{type:"response.created",response:{...response,status:"in_progress",output:[]}},
            {type:"response.output_item.done",output_index:0,item},{type:"response.completed",response}])
            res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
          res.end();
        } catch {res.writeHead(500);res.end("{}");}
      });
      await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
      t.after(() => {server.closeAllConnections();server.close();});
      const finished = await launch({binary, workspace: x.f.root, home,
        endpointFile: mode === "missing-server" ? path.join(x.privateRoot,"absent.json") : x.file,
        model: "gpt-6.1-sol", effort: "low", timeoutMs: 20000,
        provider: {baseUrl:`http://127.0.0.1:${server.address().port}/v1`,requiresAuth:false},
        prompt: "Execute the registered next request only if admitted."});
      const {output, errors} = finished;
      if(mode!=="missing-server") {
        const failed=output.trim().split("\n").map(l=>JSON.parse(l)).filter(e=>e.type==="item.completed"&&e.item?.type==="mcp_tool_call"&&e.item.error);
        for(const e of failed)t.diagnostic(JSON.stringify(e.item.error));
      }
      assert.equal(finished.signal,null,errors);
      assert.equal(await exists(path.join(x.f.root,"BYPASS_PATCH")),null);
      assert.equal(await exists(path.join(x.privateRoot,"CONTROL_BYPASS")),null);
      assert.equal(await exists(path.join(x.f.root,"actions.log")),mode === "approved" ? "called\n" : null);
      if(mode === "missing-server") {assert.notEqual(finished.code,0);assert.equal(bodies.length,0);return;}
      assert.equal(finished.code,0,errors); assert.equal(bodies.length,6);
      const initialInput=bodies[0].input.filter(item=>item.role==="user").flatMap(item=>item.content??[])
        .filter(item=>item.type==="input_text").map(item=>item.text).join("\n");
      assert.match(initialInput,/API: execute_registered\(\{requestId:string\}\)/);
      assert.match(initialInput,/registered request IDs: \["next"\]/);
      assert.match(initialInput,/does not approve execution/);
      const events = output.trim().split("\n").map(l=>JSON.parse(l));
      const calls = events.filter(e=>e.type === "item.completed" && e.item.type === "mcp_tool_call").map(e=>e.item);
      assert.equal(calls.length,3,output); assert.equal(calls[0].status,"failed");
      assert.equal(JSON.parse(calls[1].result.content[0].text).status,mode === "approved" ? "ACTION_COMPLETED" : "BLOCKED");
      assert.equal(JSON.parse(calls[2].result.content[0].text).status,"BLOCKED");
    });
}
