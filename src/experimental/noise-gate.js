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
export function connectNoiseGate(context,input,effect,nodes,{position,base,register,registerMeter,registerSidechain}){
 if(!context[stateKey]?.ready)throw Error('Prepare noise gate processing before starting audio.');
 const node=new AudioWorkletNode(context,'cuestamp-noise-gate',{numberOfInputs:2,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit',channelInterpretation:'speakers',processorOptions:{filterEnabled:effect.filterEnabled||Boolean(effect.sidechainTrackId),meter:Boolean(registerMeter)}});
 for(const key of ['threshold','reductionDb','hysteresis','attack','hold','release']){const param=node.parameters.get(key);register?.(effect,key,param,v=>v,false);scheduleEffectParameter(param,effect,key,position,base);}
 const detector=effect.sidechainTrackId?context.createGain():input;if(effect.sidechainTrackId){if(!registerSidechain)throw Error('Sidechain routing is unavailable.');registerSidechain(effect.sidechainTrackId,detector);nodes.push(detector);}
 if(effect.filterEnabled){const highpass=context.createBiquadFilter(),lowpass=context.createBiquadFilter();highpass.type='highpass';lowpass.type='lowpass';highpass.frequency.value=Math.min(effect.lowCutHz,context.sampleRate*.49);lowpass.frequency.value=Math.min(effect.highCutHz,context.sampleRate*.49);highpass.Q.value=lowpass.Q.value=Math.SQRT1_2;detector.connect(highpass).connect(lowpass).connect(node,0,1);nodes.push(highpass,lowpass);}else if(effect.sidechainTrackId)detector.connect(node,0,1);
 let reading=null;Object.defineProperty(node,'reduction',{get:()=>reading&&context.currentTime-reading.time<.5?reading.reduction:NaN});Object.defineProperty(node,'gateOpen',{get:()=>reading?.open});node.port.onmessage=event=>{const value=event.data;if(Number.isFinite(value?.time)&&Number.isFinite(value?.reduction)&&typeof value?.open==='boolean')reading={time:value.time,reduction:Math.max(-96,Math.min(0,value.reduction)),open:value.open};};registerMeter?.(effect,node);
 node.stop=()=>{reading=null;node.port.onmessage=null;node.port.postMessage('stop');node.port.close();};input.connect(node);nodes.push(node);return node;
}
