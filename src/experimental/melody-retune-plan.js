import {z} from 'zod';
import {audioStretchPlan,stretchedRegionTrack} from './audio-stretch-region.js';
import {melodyDraftNotes} from './melody-draft.js';
import {validatePitchCorrections,validateAudioRetune} from './audio-retune-options.js';
export function melodyRetunePlan(session,analysis){
 if(!analysis||analysis.sessionId!==session.id||analysis.revision!==session.revision)throw Error('The melody draft changed. Analyze it again.');
 const plan=audioStretchPlan(session,analysis.regionId,1),corrections=[];
 for(const [index,note] of melodyDraftNotes(analysis).entries()){
  if(note.excluded)continue;const original=analysis.notes[index];
  if(note.start!==original.start||note.duration!==original.duration)throw Error('Reset timing corrections before retuning audio. This render changes pitch only.');
  const semitones=note.pitch-original.pitch-original.cents/100;
  if(Math.abs(semitones)>=.001)corrections.push({start:original.start,end:original.start+original.duration,semitones});
 }
 if(!corrections.length)throw Error('No included notes need pitch correction.');
 return {...plan,corrections:validatePitchCorrections(corrections,plan.region.duration),name:plan.region.name.slice(0,180)+' tuned'};
}
export function retunedRegionTrack(session,regionId,values){
 const v=z.object({corrections:z.string().max(1000000),assetId:z.string(),sampleRate:z.number(),channels:z.number(),frames:z.number()}).strict().parse(values),region=session.tracks.flatMap(t=>t.regions).find(r=>r.id===regionId);
 if(!region)throw Error('Choose an audio region.');
 const corrections=validatePitchCorrections(JSON.parse(v.corrections),region.duration);validateAudioRetune({...v,corrections});
 const {corrections:ignored,...rendered}=v,result=stretchedRegionTrack(session,regionId,{...rendered,ratio:1}),name=region.name.slice(0,180)+' tuned';result.track.name=name;result.track.regions[0].name=name;return result;
}
