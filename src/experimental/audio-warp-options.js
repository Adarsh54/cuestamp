import {z} from 'zod';
import {validateAudioStretch} from './audio-stretch-options.js';
const anchorsSchema=z.array(z.object({source:z.number().finite().positive(),target:z.number().finite().positive()}).strict()).min(1).max(64);
export function audioWarpPlan({sampleRate,frames,channels,anchors}){
 validateAudioStretch({sampleRate,frames,channels,ratio:1});const values=anchorsSchema.parse(anchors),points=[{source:0,target:0}];
 for(const v of values){const point={source:Math.round(v.source*sampleRate),target:Math.round(v.target*sampleRate)},last=points.at(-1);if(point.source<=last.source||point.target<=last.target||point.source>=frames||point.target>=frames)throw Error('Warp anchors must remain ordered and inside the audio on both timelines.');points.push(point);}
 points.push({source:frames,target:frames});const segments=[];
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],input=b.source-a.source,output=b.target-a.target,ratio=output/input;validateAudioStretch({sampleRate,frames:input,channels,ratio});segments.push({sourceStart:a.source,sourceEnd:b.source,targetStart:a.target,targetEnd:b.target,ratio});}
 return {frames,segments,identity:points.every(p=>p.source===p.target)};
}
