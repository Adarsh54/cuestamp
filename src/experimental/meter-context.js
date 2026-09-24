import {z} from 'zod';
import {peakDb} from './meters.js';
const db=z.number().finite().min(-1000).max(1000).nullable();
const liveLoudnessSchema=z.object({momentaryLufs:db,shortTermLufs:db,frames:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),measuredAt:z.number().int().nonnegative()}).strict();
export const meterObservationSchema=z.object({sessionId:z.string().min(1).max(100),revision:z.number().int().nonnegative(),measuredAt:z.number().int().nonnegative(),position:z.number().finite().min(0).max(1000000000),mode:z.enum(['linear','cycle']),sampleRate:z.number().int().min(8000).max(192000),windowFrames:z.literal(2048),loudness:liveLoudnessSchema.optional(),gates:z.array(z.object({id:z.string().min(1).max(100),reductionDb:z.number().finite().min(-96).max(0),open:z.boolean()}).strict()).max(2064).optional(),compressors:z.array(z.object({id:z.string().min(1).max(100),reductionDb:z.number().finite().min(-1000).max(0)}).strict()).max(2064).optional(),channels:z.array(z.object({id:z.string().min(1).max(100),leftPeakDb:db,rightPeakDb:db,heldPeakDb:db}).strict()).min(1).max(129)}).strict();
export function validateMeterObservation(value,session,now=Date.now()){
 if(value===undefined)return undefined;const observation=meterObservationSchema.parse(value);
 if(observation.sessionId!==session.id||observation.revision!==session.revision||now-observation.measuredAt>120000||observation.measuredAt-now>5000)throw Error('Meter readings are stale. Play the session again before using measured levels.');
 const allowed=new Set([session.id,...(observation.mode==='linear'?session.tracks.filter(t=>t.kind!=='video').map(t=>t.id):[])]),seen=new Set();
 for(const channel of observation.channels){if(!allowed.has(channel.id)||seen.has(channel.id))throw Error('Invalid meter channel.');seen.add(channel.id);const held=channel.heldPeakDb??-Infinity;if((channel.leftPeakDb??-Infinity)>held+.000001||(channel.rightPeakDb??-Infinity)>held+.000001)throw Error('Invalid held meter peak.');}
 if(observation.compressors?.length){
  if(observation.mode!=='linear')throw Error('Compressor readings are unavailable during cycle playback.');
  const allowedEffects=new Set([...session.tracks.filter(t=>seen.has(t.id)).flatMap(t=>t.effects||[]),...(seen.has(session.id)?session.masterEffects||[]:[])].filter(e=>e.kind==='compressor'&&e.enabled).map(e=>e.id)),seenEffects=new Set();
  for(const effect of observation.compressors){if(!allowedEffects.has(effect.id)||seenEffects.has(effect.id))throw Error('Invalid compressor meter.');seenEffects.add(effect.id);}
 }
 if(observation.gates?.length){
  if(observation.mode!=='linear')throw Error('Gate readings are unavailable during cycle playback.');
  const allowedEffects=new Set([...session.tracks.filter(t=>seen.has(t.id)).flatMap(t=>t.effects||[]),...(seen.has(session.id)?session.masterEffects||[]:[])].filter(e=>e.kind==='gate'&&e.enabled).map(e=>e.id)),seenEffects=new Set();
  for(const effect of observation.gates){if(!allowedEffects.has(effect.id)||seenEffects.has(effect.id))throw Error('Invalid gate meter.');seenEffects.add(effect.id);}
 }
 if(observation.loudness){const l=observation.loudness;if(!seen.has(session.id)||observation.measuredAt-l.measuredAt>2000||l.measuredAt-observation.measuredAt>50||now-l.measuredAt>120000||(l.frames<Math.round(.4*observation.sampleRate)&&l.momentaryLufs!==null)||(l.frames<3*observation.sampleRate&&l.shortTermLufs!==null))throw Error('Invalid or stale playback loudness.');}
 return observation;
}
export function captureMeterObservation(session,values,{position,mode,sampleRate,now=Date.now(),effectValues}){
 const db=value=>value===0?null:peakDb(value),channels=[...values].filter(([,v])=>[v.left,v.right,v.peak].every(n=>Number.isFinite(n)&&n>=0)).map(([id,v])=>({id,leftPeakDb:db(v.left),rightPeakDb:db(v.right),heldPeakDb:db(v.peak)}));
 if(!channels.length)return undefined;
 const reading=values.get(session.id)?.loudness,parsed=liveLoudnessSchema.safeParse(reading);
 const loudness=parsed.success&&now-parsed.data.measuredAt<=2000&&parsed.data.measuredAt<=now+50?parsed.data:undefined;
 const effects=[...(session.masterEffects||[]),...session.tracks.flatMap(t=>t.effects||[])],kind=id=>effects.find(e=>e.id===id)?.kind;
 const compressors=mode==='linear'&&effectValues?[...effectValues].filter(([id,v])=>kind(id)==='compressor'&&Number.isFinite(v.reductionDb)&&v.reductionDb<=0&&v.reductionDb>=-1000).map(([id,v])=>({id,reductionDb:v.reductionDb})):[];
 const gates=mode==='linear'&&effectValues?[...effectValues].filter(([id,v])=>kind(id)==='gate'&&Number.isFinite(v.reductionDb)&&v.reductionDb>=-96&&v.reductionDb<=0&&typeof v.open==='boolean').map(([id,v])=>({id,reductionDb:v.reductionDb,open:v.open})):[];
 return validateMeterObservation({...(gates.length?{gates}:{}),...(compressors.length?{compressors}:{}),...(loudness?{loudness}:{}),sessionId:session.id,revision:session.revision,measuredAt:now,position,mode,sampleRate,windowFrames:2048,channels},session,now);
}
export function currentMeterObservation(value,session,now=Date.now()){try{return validateMeterObservation(value,session,now);}catch{return undefined;}}
