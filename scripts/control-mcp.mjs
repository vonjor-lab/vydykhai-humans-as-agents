// Minimal stdio MCP adapter for the single registered-command capability.
// JSON-RPC method selection, not prompt text, defines the exposed authority.
import {serveControlMcp} from "./control-stdio.mjs";
import {openWorkerEndpoint} from "./control-endpoint.mjs";
import {createReturnSync, parseDurableOutboxComment} from "./vydykhai.mjs";

const endpoint = await openWorkerEndpoint(process.argv[2], {createReturnSync, parseDurableOutboxComment});
const tool = {name: "execute_registered", description: "Execute one host-registered task request after independent admission. Cannot approve, retry, or alter a request.",
  inputSchema: {type: "object", properties: {requestId: {type: "string"}}, required: ["requestId"], additionalProperties: false},
  annotations: {readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false}};
await serveControlMcp({name:"vydykhai-controlled-worker",tools:[tool],invoke:(_name,args)=>endpoint.execute(args)});
