import {z} from 'zod';
import {peakDb} from './meters.js';
const db=z.number().finite().min(-1000).max(1000).nullable();
const liveLoudnessSchema=z.object({momentaryLufs:db,shortTermLufs:db,frames:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),measuredAt:z.number().int().nonnegative()}).strict();
export const meterObservationSchema=z.object({sessionId:z.string().min(1).max(100),revision:z.number().int().nonnegative(),measuredAt:z.number().int().nonnegative(),position:z.number().finite().min(0).max(1000000000),mode:z.enum(['linear','cycle']),sampleRate:z.number().int().min(8000).max(192000),windowFrames:z.literal(2048),loudness:liveLoudnessSchema.optional(),channels:z.array(z.object({id:z.string().min(1).max(100),leftPeakDb:db,rightPeakDb:db,heldPeakDb:db}).strict()).min(1).max(129)}).strict();
export function validateMeterObservation(value,session,now=Date.now()){
 if(value===undefined)return undefined;const observation=meterObservationSchema.parse(value);
 if(observation.sessionId!==session.id||observation.revision!==session.revision||now-observation.measuredAt>120000||observation.measuredAt-now>5000)throw Error('Meter readings are stale. Play the session again before using measured levels.');
 const allowed=new Set([session.id,...(observation.mode==='linear'?session.tracks.filter(t=>t.kind!=='video').map(t=>t.id):[])]),seen=new Set();
 for(const channel of observation.channels){if(!allowed.has(channel.id)||seen.has(channel.id))throw Error('Invalid meter channel.');seen.add(channel.id);const held=channel.heldPeakDb??-Infinity;if((channel.leftPeakDb??-Infinity)>held+.000001||(channel.rightPeakDb??-Infinity)>held+.000001)throw Error('Invalid held meter peak.');}
 if(observation.loudness){const l=observation.loudness;if(!seen.has(session.id)||observation.measuredAt-l.measuredAt>2000||l.measuredAt-observation.measuredAt>50||now-l.measuredAt>120000||(l.frames<Math.round(.4*observation.sampleRate)&&l.momentaryLufs!==null)||(l.frames<3*observation.sampleRate&&l.shortTermLufs!==null))throw Error('Invalid or stale playback loudness.');}
 return observation;
}
export function captureMeterObservation(session,values,{position,mode,sampleRate,now=Date.now()}){
 const db=value=>value===0?null:peakDb(value),channels=[...values].filter(([,v])=>[v.left,v.right,v.peak].every(n=>Number.isFinite(n)&&n>=0)).map(([id,v])=>({id,leftPeakDb:db(v.left),rightPeakDb:db(v.right),heldPeakDb:db(v.peak)}));
 if(!channels.length)return undefined;
 const reading=values.get(session.id)?.loudness,parsed=liveLoudnessSchema.safeParse(reading);
 const loudness=parsed.success&&now-parsed.data.measuredAt<=2000&&parsed.data.measuredAt<=now+50?parsed.data:undefined;
 return validateMeterObservation({...(loudness?{loudness}:{}),sessionId:session.id,revision:session.revision,measuredAt:now,position,mode,sampleRate,windowFrames:2048,channels},session,now);
}
export function currentMeterObservation(value,session,now=Date.now()){try{return validateMeterObservation(value,session,now);}catch{return undefined;}}
