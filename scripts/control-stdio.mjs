import {createInterface} from "node:readline";

export async function serveControlMcp({name,tools,invoke,errorMessage=()=>"CONTROL_REQUEST_REFUSED"}) {
  for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})) {
    if(Buffer.byteLength(line)>1024*1024){process.exitCode=1;break;}
    let r;try{r=JSON.parse(line);}catch{process.exitCode=1;break;}
    if(!r || typeof r!=="object"){process.exitCode=1;break;}
    if(!Object.hasOwn(r,"id"))continue;
    let result,error;
    try {
      if(r.jsonrpc!=="2.0")throw Error();
      if(r.method==="initialize")result={protocolVersion:"2024-11-05",capabilities:{tools:{}},serverInfo:{name,version:"0.1.0-candidate"}};
      else if(r.method==="ping")result={};
      else if(r.method==="tools/list")result={tools};
      else if(r.method==="tools/call" && tools.some(t=>t.name===r.params?.name)) {
        try{result={content:[{type:"text",text:JSON.stringify(await invoke(r.params.name,r.params.arguments??{}))}]};}
        catch(e){result={isError:true,content:[{type:"text",text:errorMessage(e)}]};}
      }else throw Error();
    }catch{error={code:-32601,message:"CONTROL_METHOD_NOT_AVAILABLE"};}
    process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:r.id,...(error?{error}:{result})})+"\n");
  }
}
