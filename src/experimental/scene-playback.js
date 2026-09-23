import {createSceneSourceReader} from './scene-source.js';
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
 const signature=createSceneSourceReader(session),sourceCells=plans.map(({trackId,region})=>({trackId,sourceSignature:signature(sceneId,trackId),duration:cells.get(region.id).loop?duration:Math.min(duration,region.duration)}));
 return {kind:'scene',sceneId,sourceCells,sourceSignature:signature(sceneId),document,position:0,end:duration,label:`Auditioning scene “${scene.name}” for ${duration} s`};
}

export const sceneCellLaunchSchema=sceneQueueSchema.extend({trackId:z.string().min(1).max(100)});
export function sceneCellPlan(session,values){
 const {sceneId,trackId,duration,quantization}=sceneCellLaunchSchema.parse(values),scene=session.scenes.find(s=>s.id===sceneId),track=session.tracks.find(t=>t.id===trackId);
 const cell=scene?.cells.find(c=>track?.regions.some(r=>r.id===c.regionId));if(!cell)throw Error('Assign a clip to this cell before launching it.');
 const document={...session,scenes:session.scenes.map(s=>s.id===sceneId?{...s,cells:[cell]}:s)},plan=sceneAudition(document,{sceneId,duration}),regions=plan.document.tracks.find(t=>t.id===trackId).regions;
 return {plan,trackId,quantization,regions};
}

export const sceneCellStopSchema=z.object({trackId:z.string().min(1).max(100),quantization:z.enum(['immediate','beat','bar'])}).strict();
export function validateSceneCellStop(session,value){const v=sceneCellStopSchema.parse(value);if(!session.tracks.some(t=>t.id===v.trackId&&['audio','midi'].includes(t.kind)))throw Error('Choose an audio or MIDI track.');return v;}
