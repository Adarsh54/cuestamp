import {sceneSourceSignature} from './scene-source.js';
import {z} from 'zod';
import {validateScenes} from './scenes.js';
import {audibleSources} from './routing.js';
export const sceneAuditionSchema=z.object({sceneId:z.string().min(1).max(100),duration:z.number().finite().min(.1).max(600)}).strict();
export const sceneQueueSchema=sceneAuditionSchema.extend({quantization:z.enum(['immediate','beat','bar'])});
// A temporary arrangement lets scene playback share the native instruments,
// routing and automation scheduler. Never persist these expanded regions.
export function sceneAudition(session,values){
 const {sceneId,duration}=sceneAuditionSchema.parse(values);validateScenes(session);
 const scene=session.scenes.find(s=>s.id===sceneId);if(!scene)throw Error('Scene not found.');
 const audible=new Set(audibleSources(session).flatMap(t=>t.regions.map(r=>r.id)));
 const cells=new Map(scene.cells.filter(c=>audible.has(c.regionId)).map(c=>[c.regionId,c]));
 if(!cells.size)throw Error('This scene has no audible clips. Assign clips and check mute and solo settings.');
 let total=0,events=0;const plans=[];
 for(const track of session.tracks)for(const region of track.regions){const cell=cells.get(region.id);if(!cell)continue;
  const count=cell.loop?Math.ceil(duration/region.duration):1;total+=count;events+=count*((region.notes?.length||0)+(region.events?.length||0));
  if(total>10000||events>200000)throw Error('This scene schedules too many clips or MIDI events. Choose a shorter audition duration.');
  plans.push({trackId:track.id,region,count});
 }
 const document=structuredClone(session);for(const track of document.tracks)track.regions=[];
 const tracks=new Map(document.tracks.map(t=>[t.id,t]));
 for(const {trackId,region,count} of plans)for(let i=0;i<count;i++)tracks.get(trackId).regions.push({...structuredClone(region),id:`scene-${trackId}-${i}`,start:i*region.duration});
 document.scenes=[];document.loopEnabled=false;document.metronomeEnabled=false;
 return {kind:'scene',sceneId,sourceSignature:sceneSourceSignature(session,sceneId),document,position:0,end:duration,label:`Auditioning scene “${scene.name}” for ${duration} s`};
}
