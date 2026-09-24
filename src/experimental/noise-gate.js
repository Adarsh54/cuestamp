import {scheduleEffectParameter} from './effect-automation.js';
// Context-owned state also survives Vite module reloads without registering twice.
const stateKey=Symbol.for('cuestamp.noiseGateProcessor');
export async function prepareSessionEffects(context,session){
 if(!session||![...(session.masterEffects||[]),...session.tracks.flatMap(t=>t.effects||[])].some(e=>e.enabled&&e.kind==='gate'))return;
 if(!context.audioWorklet)throw Error('Noise gate requires AudioWorklet support in this browser.');
 const state=context[stateKey]??={ready:false,promise:null};
 if(!state.promise)state.promise=(async()=>{try{const {default:url}=await import('./noise-gate.worklet.js?worker&url');await context.audioWorklet.addModule(url);state.ready=true;}catch(error){state.promise=null;throw error;}})();
 await state.promise;
}
export function connectNoiseGate(context,input,effect,nodes,{position,base,register}){
 if(!context[stateKey]?.ready)throw Error('Prepare noise gate processing before starting audio.');
 const node=new AudioWorkletNode(context,'cuestamp-noise-gate',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit',channelInterpretation:'speakers'});
 for(const key of ['threshold','reductionDb','hysteresis','attack','hold','release']){const param=node.parameters.get(key);register?.(effect,key,param,v=>v,false);scheduleEffectParameter(param,effect,key,position,base);}
 node.stop=()=>{node.port.postMessage('stop');node.port.close();};input.connect(node);nodes.push(node);return node;
}
