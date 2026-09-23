import {scheduleEffectParameter} from './effect-automation.js';
import {tremoloCycles,syncedTremoloTiming} from './tremolo.js';

// Four second-order all-pass stages, mixed with the dry signal to create notches.
// Detune modulation keeps the sweep positive. Reserve two octaves below Nyquist
// so the maximum depth remains safe even when the center is automated live.
export function connectPhaser(context,input,effect,nodes,{position=0,base=context.currentTime,tempo=120,tempoChanges=[],register}={}){
 const schedule=(param,key,transform=v=>v)=>{
  register?.(effect,key,param,transform,false);
  scheduleEffectParameter(param,effect,key,position,base,transform);
 };
 const stereo=context.createGain(),split=context.createChannelSplitter(2),merge=context.createChannelMerger(2),sync=effect.sync?syncedTremoloTiming(effect,{tempo,tempoChanges},position):null,cycles=sync?sync.cycles:tremoloCycles(effect,position);
 stereo.channelCount=2;stereo.channelCountMode='explicit';stereo.channelInterpretation='speakers';
 input.connect(stereo).connect(split);nodes.push(stereo,split,merge);
 for(let channel=0;channel<2;channel++){
  const dry=context.createGain(),wet=context.createGain(),depth=context.createGain(),osc=context.createOscillator();
  const phase=2*Math.PI*(cycles%1)+channel*effect.stereoPhase*Math.PI/180;
  osc.setPeriodicWave(context.createPeriodicWave(new Float32Array([0,Math.sin(phase)]),new Float32Array([0,Math.cos(phase)]),{disableNormalization:true}));
  if(sync){
   osc.frequency.setValueAtTime(sync.rate,base);
   for(const point of sync.changes)osc.frequency.setValueAtTime(point.rate,base+point.time-position);
  }else schedule(osc.frequency,'rate');
  schedule(depth.gain,'depthCents');
  schedule(dry.gain,'mix',v=>1-v);schedule(wet.gain,'mix');
  split.connect(dry,channel);dry.connect(merge,0,channel);osc.connect(depth);
  let previous=null;
  for(let stage=0;stage<4;stage++){
   const filter=context.createBiquadFilter();filter.type='allpass';filter.Q.setValueAtTime(Math.SQRT1_2,base);
   schedule(filter.frequency,'frequency',v=>Math.min(v,(context.sampleRate/2-1)/4));
   depth.connect(filter.detune);
   if(previous)previous.connect(filter);else split.connect(filter,channel);
   previous=filter;nodes.push(filter);
  }
  previous.connect(wet);wet.connect(merge,0,channel);osc.start(base);nodes.push(dry,wet,depth,osc);
 }
 return merge;
}
