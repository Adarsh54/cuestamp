import {auditionRangeActionSchema} from './audio-range-audition.js';
import {validateAudioRangeContext} from './region-split-range.js';
export const zeroCrossingActionSchema=auditionRangeActionSchema;
export function resolveZeroCrossingRange(session,value,captured,selected){
 const v=zeroCrossingActionSchema.parse(value);
 if((v.start===null)!==(v.end===null))throw Error('Provide both boundaries or use the captured range.');
 const range=v.start===null?captured:{regionId:v.regionId??captured?.regionId??selected,start:v.start,end:v.end};
 if(!range)throw Error('Select an audio range first.');
 if(v.start===null&&v.regionId!==null&&v.regionId!==range.regionId)throw Error('The captured range belongs to a different region.');
 return validateAudioRangeContext(session,range);
}
