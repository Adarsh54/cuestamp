import {scheduleEffectParameter} from './effect-automation.js';
import {syncedDelayTiming,scheduleSyncedDelay} from './delay-timing.js';
const stateKey=Symbol.for('cuestamp.feedbackDelayProcessor');
export async function prepareDelay(context,session){
 if(!session||![...(session.masterEffects||[]),...session.tracks.flatMap(t=>t.effects||[])].some(e=>e.enabled&&e.kind==='delay'))return;
 if(!context.audioWorklet)throw Error('Delay requires AudioWorklet support.');
 const state=context[stateKey]??={ready:false,promise:null};
 if(!state.promise)state.promise=(async()=>{try{const {default:url}=await import('./delay.worklet.js?worker&url');await context.audioWorklet.addModule(url);state.ready=true;}catch(error){state.promise=null;throw error;}})();
 await state.promise;
}
export function connectDelay(context,input,effect,nodes,{position=0,base=context.currentTime,tempo=120,tempoChanges=[],register}={}){
 if(!context[stateKey]?.ready)throw Error('Prepare delay processing before starting audio.');
 const timing={tempo,tempoChanges},maximum=effect.sync?syncedDelayTiming(effect,timing).maximum:2;
 const node=new AudioWorkletNode(context,'cuestamp-feedback-delay',{numberOfInputs:1,numberOfOutputs:1,...(effect.mode==='pingPong'?{outputChannelCount:[2],channelCount:2,channelCountMode:'explicit'}:{channelCount:2,channelCountMode:'max'}),channelInterpretation:'speakers',processorOptions:{maximum,mode:effect.mode??'stereo'}});
 const time=node.parameters.get('time'),feedback=node.parameters.get('feedback');
 if(effect.sync)scheduleSyncedDelay(time,effect,timing,position,base);else{register?.(effect,'time',time,v=>v,false);scheduleEffectParameter(time,effect,'time',position,base);}
 register?.(effect,'feedback',feedback,v=>v,false);scheduleEffectParameter(feedback,effect,'feedback',position,base);
 node.stop=()=>{node.port.postMessage('stop');node.port.close();};input.connect(node);nodes.push(node);return node;
}
