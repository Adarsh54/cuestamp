import {z} from 'zod';
import {splitRegion,splitCompReferences} from './region-split.js';
const bounds=z.object({start:z.number().finite().nonnegative(),end:z.number().finite().positive()}).strict();
export function splitAudioRange(track,region,values){
 const v=bounds.parse(values),stop=region.start+region.duration;if(track.kind!=='audio')throw Error('Choose an audio region.');
 if(v.start<region.start||v.end>stop||v.end<=v.start)throw Error('Select a positive range inside this audio region.');
 const cuts=Number(v.start>region.start)+Number(v.end<stop);if(!cuts)throw Error('The selection already spans the whole region.');if(track.regions.length+cuts>1000)throw Error('Splitting would exceed the 1,000-region track limit.');
 if(v.end<stop){const {left,right}=splitRegion(region,v.end,'audio');Object.assign(region,left);track.regions.push(right);splitCompReferences(track,region.id,v.end,right.id);}
 if(v.start>region.start){const {left,right}=splitRegion(region,v.start,'audio');Object.assign(region,left);track.regions.push(right);splitCompReferences(track,region.id,v.start,right.id);return right.id;}
 return region.id;
}
export const audioRangeContextSchema=z.object({regionId:z.string().min(1).max(100),start:z.number().finite().nonnegative(),end:z.number().finite().positive()}).strict();
export function validateAudioRangeContext(session,value){if(value===undefined)return;const v=audioRangeContextSchema.parse(value),track=session.tracks.find(t=>t.regions.some(r=>r.id===v.regionId)),r=track?.regions.find(r=>r.id===v.regionId);if(track?.kind!=='audio'||v.start<r.start||v.end>r.start+r.duration||v.end<=v.start)throw Error('Audio range no longer matches its region.');return v;}
