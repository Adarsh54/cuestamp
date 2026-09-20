import {z} from 'zod';
import {trimmedRegion,splitMidiRegion} from './region-edit.js';
import {chasedEvents} from './midi-events.js';
import {selectedRegions} from './region-selection.js';

// Audio offsets refer to the original (forward) source. Cutting reversed audio
// therefore leaves the high source interval on the left of the timeline.
export function splitRegion(region,time,kind){
 const at=time-region.start;
 if(!Number.isFinite(at)||at<=0||at>=region.duration)throw Error('Split must be inside the region.');
 if(kind==='midi')return splitMidiRegion(region,time);
 const left={...structuredClone(region),...trimmedRegion(region,region.start,time),fadeIn:Math.min(region.fadeIn,at),fadeOut:0};
 const right={...structuredClone(region),...trimmedRegion(region,time,region.start+region.duration),id:crypto.randomUUID(),fadeIn:0,fadeOut:Math.min(region.fadeOut,region.duration-at)};
 // Keep any stored event payload well-formed even on non-MIDI regions.
 left.events=(region.events||[]).filter(e=>e.start<at).map(e=>({...e}));
 right.events=[...chasedEvents(region.events||[],at),...(region.events||[]).filter(e=>e.start>=at).map(e=>({...e,id:crypto.randomUUID(),start:e.start-at}))];
 left.notes=region.notes.filter(n=>n.start<at).map(n=>({...n,duration:Math.min(n.duration,at-n.start)}));
 right.notes=region.notes.filter(n=>n.start+n.duration>at).map(n=>({...n,id:crypto.randomUUID(),start:Math.max(0,n.start-at),duration:Math.min(n.duration,n.start+n.duration-at)}));
 return {left,right};
}
export function splitCompReferences(track,regionId,time,rightId){
 for(const alternative of track.compAlternatives||[])alternative.segments=alternative.segments.flatMap(segment=>{
  if(segment.regionId!==regionId||segment.end<=time)return [segment];
  if(segment.start>=time)return [{...segment,regionId:rightId}];
  return [{...segment,end:time},{...segment,regionId:rightId,start:time}];
 });
}
const options=z.object({regionIds:z.string().min(1).max(101000),time:z.number().finite().min(0).max(86400)}).strict();
export function splitSelectedRegions(session,values){
 const v=options.parse(values),regions=selectedRegions(session,v.regionIds.split(','));
 const ids=new Set(regions.filter(r=>r.start<v.time&&r.start+r.duration>v.time).map(r=>r.id));
 if(!ids.size)throw Error('Place the playhead inside at least one selected region.');
 for(const track of session.tracks){
  if(track.regions.length+track.regions.filter(r=>ids.has(r.id)).length>1000)throw Error('Splitting would exceed the 1,000-region track limit.');
  track.regions=track.regions.flatMap(region=>{
   if(!ids.has(region.id))return [region];
   const {left,right}=splitRegion(region,v.time,track.kind);splitCompReferences(track,region.id,v.time,right.id);return [left,right];
  });
 }
}

// Keep comp bounds within surviving regions when timestamp arithmetic differs
// by a few ULPs. Larger discrepancies remain stale and must be edited by the user.
export function clampCompRounding(track){
 const regionsById=new Map(track.regions.map(r=>[r.id,r]));
 for(const comp of track.compAlternatives||[])for(const segment of comp.segments){const region=regionsById.get(segment.regionId);if(!region)continue;const stop=region.start+region.duration;if(segment.start<region.start&&region.start-segment.start<=1e-9)segment.start=region.start;if(segment.end>stop&&segment.end-stop<=1e-9)segment.end=stop;}
}
