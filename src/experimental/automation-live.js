import {automationSegments,orderedAutomationValue,scheduleCurveAutomation} from './automation-curves.js';

// Playback-only overrides. The caller separately commits captured gestures through
// automation.record; this controller never mutates the session document.
export function createLiveAutomation({context,base,position,lanes}){
 let stopped=false;
 const touched=new Map(),key=(target,parameter)=>`${target}:${parameter}`;
 function resolve(target,parameter){
  if(stopped)throw Error('Playback has stopped.');
  if(!['gainDb','pan'].includes(parameter))throw Error('Unsupported live automation parameter.');
  const lane=lanes.get(key(target,parameter));
  if(!lane)throw Error('This channel cannot be automated during playback.');
  return lane;
 }
 function now(){return Math.max(base,context.currentTime);}
 function schedule(lane,parameter,points,time,fallback){
  lane.param.cancelScheduledValues(time);
  scheduleCurveAutomation(lane.param,points,parameter,position+time-base,time,fallback,parameter==='gainDb'?v=>10**(v/20):v=>v,parameter==='gainDb');
 }
 return {
  set(target,parameter,value){
   const lane=resolve(target,parameter),min=parameter==='gainDb'?-96:-1,max=parameter==='gainDb'?12:1;
   if(!Number.isFinite(value)||value<min||value>max)throw Error('Invalid live automation value.');
   const time=now();schedule(lane,parameter,[],time,value);touched.set(key(target,parameter),value);
   return position+time-base;
  },
  release(target,parameter,returnSeconds=.1){
   const lane=resolve(target,parameter),id=key(target,parameter);
   if(!Number.isFinite(returnSeconds)||returnSeconds<0||returnSeconds>10)throw Error('Invalid automation return duration.');
   if(!touched.has(id))return;
   const time=now(),start=position+time-base,end=start+Math.max(1e-6,returnSeconds),ordered=automationSegments(lane.points,parameter);
   const previous=ordered.filter(p=>p.time<=end).at(-1);
   const points=[{parameter,time:start,value:touched.get(id),shape:'linear'},{parameter,time:end,value:orderedAutomationValue(ordered,end,lane.fallback),shape:previous?.shape==='hold'?'hold':'linear'},...ordered.filter(p=>p.time>end)];
   schedule(lane,parameter,points,time,lane.fallback);touched.delete(id);
  },
  cancel(target,parameter){
   const lane=resolve(target,parameter),id=key(target,parameter);if(!touched.has(id))return;
   schedule(lane,parameter,lane.points,now(),lane.fallback);touched.delete(id);
  },
  stop(){stopped=true;touched.clear();},
 };
}
