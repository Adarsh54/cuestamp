const providers=new Set(['openai','anthropic']);
export function dawModelConfig(env=process.env){const provider=(env.DAW_AGENT_PROVIDER||'openai').trim();return {provider,key:(provider==='anthropic'?env.ANTHROPIC_API_KEY:env.OPENAI_API_KEY)?.trim(),model:env.DAW_AGENT_MODEL?.trim()};}
export function validDawModelConfig(config){return providers.has(config.provider)&&Boolean(config.key?.trim()&&config.model?.trim());}
const unavailable=()=>Object.assign(Error('The model request failed. Check the server provider configuration, credentials and model access.'),{status:503});
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
 let result;try{const response=await fetchImpl(url,{method:'POST',headers,signal,body:JSON.stringify(body)});if(!response.ok)throw unavailable();result=await response.json();}catch{throw unavailable();}
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
