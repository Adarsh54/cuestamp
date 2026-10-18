import {scheduleEffectParameter} from './effect-automation.js';
const key=Symbol.for('cuestamp.limiterProcessor');
export async function prepareLimiter(context,session){
 if(!session||![...(session.masterEffects||[]),...session.tracks.flatMap(t=>t.effects||[])].some(e=>e.enabled&&e.kind==='limiter'))return;
 if(!context.audioWorklet)throw Error('Limiter requires AudioWorklet support in this browser.');
 const state=context[key]??={ready:false,promise:null};
 if(!state.promise)state.promise=(async()=>{try{const {default:url}=await import('./limiter.worklet.js?worker&url');await context.audioWorklet.addModule(url);state.ready=true;}catch(error){state.promise=null;throw error;}})();
 await state.promise;
}
export function connectLimiter(context,input,effect,nodes,{position,base,register,registerMeter}){
 if(!context[key]?.ready)throw Error('Prepare limiter processing before starting audio.');
 const node=new AudioWorkletNode(context,'cuestamp-limiter',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit',channelInterpretation:'speakers',processorOptions:{lookaheadMs:effect.lookaheadMs,meter:Boolean(registerMeter)}});
 for(const name of ['gainDb','ceilingDb','release']){const param=node.parameters.get(name);register?.(effect,name,param,v=>v,false);scheduleEffectParameter(param,effect,name,position,base);}
 let reading;Object.defineProperty(node,'reduction',{get:()=>reading&&context.currentTime-reading.time<.5?reading.reduction:NaN});node.port.onmessage=({data})=>{if(Number.isFinite(data?.time)&&Number.isFinite(data?.reduction))reading=data;};
 node.stop=()=>{reading=null;node.port.onmessage=null;node.port.postMessage('stop');node.port.close();};registerMeter?.(effect,node);input.connect(node);nodes.push(node);return node;
}
