import {modulationTiming} from './modulation-timing.js';
export {freeLfoCycles as tremoloCycles,syncedLfoTiming as syncedTremoloTiming} from './modulation-timing.js';
import {scheduleEffectParameter} from './effect-automation.js';
export function tremoloRateEffect(effect,tempo=120){return effect.sync?{...effect,rate:tempo/60/effect.beats,automation:(effect.automation||[]).filter(p=>p.parameter!=='rate')}:effect;}
export function connectTremolo(context,input,effect,nodes,{position=0,base=context.currentTime,tempo=120,tempoChanges=[],register}={}){
 const schedule=(param,effect,key,position,base,transform=v=>v)=>{if(!(effect.sync&&key==='rate'))register?.(effect,key,param,transform,false);scheduleEffectParameter(param,effect,key,position,base,transform);};
 const stereo=context.createGain(),split=context.createChannelSplitter(2),merge=context.createChannelMerger(2),timing=modulationTiming(effect,{position,base,tempo,tempoChanges,register}),cycles=timing.cycles;
 stereo.channelCount=2;stereo.channelCountMode='explicit';stereo.channelInterpretation='speakers';input.connect(stereo).connect(split);nodes.push(stereo,split,merge);
 for(let channel=0;channel<2;channel++){
  const amp=context.createGain(),depth=context.createGain(),osc=context.createOscillator(),phase=2*Math.PI*(cycles%1)+(effect.phase+channel*effect.stereoPhase)*Math.PI/180;
  osc.setPeriodicWave(context.createPeriodicWave(new Float32Array([0,Math.sin(phase)]),new Float32Array([0,Math.cos(phase)]),{disableNormalization:true}));
  timing.scheduleRate(osc.frequency);
  schedule(amp.gain,effect,'depth',position,base,d=>1-d/2);
  schedule(depth.gain,effect,'depth',position,base,d=>d/2);
  split.connect(amp,channel);amp.connect(merge,0,channel);osc.connect(depth).connect(amp.gain);osc.start(base);nodes.push(amp,depth,osc);
 }
 return merge;
}
