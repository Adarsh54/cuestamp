import {regionBeatTiming} from './tempo-map.js';
import {z} from 'zod';
const rampSchema=z.object({timing:z.enum(['seconds','beats']).default('seconds'),type:z.enum(['controlChange','pitchBend']),channel:z.number().int().min(0).max(15).default(0),parameter:z.number().int().min(0).max(127).default(0),start:z.number().finite().nonnegative(),end:z.number().finite().positive(),from:z.number().int().nonnegative(),to:z.number().int().nonnegative(),step:z.number().finite().positive(),curve:z.enum(['linear','easeIn','easeOut']).default('linear')}).strict();
export function controllerRamp(region,values,session){
 const v=rampSchema.parse(values);if(v.timing==='beats'&&!session)throw Error('Musical ramps need session timing.');const clock=v.timing==='beats'?regionBeatTiming(region,session):null,start=clock?clock.timeAtBeat(v.start):v.start,end=clock?clock.timeAtBeat(v.end):v.end,max=v.type==='pitchBend'?16383:127;
 if(v.end<=v.start||end>region.duration+1e-9)throw Error('The ramp must start before it ends and stay inside the MIDI region.');
 if(v.from>max||v.to>max)throw Error(`Controller values must be between 0 and ${max}.`);
 if(v.type==='pitchBend'&&v.parameter!==0)throw Error('Pitch bend uses parameter 0.');
 const intervals=Math.ceil((v.end-v.start)/v.step),count=intervals+1;
 if(count>2000)throw Error('A ramp supports up to 2,000 points. Increase point spacing.');
 const kept=region.events.filter(e=>!(e.type===v.type&&e.channel===v.channel&&(v.type==='pitchBend'||e.parameter===v.parameter)&&e.start>=start&&e.start<=end));
 if(kept.length+count>20000)throw Error('This ramp would exceed the region’s 20,000-event limit.');
 const generated=Array.from({length:count},(_,i)=>{const fraction=i/intervals,t=v.curve==='easeIn'?fraction*fraction:v.curve==='easeOut'?1-(1-fraction)**2:fraction;return {id:crypto.randomUUID(),type:v.type,channel:v.channel,parameter:v.parameter,start:Math.min(region.duration,clock?clock.timeAtBeat(i===intervals?v.end:v.start+(v.end-v.start)*fraction):i===intervals?v.end:v.start+(v.end-v.start)*fraction),value:Math.round(v.from+(v.to-v.from)*t)};});
 if(generated.some((point,i)=>!Number.isFinite(point.start)||(i>0&&point.start<=generated[i-1].start)))throw Error('Ramp spacing is below timeline precision.');
 return [...kept,...generated].sort((a,b)=>a.start-b.start);
}
