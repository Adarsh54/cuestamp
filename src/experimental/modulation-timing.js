import {compileTempoMap} from './tempo-map.js';
import {activeAutomation} from './automation-mode.js';
import {integrateAutomation} from './automation-curves.js';
import {scheduleEffectParameter} from './effect-automation.js';

// Use the same curve integration for all free-running modulation effects.
export function freeLfoCycles(effect,position){return integrateAutomation(activeAutomation(effect),'rate',position,effect.rate);}
export function syncedLfoTiming(effect,timing,position){
 if(!Number.isFinite(effect.beats)||effect.beats<=0)throw Error('Choose a positive modulation beat interval.');
 const map=compileTempoMap(timing);
 return {cycles:map.beatAtTime(position)/effect.beats,rate:map.tempoAtTime(position)/60/effect.beats,changes:map.points.filter(p=>p.time>position).map(p=>({time:p.time,rate:p.bpm/60/effect.beats}))};
}
export function modulationTiming(effect,{position=0,base=0,tempo=120,tempoChanges=[],register}={}){
 const sync=effect.sync?syncedLfoTiming(effect,{tempo,tempoChanges},position):null;
 return {
  cycles:sync?sync.cycles:freeLfoCycles(effect,position),
  scheduleRate(param){
   if(sync){
    param.setValueAtTime(sync.rate,base);
    for(const point of sync.changes)param.setValueAtTime(point.rate,base+point.time-position);
   }else{
    register?.(effect,'rate',param,v=>v,false);
    scheduleEffectParameter(param,effect,'rate',position,base);
   }
  },
 };
}
