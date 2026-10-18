import {compileTempoMap} from './tempo-map.js';
export function syncedDelayTiming(effect,timing={},position=0){
 if(!Number.isFinite(effect.beats)||effect.beats<.125||effect.beats>8)throw Error('Choose a delay interval from 0.125 to 8 quarter-note beats.');
 const map=compileTempoMap(timing),seconds=bpm=>effect.beats*60/bpm;
 return {time:seconds(map.tempoAtTime(position)),maximum:Math.max(...map.points.map(p=>seconds(p.bpm))),changes:map.points.filter(p=>p.time>position).map(p=>({time:p.time,value:seconds(p.bpm)}))};
}
export function scheduleSyncedDelay(param,effect,timing,position,base){
 const sync=syncedDelayTiming(effect,timing,position);param.setValueAtTime(sync.time,base);
 for(const point of sync.changes)param.setValueAtTime(point.value,base+point.time-position);
}
