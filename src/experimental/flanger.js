import {scheduleEffectParameter} from './effect-automation.js';
import {modulationTiming} from './modulation-timing.js';
const stateKey=Symbol.for('cuestamp.flangerProcessor');
export async function prepareFlanger(context,session){
 if(!session||![...(session.masterEffects||[]),...session.tracks.flatMap(t=>t.effects||[])].some(e=>e.enabled&&e.kind==='flanger'))return;
 if(!context.audioWorklet)throw Error('Flanger requires AudioWorklet support.');
 const state=context[stateKey]??={ready:false,promise:null};
 if(!state.promise)state.promise=(async()=>{try{const {default:url}=await import('./flanger.worklet.js?worker&url');await context.audioWorklet.addModule(url);state.ready=true;}catch(error){state.promise=null;throw error;}})();
 await state.promise;
}
export function connectFlanger(context,input,effect,nodes,{position=0,base=context.currentTime,tempo=120,tempoChanges=[],register}={}){
 if(!context[stateKey]?.ready)throw Error('Prepare flanger processing before starting audio.');
 const node=new AudioWorkletNode(context,'cuestamp-flanger',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit',channelInterpretation:'speakers'});
 const schedule=(param,key)=>{register?.(effect,key,param,v=>v,false);scheduleEffectParameter(param,effect,key,position,base);},timing=modulationTiming(effect,{position,base,tempo,tempoChanges,register});
 for(const key of ['feedback','mix'])schedule(node.parameters.get(key),key);
 for(let c=0;c<2;c++){
  const osc=context.createOscillator(),depth=context.createGain(),phase=2*Math.PI*(timing.cycles%1)+c*effect.stereoPhase*Math.PI/180;
  osc.setPeriodicWave(context.createPeriodicWave(new Float32Array([0,Math.sin(phase)]),new Float32Array([0,Math.cos(phase)]),{disableNormalization:true}));timing.scheduleRate(osc.frequency);schedule(depth.gain,'depthMs');
  osc.connect(depth).connect(node.parameters.get(c?'rightMs':'leftMs'));osc.start(base);nodes.push(osc,depth);
 }
 node.stop=()=>{node.port.postMessage('stop');node.port.close();};input.connect(node);nodes.push(node);return node;
}
