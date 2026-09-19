import {scheduleEffectParameter} from './effect-automation.js';
export function tremoloRateEffect(effect,tempo=120){return effect.sync?{...effect,rate:tempo/60/effect.beats,automation:(effect.automation||[]).filter(p=>p.parameter!=='rate')}:effect;}
// Integrate the same piecewise-linear Hz curve scheduled on oscillator.frequency.
// The first point extends backwards to zero, matching other automation lanes.
export function tremoloCycles(effect,position){
 const points=(effect.automation||[]).filter(p=>p.parameter==='rate').sort((a,b)=>a.time-b.time);
 if(!points.length)return position*effect.rate;
 let total=0,time=0,value=points[0].value;
 for(const p of points){if(p.time===time){value=p.value;continue;}const end=Math.min(position,p.time);if(end>time){const last=value+(p.value-value)*(end-time)/(p.time-time);total+=(value+last)/2*(end-time);}if(position<=p.time)return total;time=p.time;value=p.value;}
 return total+Math.max(0,position-time)*value;
}
export function connectTremolo(context,input,effect,nodes,{position=0,base=context.currentTime,tempo=120}={}){
 const stereo=context.createGain(),split=context.createChannelSplitter(2),merge=context.createChannelMerger(2),rateEffect=tremoloRateEffect(effect,tempo),cycles=tremoloCycles(rateEffect,position);
 stereo.channelCount=2;stereo.channelCountMode='explicit';stereo.channelInterpretation='speakers';input.connect(stereo).connect(split);nodes.push(stereo,split,merge);
 for(let channel=0;channel<2;channel++){
  const amp=context.createGain(),depth=context.createGain(),osc=context.createOscillator(),phase=2*Math.PI*(cycles%1)+(effect.phase+channel*effect.stereoPhase)*Math.PI/180;
  osc.setPeriodicWave(context.createPeriodicWave(new Float32Array([0,Math.sin(phase)]),new Float32Array([0,Math.cos(phase)]),{disableNormalization:true}));
  scheduleEffectParameter(osc.frequency,rateEffect,'rate',position,base);
  scheduleEffectParameter(amp.gain,effect,'depth',position,base,d=>1-d/2);
  scheduleEffectParameter(depth.gain,effect,'depth',position,base,d=>d/2);
  split.connect(amp,channel);amp.connect(merge,0,channel);osc.connect(depth).connect(amp.gain);osc.start(base);nodes.push(amp,depth,osc);
 }
 return merge;
}
