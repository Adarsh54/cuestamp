import {recordingAutomationLane} from './automation-recording-lane.js';
import {z} from 'zod';
import {automationSegments,orderedAutomationValue} from './automation-curves.js';
import {automationGesturePlan} from './automation-gesture.js';
const sample=z.object({time:z.number().finite().min(0).max(86400),value:z.number().finite()}).strict();
const options=z.object({parameter:z.string().min(1).max(50),busId:z.string().min(1).max(100).optional(),samples:z.string().max(160000),returnSeconds:z.number().finite().min(0).max(10).default(.1)}).strict();
// Compose a linear offset gesture with the rendered original curve, including
// its breakpoints. The stored result is absolute automation, not a second layer.
export function automationTrimGesturePlan(session,target,values){
 const v=options.parse(values),offsets=z.array(sample).min(2).max(2000).parse(JSON.parse(v.samples));
 const {points,fallback,min,max}=recordingAutomationLane(session,target,v.parameter,v.busId);
 const limit=max-min;
 if(offsets.some((p,i)=>Math.abs(p.value)>limit||(i&&p.time<=offsets[i-1].time)))throw Error('Trim offsets need increasing times and values within the parameter span.');
 const start=offsets[0].time,end=offsets.at(-1).time,restore=end+Math.max(1e-6,v.returnSeconds);
 if(restore+1e-6>86400)throw Error('Trim return exceeds the 24-hour timeline.');
 const base=automationSegments(points,v.parameter),offsetCurve=[...offsets,{time:restore,value:0}],times=new Set([...offsets.map(p=>p.time),restore,...base.filter(p=>p.time>start&&p.time<restore).map(p=>p.time)]);
 // A step in the base curve stays a step rather than turning into a long ramp
 // when the offset is sloping. Represent the jump with a <=1us seam.
 const ordered=[...times].sort((a,b)=>a-b);
 for(let i=1;i<base.length;i++){
  const p=base[i];if(base[i-1].shape!=='hold'||p.time<=start||p.time>restore)continue;
  const previous=ordered.findLast(t=>t<p.time),guard=p.time-Math.min(1e-6,(p.time-previous)/2);
  if(guard===p.time)throw Error('Trim step is below timeline precision.');times.add(guard);
 }
 if(times.size>2000)throw Error('Trim gesture requires more than 2,000 rendered points. Shorten the range or simplify the curve.');
 const samples=[...times].sort((a,b)=>a-b).map(time=>({time,value:orderedAutomationValue(base,time,fallback)+orderedAutomationValue(offsetCurve,time,0)}));
 // The offset is already back to zero at restore, following the original
 // curve throughout the return. The shared splicer preserves outside values.
 return automationGesturePlan(session,target,{parameter:v.parameter,...(v.busId!==undefined?{busId:v.busId}:{}),samples:JSON.stringify(samples),returnSeconds:0});
}
export function applyAutomationTrimGesture(session,target,values){const {points,result}=automationTrimGesturePlan(session,target,values);points.splice(0,points.length,...result);}
