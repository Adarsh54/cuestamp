import {z} from 'zod';
import {splitRegion,splitCompReferences} from './region-split.js';
const options=z.object({times:z.string().min(1).max(25000)}).strict();
const timesSchema=z.array(z.number().finite().nonnegative()).min(1).max(999);
export function splitAudioAtTimes(track,region,values){
 const v=options.parse(values),times=timesSchema.parse(JSON.parse(v.times));
 if(track.kind!=='audio')throw Error('Choose an audio region.');
 if(track.regions.length+times.length>1000)throw Error('Splitting would exceed the 1,000-region track limit.');
 if(times.some((time,i)=>time<=region.start||time>=region.start+region.duration||(i&&time<=times[i-1])))throw Error('Split times must be ordered, distinct and inside the region.');
 for(const comp of track.compAlternatives||[]){const extra=comp.segments.reduce((n,s)=>n+(s.regionId===region.id?times.filter(t=>t>s.start&&t<s.end).length:0),0);if(comp.segments.length+extra>64)throw Error('Splitting would exceed the 64-section comp limit. Remove or simplify the saved comp first.');}
 for(const time of [...times].reverse()){const {left,right}=splitRegion(region,time,'audio');Object.assign(region,left);track.regions.push(right);splitCompReferences(track,region.id,time,right.id);}
}
export function transientSplitCommand(session,analysis){
 if(!analysis||analysis.sessionId!==session.id||analysis.revision!==session.revision)throw Error('Attack detection is stale. Detect attacks again.');
 const region=session.tracks.flatMap(t=>t.regions).find(r=>r.id===analysis.regionId);if(!region)throw Error('The source region no longer exists.');
 if(!analysis.markers.length)throw Error('No attacks to split.');
 return {op:'region.splitAtTimes',target:region.id,values:{times:JSON.stringify(analysis.markers.map(t=>region.start+t))}};
}
