import {serveControlMcp} from "./control-stdio.mjs";
import {openReviewSources} from "./control-review-sources.mjs";

const sources = await openReviewSources(process.argv[2]);
const tools = [
  {name:"list_sources",description:"List host-registered original evidence. Not a preparer summary; missing evidence stays unknown.",
    inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
  {name:"read_source",description:"Read one original evidence source by registered id, with actual content hash. Cannot write or approve actions.",
    inputSchema:{type:"object",properties:{id:{type:"string"}},required:["id"],additionalProperties:false},annotations:{readOnlyHint:true}},
  {name:"recall_memory",description:"Locate candidate public routes and prior obligations from an ordinary request in a registered Graph v4 or manifest with independently registered whole parts. Parts are verified locally, not dumped into context. Not completeness or admission; unavailable evidence remains a gap. Cannot follow unregistered paths, read implementations or change memory.",
    inputSchema:{type:"object",properties:{id:{type:"string"},request:{type:"string"}},required:["id","request"],additionalProperties:false},annotations:{readOnlyHint:true}}
];
await serveControlMcp({name:"vydykhai-review-sources",tools,invoke:async(name,args)=>{
  if(name==="list_sources") {if(Object.keys(args).length)throw Error();return sources.list();}
  if(name==="recall_memory") return sources.recallMemory(args);
  return sources.read(args);
}});
