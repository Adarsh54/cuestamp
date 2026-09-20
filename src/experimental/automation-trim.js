import {z} from 'zod';
import {automationLanes} from './automation-range.js';
import {automationSegments,orderedAutomationValue} from './automation-curves.js';
const time=z.number().finite().min(0).max(86400);
const options=z.object({parameter:z.string().min(1).max(50),busId:z.string().min(1).max(100).optional(),start:time,end:time,amount:z.number().finite().min(-1000000).max(1000000)}).strict().refine(v=>v.end>v.start,'Choose a positive trim range.');
export function automationTrimPlan(session,target,values){
 const v=options.parse(values),source=automationLanes(session).find(l=>l.target===target&&l.busId===v.busId&&l.parameter===v.parameter);if(!source)throw Error('Automation lane not found.');
 const owner=target===session.id?{gainDb:session.masterDb,pan:session.masterPan}:session.tracks.find(t=>t.id===target)||[...session.masterEffects,...session.tracks.flatMap(t=>t.effects)].find(e=>e.id===target);
 const fallback=v.busId?owner.sends.find(s=>s.busId===v.busId)[v.parameter]:owner[v.parameter];
 const lane=[...new Map(source.points.filter(p=>p.parameter===v.parameter).sort((a,b)=>a.time-b.time).map(p=>[p.time,p])).values()],rendered=automationSegments(lane,v.parameter),valueAt=t=>orderedAutomationValue(rendered,t,fallback);
 if(v.amount===0)return {source,result:source.points.slice(),v};
 const previous=lane.findLast(p=>p.time<v.end)?.time??v.start,tail=v.end-Math.min(1e-6,(v.end-Math.max(v.start,previous))/2);
 if(tail<=v.start||tail===v.end)throw Error('Trim range is below timeline precision.');
 // Only split curved segments crossing the range edges; interior curves retain
 // their original shape and IDs, shifted by a constant amount.
 const materialized=lane.flatMap((p,i)=>{const next=lane[i+1];return next&&['smooth','easeIn','easeOut'].includes(p.shape)&&[v.start,tail,v.end].some(t=>p.time<t&&t<=next.time)?automationSegments([p,next],v.parameter).slice(0,-1).map(q=>({...q,id:q.id??crypto.randomUUID(),shape:'linear'})):[p];});
 const make=(t,value,shape='linear')=>({id:crypto.randomUUID(),parameter:v.parameter,time:t,value,shape});
 const shapeAt=t=>{const p=materialized.findLast(p=>p.time<=t);return p?(p.shape??'linear'):'hold';};
 const before=materialized.filter(p=>p.time<v.start),after=materialized.filter(p=>p.time>v.end);
 if(v.start>0){const prior=before.at(-1)?.time??0,guard=v.start-Math.min(1e-6,(v.start-prior)/2);if(guard===v.start)throw Error('Trim boundary is below timeline precision.');before.push(make(guard,valueAt(guard),'hold'));}
 const shifted=[make(v.start,valueAt(v.start)+v.amount,shapeAt(v.start)),...materialized.filter(p=>p.time>v.start&&p.time<tail).map(p=>({...p,value:p.value+v.amount})),make(tail,valueAt(tail)+v.amount,'hold')];
 if(shifted.some(p=>p.value<source.spec.min||p.value>source.spec.max))throw Error('Trim exceeds the parameter limits. Choose a smaller offset.');
 const restored=materialized.find(p=>p.time===v.end)??make(v.end,valueAt(v.end),shapeAt(v.end));
 const result=[...source.points.filter(p=>p.parameter!==v.parameter),...before,...shifted,restored,...after];if(result.length>2000)throw Error('Trim exceeds the owner’s 2,000 automation point limit.');
 return {source,result,v};
}
export function applyAutomationTrim(session,target,values){const {source,result}=automationTrimPlan(session,target,values);source.points.splice(0,source.points.length,...result);}
export function automationTrimView(){return `<details><summary>Trim curve over a time range</summary><form data-auto-trim><label>From · seconds<input name="start" type="number" min="0" max="86400" step="any" value="0" required></label><label>To · seconds<input name="end" type="number" min="0" max="86400" step="any" value="1" required></label><label>Offset · parameter units<input name="amount" type="number" step="any" value="0" required></label><p class="muted">Raises or lowers the displayed curve while preserving its shape and the curve outside this range. Volume and send offsets use dB; pan uses −1 to 1 units. Parameter limits are enforced.</p><output data-trim-preview></output><button type="submit">Apply trim</button></form></details>`;}
export function bindAutomationTrim(root,{session,target,busId,parameter,execute,guard,duration}){
 const form=root.querySelector('[data-auto-trim]');if(!form||!session)return;form.elements.end.value=Math.min(86400,Math.max(1,duration));
 const values=()=>({parameter,...(busId?{busId}:{}),start:form.elements.start.valueAsNumber,end:form.elements.end.valueAsNumber,amount:form.elements.amount.valueAsNumber});
 const button=form.querySelector('[type=submit]'),output=form.querySelector('[data-trim-preview]');
 const update=()=>{try{const plan=automationTrimPlan(session,target,values());button.disabled=plan.v.amount===0;output.textContent=plan.v.amount===0?'Enter an offset.':`${plan.v.amount>0?'+':''}${plan.v.amount} · ${plan.v.start}–${plan.v.end} s`;}catch(error){button.disabled=true;output.textContent=error.message;}};
 form.oninput=update;form.onsubmit=guard(e=>{e.preventDefault();update();if(!button.disabled)execute([{op:'automation.trim',target,values:values()}],'Trimmed automation curve');});update();
}
