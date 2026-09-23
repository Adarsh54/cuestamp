import {z} from 'zod';
const time=z.number().finite().min(0).max(86400);
export const zoneSourceRangeSchema=z.object({sourceStart:time.default(0),sourceEnd:time.nullable().default(null)});
export const zoneSourceRangePatch=Object.fromEntries(Object.entries(zoneSourceRangeSchema.shape).map(([key,schema])=>[key,schema.removeDefault().optional()]));
export function validateZoneSourceRange(zone,ctx){if(zone.sourceEnd!==null&&zone.sourceEnd<=zone.sourceStart)ctx.addIssue({code:'custom',message:'Sample end must follow its start.'});if(zone.loop&&(zone.loopStart<zone.sourceStart||zone.sourceEnd!==null&&zone.loopEnd!==null&&zone.loopEnd>zone.sourceEnd))ctx.addIssue({code:'custom',message:'Loop points must stay inside the sample selection.'});}
export function samplerSourceRange(buffer,{sampleStart=0,sampleEnd=null}={}){const end=sampleEnd??buffer.duration;if(!Number.isFinite(sampleStart)||!Number.isFinite(end)||sampleStart<0||end>buffer.duration||end-sampleStart+Number.EPSILON*Math.max(1,buffer.duration)<1/buffer.sampleRate)throw Error('Sample start/end must span at least one sample and stay inside the source file.');return {start:sampleStart,end};}
