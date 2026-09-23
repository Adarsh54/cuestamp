import {z} from 'zod';
import {validateScenes} from './scenes.js';
import {trimmedRegion,trimmedMidiRegion} from './region-edit.js';
const options=z.object({position:z.number().finite().min(0).max(86400),duration:z.number().finite().min(.1).max(600),overlap:z.enum(['reject','allow']).default('reject')}).strict();
export function placeScene(session,sceneId,values){
 const v=options.parse(values),end=v.position+v.duration;validateScenes(session);
 if(end>86400)throw Error('The scene must fit within the timeline.');
 const scene=session.scenes.find(s=>s.id===sceneId);if(!scene)throw Error('Scene not found.');
 if(!scene.cells.length)throw Error('Assign clips to the scene before placing it.');
 const sources=new Map(session.tracks.flatMap(track=>track.regions.map(region=>[region.id,{track,region}]))),plans=[];
 let count=0,events=0;
 // Check limits and collisions before allocating copies or modifying tracks.
 for(const cell of scene.cells){
  const {track,region}=sources.get(cell.regionId),copies=cell.loop?Math.ceil(v.duration/region.duration):1;
  if(track.protected)throw Error(`Unprotect ${track.name} before editing its contents.`);
  if(track.regions.length+copies>1000)throw Error('Placing this scene would exceed the 1,000-region track limit.');
  count+=copies;events+=copies*(region.notes.length+region.events.length);
  if(count>10000||events>200000)throw Error('Choose a shorter scene duration to reduce the number of clips or MIDI events.');
  const trackEnd=v.position+(cell.loop?v.duration:Math.min(v.duration,region.duration));
  if(v.overlap==='reject'&&track.regions.some(r=>r.start<trackEnd&&r.start+r.duration>v.position))throw Error(`The scene overlaps existing clips on ${track.name}. Choose an empty range or allow overlap.`);
  plans.push({track,region,copies});
 }
 for(const {track,region,copies} of plans)for(let i=0;i<copies;i++){
  const start=v.position+i*region.duration,length=Math.min(region.duration,end-start);
  if(length<=0)continue;
  let copy=structuredClone(region);
  if(length<region.duration)Object.assign(copy,(track.kind==='midi'?trimmedMidiRegion:trimmedRegion)(copy,copy.start,copy.start+length));
  copy.id=crypto.randomUUID();copy.start=start;
  copy.notes=copy.notes.map(n=>({...n,id:crypto.randomUUID()}));
  copy.events=copy.events.map(e=>({...e,id:crypto.randomUUID()}));
  delete copy.takeGroup;
  track.regions.push(copy);
 }
}
