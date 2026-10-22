import {serveControlMcp} from "./control-stdio.mjs";
import {openReviewSources} from "./control-review-sources.mjs";
import {openWindowReader} from "./control-review-acquisition.mjs";
import {openReviewSubmission,submissionErrorCode} from "./control-review-submission.mjs";

const sources = await openReviewSources(process.argv[2]);
const policy = process.argv[3] === undefined ? undefined : JSON.parse(process.argv[3])??undefined;
const reader = policy === undefined ? sources : openWindowReader(sources, policy);
const submission = process.argv[4] === undefined ? null : await openReviewSubmission(process.argv[4],sources,reader,policy);
const tools = [
  {name:"list_sources",description:"List host-registered original evidence. Not a preparer summary; missing evidence stays unknown.",
    inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
  {name:"read_source",description:policy === undefined ? "Read one original evidence source by registered id, with actual content hash. Cannot write or approve actions." :
    `Read an exact original window by registered id. Offsets/length count Unicode code points; default length ${policy.maxChars}. Paginate required sources until fully acquired. Slice ids/hashes do not prove whole-source acquisition. Total text budget ${policy.maxBytes} bytes; exhaustion returns NEEDS_DISCOVERY, never missing or PASS. No write or approval.`,
    inputSchema:{type:"object",properties:{id:{type:"string"},...(policy === undefined ? {} :
      {offset:{type:"integer",minimum:0},length:{type:"integer",minimum:1,maximum:policy.maxChars}})},required:["id"],additionalProperties:false},annotations:{readOnlyHint:true}},
  {name:"recall_memory",description:"Locate candidate public routes and prior obligations from an ordinary request in a registered Graph v4 or manifest with independently registered whole parts. Parts are verified locally, not dumped into context. Not completeness or admission; unavailable evidence remains a gap. Cannot follow unregistered paths, read implementations or change memory.",
    inputSchema:{type:"object",properties:{id:{type:"string"},request:{type:"string"}},required:["id","request"],additionalProperties:false},annotations:{readOnlyHint:true}}
];
if(submission)tools.push({name:"submit_review",description:"Submit the complete assigned review as control.review-answer.v2. Validates coverage and acquired citations, then durably saves the decision. Not execution approval. After REVIEW_RECEIVED, no final message or further tools are needed.",
  inputSchema:{type:"object",properties:{answer:{type:"object"}},required:["answer"],additionalProperties:false}});
await serveControlMcp({name:"vydykhai-review-sources",tools,
  ...(submission?{errorMessage:e=>submissionErrorCode(e.message)}:{}),invoke:async(name,args)=>{
  if(name==="list_sources") {if(Object.keys(args).length)throw Error();return sources.list();}
  if(name==="recall_memory") {if(policy !== undefined)throw Error("CONTROL_PROFILE_RECALL_WINDOW_UNSUPPORTED");return sources.recallMemory(args);}
  if(name==="submit_review")return submission.submit(args);
  return (submission??reader).read(args);
}});
