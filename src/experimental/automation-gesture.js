import {z} from 'zod';
import {automationSegments,orderedAutomationValue} from './automation-curves.js';
const sample=z.object({time:z.number().finite().min(0).max(86400),value:z.number().finite()}).strict();
const options=z.object({parameter:z.enum(['gainDb','pan']),samples:z.string().max(160000),returnSeconds:z.number().finite().min(0).max(10).default(.1)}).strict();
// Touch-style replacement, including a return ramp. The scheduler cannot store
// two values at one time; a <=1us guard preserves the incoming curve at the seam.
export function automationGesturePlan(session,target,values){
 const v=options.parse(values),samples=z.array(sample).min(2).max(2000).parse(JSON.parse(v.samples)),track=session.tracks.find(t=>t.id===target);
 if(target!==session.id&&(!track||track.kind==='video'))throw Error('Choose a mixer track or Master for automation recording.');
 const points=target===session.id?session.masterAutomation:track.automation,fallback=target===session.id?(v.parameter==='gainDb'?session.masterDb:session.masterPan):track[v.parameter],min=v.parameter==='pan'?-1:-96,max=v.parameter==='pan'?1:12;
 if(samples.some((p,i)=>p.value<min||p.value>max||(i&&p.time<=samples[i-1].time)))throw Error('Recorded automation needs increasing times and values within the parameter range.');
 const start=samples[0].time,end=samples.at(-1).time,restore=end+Math.max(v.returnSeconds,.000001);if(restore>86400)throw Error('Automation return ramp exceeds the 24-hour timeline.');
 const lane=points.filter(p=>p.parameter===v.parameter).sort((a,b)=>a.time-b.time),rendered=automationSegments(lane,v.parameter),valueAt=time=>orderedAutomationValue(rendered,time,fallback);
 const materialized=lane.flatMap((p,i)=>{const next=lane[i+1];return next&&['smooth','easeIn','easeOut'].includes(p.shape)&&[start,restore].some(t=>p.time<t&&t<=next.time)?automationSegments([p,next],v.parameter).slice(0,-1).map(q=>({...q,id:q.id??crypto.randomUUID(),shape:'linear'})):[p];});
 const before=materialized.filter(p=>p.time<start),after=materialized.filter(p=>p.time>restore),make=(time,value,shape='linear')=>({id:crypto.randomUUID(),parameter:v.parameter,time,value,shape});
 if(start>0){const previous=before.at(-1)?.time??0,guard=start-Math.min(.000001,(start-previous)/2);if(guard===start)throw Error('Automation boundary is below timeline precision.');before.push(make(guard,valueAt(guard),'hold'));}
 const atRestore=materialized.find(p=>p.time===restore),prior=materialized.findLast(p=>p.time<restore),restored=atRestore??make(restore,valueAt(restore),prior?.shape==='hold'?'hold':'linear');
 const inserted=samples.map(p=>make(p.time,p.value)),result=[...points.filter(p=>p.parameter!==v.parameter),...before,...inserted,restored,...after];
 if(result.length>2000)throw Error('Recorded gesture would exceed the lane owner’s 2,000-point limit.');
 return {points,result,start,end,restore};
}
export function applyAutomationGesture(session,target,values){const {points,result}=automationGesturePlan(session,target,values);points.splice(0,points.length,...result);}
