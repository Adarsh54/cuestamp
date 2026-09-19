import {scheduleEffectParameter} from './effect-automation.js';
import {tremoloCycles} from './tremolo.js';
// One modulated delay voice per stereo channel. Delay remains positive even at
// maximum depth (25 ms base +/- 20 ms), independently of automation.
export function connectChorus(context,input,effect,nodes,{position=0,base=context.currentTime}={}){
 const stereo=context.createGain(),split=context.createChannelSplitter(2),merge=context.createChannelMerger(2),cycles=tremoloCycles(effect,position);
 stereo.channelCount=2;stereo.channelCountMode='explicit';stereo.channelInterpretation='speakers';input.connect(stereo).connect(split);nodes.push(stereo,split,merge);
 for(let channel=0;channel<2;channel++){
  const dry=context.createGain(),wet=context.createGain(),delay=context.createDelay(.1),depth=context.createGain(),osc=context.createOscillator(),phase=2*Math.PI*(cycles%1)+channel*effect.stereoPhase*Math.PI/180;
  delay.delayTime.setValueAtTime(.025,base);
  osc.setPeriodicWave(context.createPeriodicWave(new Float32Array([0,Math.sin(phase)]),new Float32Array([0,Math.cos(phase)]),{disableNormalization:true}));
  scheduleEffectParameter(osc.frequency,effect,'rate',position,base);
  scheduleEffectParameter(depth.gain,effect,'depthMs',position,base,v=>v/1000);
  scheduleEffectParameter(dry.gain,effect,'mix',position,base,v=>1-v);
  scheduleEffectParameter(wet.gain,effect,'mix',position,base);
  split.connect(dry,channel);dry.connect(merge,0,channel);split.connect(delay,channel);delay.connect(wet);wet.connect(merge,0,channel);
  osc.connect(depth).connect(delay.delayTime);osc.start(base);nodes.push(dry,wet,delay,depth,osc);
 }
 return merge;
}
