import {compileTempoMap} from './tempo-map.js';
import {activeAutomation} from './automation-mode.js';
import {integrateAutomation} from './automation-curves.js';
import {scheduleEffectParameter} from './effect-automation.js';
export function tremoloRateEffect(effect,tempo=120){return effect.sync?{...effect,rate:tempo/60/effect.beats,automation:(effect.automation||[]).filter(p=>p.parameter!=='rate')}:effect;}
// Integrate the exact piecewise curve used for oscillator scheduling.
export function tremoloCycles(effect,position){return integrateAutomation(activeAutomation(effect),'rate',position,effect.rate);}
export function syncedTremoloTiming(effect,timing,position){
 if(!Number.isFinite(effect.beats)||effect.beats<=0)throw Error('Choose a positive tremolo beat interval.');const map=compileTempoMap(timing);return {cycles:map.beatAtTime(position)/effect.beats,rate:map.tempoAtTime(position)/60/effect.beats,changes:map.points.filter(p=>p.time>position).map(p=>({time:p.time,rate:p.bpm/60/effect.beats}))};
}
export function connectTremolo(context,input,effect,nodes,{position=0,base=context.currentTime,tempo=120,tempoChanges=[]}={}){
 const stereo=context.createGain(),split=context.createChannelSplitter(2),merge=context.createChannelMerger(2),rateEffect=tremoloRateEffect(effect,tempo),sync=effect.sync&&tempoChanges.length?syncedTremoloTiming(effect,{tempo,tempoChanges},position):null,cycles=sync?sync.cycles:tremoloCycles(rateEffect,position);
 stereo.channelCount=2;stereo.channelCountMode='explicit';stereo.channelInterpretation='speakers';input.connect(stereo).connect(split);nodes.push(stereo,split,merge);
 for(let channel=0;channel<2;channel++){
  const amp=context.createGain(),depth=context.createGain(),osc=context.createOscillator(),phase=2*Math.PI*(cycles%1)+(effect.phase+channel*effect.stereoPhase)*Math.PI/180;
  osc.setPeriodicWave(context.createPeriodicWave(new Float32Array([0,Math.sin(phase)]),new Float32Array([0,Math.cos(phase)]),{disableNormalization:true}));
  if(sync){osc.frequency.setValueAtTime(sync.rate,base);for(const point of sync.changes)osc.frequency.setValueAtTime(point.rate,base+point.time-position);}else scheduleEffectParameter(osc.frequency,rateEffect,'rate',position,base);
  scheduleEffectParameter(amp.gain,effect,'depth',position,base,d=>1-d/2);
  scheduleEffectParameter(depth.gain,effect,'depth',position,base,d=>d/2);
  split.connect(amp,channel);amp.connect(merge,0,channel);osc.connect(depth).connect(amp.gain);osc.start(base);nodes.push(amp,depth,osc);
 }
 return merge;
}
