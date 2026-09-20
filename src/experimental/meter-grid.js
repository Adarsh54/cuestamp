import {compileMeterMap} from './meter-map.js';
import {compileTempoMap} from './tempo-map.js';
// Continuous grid coordinates: integers mark bar starts or notated beats.
// Relative moves retain fractional position in the selected grid unit.
export function meterGrid(session,grid){
 if(!['bar','beat'].includes(grid)||(!session.meterChanges?.length&&(session.meterDenominator??4)===4))return null;
 const meter=compileMeterMap(session),tempo=compileTempoMap(session);let count=0;
 const points=meter.points.map((p,i)=>{if(i){const prior=meter.points[i-1];count+=(p.bar-prior.bar)*prior.numerator;}return {...p,unit:grid==='bar'?p.bar-1:count,size:4/p.denominator*(grid==='bar'?p.numerator:1)};});
 const find=(value,key)=>{if(!Number.isFinite(value))throw Error('Choose a finite snap position.');let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>1;if(points[mid][key]<=value)lo=mid+1;else hi=mid;}return points[Math.max(0,lo-1)];};
 return {
  atTime(time){const beat=tempo.beatAtTime(time),p=find(beat,'beat');return p.unit+(beat-p.beat)/p.size;},
  timeAt(unit){const p=find(unit,'unit');return tempo.timeAtBeat(p.beat+(unit-p.unit)*p.size);},
  minimumSeconds:Math.min(...points.map(p=>p.size))*60/Math.max(...tempo.points.map(p=>p.bpm))
 };
}
