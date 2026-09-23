import {z} from 'zod';
import {validateAudioRangeContext} from './region-split-range.js';
import {stemSession} from './routing.js';
export function audioRangeAudition(session,range){
 const v=validateAudioRangeContext(session,range);if(!v)throw Error('Select a waveform range to audition.');
 const snapshot=structuredClone(session),track=snapshot.tracks.find(t=>t.regions.some(r=>r.id===v.regionId)),region=track.regions.find(r=>r.id===v.regionId);
 if(track.mute||region.mute)throw Error('Unmute this track and region to audition it.');
 const document=stemSession(snapshot,{...track,regions:[region]});document.loopEnabled=false;document.metronomeEnabled=false;
 return {kind:'audioRange',document,position:v.start,end:v.end,label:`Playing selected audio · ${v.start.toFixed(3)}–${v.end.toFixed(3)} s`};
}
export const auditionRangeActionSchema=z.object({regionId:z.string().min(1).max(100).nullable(),start:z.number().finite().nonnegative().nullable(),end:z.number().finite().positive().nullable()}).strict();
export function resolveRangeAudition(session,value,captured,selected){const v=auditionRangeActionSchema.parse(value);if((v.start===null)!==(v.end===null))throw Error('Provide both range boundaries or use the captured range.');const range=v.start===null?captured:{regionId:v.regionId??captured?.regionId??selected,start:v.start,end:v.end};if(v.start===null&&v.regionId!==null&&v.regionId!==range?.regionId)throw Error('The captured range belongs to a different region.');audioRangeAudition(session,range);return range;}
