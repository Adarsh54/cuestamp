import {automationSegments,orderedAutomationValue,scheduleCurveAutomation} from './automation-curves.js';

// Playback-only overrides. The caller separately commits captured gestures through
// automation.record; this controller never mutates the session document.
export function createLiveAutomation({context,base,position,lanes}){
 let stopped=false;
 const trimmed=new Set(),touched=new Map(),key=(target,parameter)=>`${target}:${parameter}`;
 function resolve(target,parameter){
  if(stopped)throw Error('Playback has stopped.');
  const lane=lanes.get(key(target,parameter));
  if(!lane)throw Error('This channel cannot be automated during playback.');
  return lane;
 }
 function now(){return Math.max(base,context.currentTime);}
 function schedule(lane,parameter,points,time,fallback){
  const bindings=lane.bindings||[{param:lane.param,transform:parameter==='gainDb'?v=>10**(v/20):v=>v,exponential:parameter==='gainDb'}];
  for(const binding of bindings){binding.param.cancelScheduledValues(time);scheduleCurveAutomation(binding.param,points,parameter,position+time-base,time,fallback,binding.transform,binding.exponential);}
 }
 return {
  set(target,parameter,value){
   const lane=resolve(target,parameter),min=lane.min??(parameter==='gainDb'?-96:-1),max=lane.max??(parameter==='gainDb'?12:1);
   if(!Number.isFinite(value)||value<min||value>max)throw Error('Invalid live automation value.');
   const time=now();schedule(lane,parameter,[],time,value);trimmed.delete(key(target,parameter));touched.set(key(target,parameter),value);
   return position+time-base;
  },
  trim(target,parameter,offset){
   const lane=resolve(target,parameter),time=now(),start=position+time-base;
   const min=lane.min??(parameter==='gainDb'?-96:-1),max=lane.max??(parameter==='gainDb'?12:1);
   if(!Number.isFinite(offset)||Math.abs(offset)>max-min)throw Error('Invalid live trim offset.');
   const ordered=automationSegments(lane.points,parameter),previous=ordered.findLast(p=>p.time<=start);
   // These are already rendered segments. Do not expand their original curve
   // tags again: all generated intervals are linear except explicit holds.
   const shifted=[{parameter,time:start,value:orderedAutomationValue(ordered,start,lane.fallback)+offset,shape:previous?.shape==='hold'?'hold':'linear'},...ordered.filter(p=>p.time>start).map(p=>({...p,value:p.value+offset,shape:p.shape==='hold'?'hold':'linear'}))];
   if(shifted.some(p=>p.value<min||p.value>max))throw Error('This trim offset exceeds a value limit in the remaining automation. Use a smaller offset or trim a bounded range.');
   schedule(lane,parameter,shifted,time,lane.fallback+offset);
   const id=key(target,parameter);trimmed.add(id);touched.set(id,offset);return start;
  },
  // After a trim gesture is committed, replace() installs its absolute curve
  // including the return ramp; resume() schedules that exact committed result.
  resume(target,parameter){
   const lane=resolve(target,parameter),id=key(target,parameter);if(!touched.has(id))return;
   schedule(lane,parameter,lane.points,now(),lane.fallback);touched.delete(id);trimmed.delete(id);
  },
  release(target,parameter,returnSeconds=.1){
   const lane=resolve(target,parameter),id=key(target,parameter);
   if(!Number.isFinite(returnSeconds)||returnSeconds<0||returnSeconds>10)throw Error('Invalid automation return duration.');
   if(!touched.has(id))return;
   if(trimmed.has(id))throw Error('Commit the trim curve and resume it, or cancel the trim override.');
   const time=now(),start=position+time-base,end=start+Math.max(1e-6,returnSeconds),ordered=automationSegments(lane.points,parameter);
   const previous=ordered.filter(p=>p.time<=end).at(-1);
   const points=[{parameter,time:start,value:touched.get(id),shape:'linear'},{parameter,time:end,value:orderedAutomationValue(ordered,end,lane.fallback),shape:previous?.shape==='hold'?'hold':'linear'},...ordered.filter(p=>p.time>end)];
   schedule(lane,parameter,points,time,lane.fallback);touched.delete(id);
  },
  cancel(target,parameter){
   const lane=resolve(target,parameter),id=key(target,parameter);if(!touched.has(id))return;
   schedule(lane,parameter,lane.points,now(),lane.fallback);touched.delete(id);trimmed.delete(id);
  },
  replace(target,parameter,points,fallback){
   const lane=resolve(target,parameter);lane.points=structuredClone(points);lane.fallback=fallback;
  },
  stop(){stopped=true;touched.clear();trimmed.clear();},
 };
}
