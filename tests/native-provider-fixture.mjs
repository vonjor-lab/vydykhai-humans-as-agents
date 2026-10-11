// No inference. Exercise the real native client with controlled protocol inputs.
import {createServer} from "node:http";
import {gunzipSync,brotliDecompressSync} from "node:zlib";
export async function nativeProvider(t,respond) {
  const requests=[];
  const server=createServer(async(req,res)=>{
    if(req.method!=="POST"){res.writeHead(404);res.end("{}");return;}
    try {
      const chunks=[];for await(const c of req)chunks.push(c);let bytes=Buffer.concat(chunks);
      if(req.headers["content-encoding"]==="gzip")bytes=gunzipSync(bytes);
      if(req.headers["content-encoding"]==="br")bytes=brotliDecompressSync(bytes);
      const body=JSON.parse(bytes);requests.push(body);
      const item=await respond(requests.length,body);
      const response={id:`resp_${requests.length}`,object:"response",created_at:Math.floor(Date.now()/1000),
        model:"gpt-6.1-sol",status:"completed",output:[item],usage:{input_tokens:1,output_tokens:1,total_tokens:2}};
      res.writeHead(200,{"content-type":"text/event-stream"});
      for(const e of [{type:"response.created",response:{...response,status:"in_progress",output:[]}},
        {type:"response.output_item.done",output_index:0,item},{type:"response.completed",response}])
        res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
      res.end();
    }catch{res.writeHead(500);res.end("{}");}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  return {requests,provider:{baseUrl:`http://127.0.0.1:${server.address().port}/v1`,requiresAuth:false}};
}
export const codeItem=(input,id="call_tools")=>({type:"custom_tool_call",id,call_id:id,name:"exec",namespace:"functions",input,status:"completed"});
export const answerItem=value=>({type:"message",id:"answer",role:"assistant",status:"completed",
  content:[{type:"output_text",text:JSON.stringify(value),annotations:[]}]});
