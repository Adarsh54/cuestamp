const providers=new Set(['openai','anthropic']);
export function dawModelConfig(env=process.env){const provider=(env.DAW_AGENT_PROVIDER||'openai').trim();return {provider,key:(provider==='anthropic'?env.ANTHROPIC_API_KEY:env.OPENAI_API_KEY)?.trim(),model:env.DAW_AGENT_MODEL?.trim()};}
export function validDawModelConfig(config){return providers.has(config.provider)&&Boolean(config.key?.trim()&&config.model?.trim());}
const failureMessages={
 authentication:'The model provider rejected the server API credentials. Check the configured provider key.',
 access:'The model provider denied access. Check the server account permissions and configured model.',
 model:'The configured model or provider endpoint was not found. Check DAW_AGENT_MODEL and model access.',
 capacity:'The model provider is limiting requests or the account has exhausted its quota. Check provider usage and billing before retrying.',
 size:'The model provider rejected the request size. Try a smaller session or a shorter conversation.',
 timeout:'The model request timed out. Try again; no edit plan was received.',
 network:'The model provider could not be reached. Check the server network connection and try again.',
 unavailable:'The model provider is temporarily unavailable. Try again later.',
 response:'The model provider returned an unreadable response. Try again later.',
 request:'The model provider rejected the request. Check model compatibility and server configuration.',
 unknown:'The model request failed. Check the server provider configuration, credentials and model access.'
};
export class DawModelError extends Error{
 constructor(code='unknown'){const safeCode=Object.hasOwn(failureMessages,code)?code:'unknown';super(failureMessages[safeCode]);this.name='DawModelError';this.code=safeCode;this.status=503;}
}
const unavailable=(code='unknown')=>new DawModelError(code);
const httpFailure=status=>status===401?'authentication':status===403?'access':status===404?'model':status===429?'capacity':status===413?'size':status>=500?'unavailable':status>=400?'request':'unknown';
export async function requestDawModel({provider='openai',key,model,tools,input,fetchImpl=fetch}){
 if(!validDawModelConfig({provider,key,model}))throw Object.assign(Error('The DAW agent needs a supported provider, server API key and model configuration.'),{status:503});
 const signal=AbortSignal.timeout(90000);let url,headers,body;
 if(provider==='openai'){
  url='https://api.openai.com/v1/responses';headers={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  body={model,store:false,max_output_tokens:6000,parallel_tool_calls:false,tools,input};
 }else{
  url='https://api.anthropic.com/v1/messages';headers={'x-api-key':key,'anthropic-version':'2023-06-01','Content-Type':'application/json'};
  body={model,max_tokens:6000,system:input.filter(m=>m.role==='developer'||m.role==='system').map(m=>m.content).join('\n\n'),messages:input.filter(m=>m.role==='user'||m.role==='assistant').map(m=>({role:m.role,content:m.content})),tools:tools.map(t=>({name:t.name,description:t.description,input_schema:t.parameters,...(t.strict?{strict:true}:{})})),tool_choice:{type:'auto',disable_parallel_tool_use:true}};
 }
 let response;
 try{response=await fetchImpl(url,{method:'POST',headers,signal,body:JSON.stringify(body)});}catch(error){throw unavailable(signal.aborted||error?.name==='TimeoutError'?'timeout':'network');}
 if(!response.ok)throw unavailable(httpFailure(response.status));
 let result;try{result=await response.json();}catch(error){throw unavailable(signal.aborted||error?.name==='TimeoutError'?'timeout':'response');}
 if(provider==='openai'){
  if(result?.status==='incomplete')return {status:'incomplete',output:[]};
  if(!result||!Array.isArray(result.output)||(result.status!==undefined&&result.status!=='completed'))throw unavailable();
  return result;
 }
 if(!result||!Array.isArray(result.content))throw unavailable();
 if(result.stop_reason==='max_tokens')return {status:'incomplete',output:[]};
 if(!['end_turn','tool_use'].includes(result.stop_reason))throw unavailable();
 const output=[];
 for(const block of result.content){
  if(block?.type==='tool_use'){
   if(typeof block.name!=='string'||!block.input||typeof block.input!=='object'||Array.isArray(block.input)||result.stop_reason!=='tool_use')throw unavailable();
   output.push({type:'function_call',name:block.name,arguments:JSON.stringify(block.input)});
  }else if(block?.type==='text'){
   if(typeof block.text!=='string')throw unavailable();output.push({type:'message',content:[{type:'output_text',text:block.text}]});
  }else if(!['thinking','redacted_thinking'].includes(block?.type))throw unavailable();
 }
 if(result.stop_reason==='tool_use'&&!output.some(item=>item.type==='function_call'))throw unavailable();
 return {status:'completed',output};
}
