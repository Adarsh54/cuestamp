import {scheduleEffectParameter} from './effect-automation.js';
import {syncedDelayTiming,scheduleSyncedDelay} from './delay-timing.js';
const stateKey=Symbol.for('cuestamp.pingPongProcessor');
export async function preparePingPong(context,session){
 if(!session||![...(session.masterEffects||[]),...session.tracks.flatMap(t=>t.effects||[])].some(e=>e.enabled&&e.kind==='delay'&&e.mode==='pingPong'))return;
 if(!context.audioWorklet)throw Error('Ping-pong delay requires AudioWorklet support.');
 const state=context[stateKey]??={ready:false,promise:null};
 if(!state.promise)state.promise=(async()=>{try{const {default:url}=await import('./ping-pong.worklet.js?worker&url');await context.audioWorklet.addModule(url);state.ready=true;}catch(error){state.promise=null;throw error;}})();
 await state.promise;
}
export function connectPingPong(context,input,effect,nodes,{position,base,tempo,tempoChanges,register}){
 if(!context[stateKey]?.ready)throw Error('Prepare ping-pong delay before starting audio.');
 const timing={tempo,tempoChanges},maximum=effect.sync?syncedDelayTiming(effect,timing).maximum:2;
 const node=new AudioWorkletNode(context,'cuestamp-ping-pong',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit',channelInterpretation:'speakers',processorOptions:{maximum}});
 const time=node.parameters.get('time'),feedback=node.parameters.get('feedback');
 if(effect.sync)scheduleSyncedDelay(time,effect,timing,position,base);else{register?.(effect,'time',time,v=>v,false);scheduleEffectParameter(time,effect,'time',position,base);}
 register?.(effect,'feedback',feedback,v=>v,false);scheduleEffectParameter(feedback,effect,'feedback',position,base);
 node.stop=()=>{node.port.postMessage('stop');node.port.close();};input.connect(node);nodes.push(node);return node;
}
