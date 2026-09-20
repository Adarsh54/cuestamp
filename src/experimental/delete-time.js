import {deleteMeterTime} from './meter-time-edit.js';
import {deleteTempoTime} from './tempo-time-edit.js';
import {deleteArrangementSections} from './arrangement-sections.js';
import {splitRegion,clampCompRounding} from './region-split.js';
import {automationSegments,orderedAutomationValue} from './automation-curves.js';

export function deleteAutomationTime(points,start,end){
 const result=[],duration=end-start;
 for(const parameter of new Set(points.map(p=>p.parameter))){
  let lane=points.filter(p=>p.parameter===parameter).sort((a,b)=>a.time-b.time);
  if(lane.at(-1).time<start){result.push(...lane);continue;}
  if(lane[0].time>=end){result.push(...lane.map(p=>({...p,time:p.time-duration})));continue;}
  // Materialize only curves crossed by a cut, using the renderer's breakpoints.
  lane=lane.flatMap((p,i)=>{const next=lane[i+1];return next&&['smooth','easeIn','easeOut'].includes(p.shape)&&[start,end].some(t=>p.time<t&&t<=next.time)?automationSegments([p,next],parameter).slice(0,-1).map(q=>({...q,id:q.id||crypto.randomUUID(),shape:'linear'})):[p];});
  const before=lane.filter(p=>p.time<start),after=lane.filter(p=>p.time>=end).map(p=>({...p,time:p.time-duration}));
  // Two distinct points represent the seam without duplicate-time ambiguity.
  // At most the final microsecond before the cut is held instead of ramped.
  if(start>0){const gap=start-(before.at(-1)?.time??0),leftTime=start-Math.min(.000001,gap/2);if(leftTime>=start)throw Error('Deletion boundary is too close to an automation point.');before.push({id:crypto.randomUUID(),parameter,time:leftTime,value:orderedAutomationValue(automationSegments(lane,parameter),leftTime,0),shape:'hold'});}
  if(!after.some(p=>p.time===start)){const previous=lane.findLast(p=>p.time<end);after.unshift({id:crypto.randomUUID(),parameter,time:start,value:orderedAutomationValue(automationSegments(lane,parameter),end,0),shape:previous?.shape==='hold'?'hold':'linear'});}
  result.push(...before,...after);
 }
 return result.sort((a,b)=>a.time-b.time);
}
export function deleteProjectTime(session,{start,end}){
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>86400||end<=start)throw Error('Choose a positive deletion range within 24 hours.');
 const tempoTiming=deleteTempoTime(session,start,end);
 const meterTiming=deleteMeterTime(session,start,end,tempoTiming??session);
 const duration=end-start,shift=t=>t<=start?t:t<=end?start:t-duration;
 const automate=owner=>{owner.automation=deleteAutomationTime(owner.automation||[],start,end);};
 for(const track of session.tracks){
  const rightIds=new Map();
  track.regions=track.regions.flatMap(region=>{
   const stop=region.start+region.duration;
   if(stop<=start)return [region];
   if(region.start>=end)return [{...region,start:shift(region.start)}];
   if(region.start>=start&&stop<=end)return [];
   let left=null,right=null;
   if(region.start<start)left=splitRegion(region,start,track.kind).left;
   if(stop>end){right=splitRegion(region,end,track.kind).right;right.start=start;if(!left)right.id=region.id;rightIds.set(region.id,right.id);}
   return [left,right].filter(Boolean);
  });
  track.compAlternatives=(track.compAlternatives||[]).flatMap(alternative=>{
   const segments=alternative.segments.flatMap(segment=>{
    if(segment.end<=start)return [segment];
    if(segment.start>=end)return [{...segment,regionId:rightIds.get(segment.regionId)||segment.regionId,start:shift(segment.start),end:shift(segment.end)}];
    const pieces=[];
    if(segment.start<start)pieces.push({...segment,end:start});
    if(segment.end>end)pieces.push({...segment,regionId:rightIds.get(segment.regionId)||segment.regionId,start,end:shift(segment.end)});
    return pieces;
   });return segments.length?[{...alternative,segments}]:[];
  });
  clampCompRounding(track);automate(track);for(const owner of [...track.effects,...track.sends])automate(owner);
 }
 session.masterAutomation=deleteAutomationTime(session.masterAutomation,start,end);for(const effect of session.masterEffects)automate(effect);
 session.markers=session.markers.filter(m=>m.time<start||m.time>=end).map(m=>({...m,time:shift(m.time)}));
 session.sections=deleteArrangementSections(session.sections,start,end);
 for(const prefix of ['loop','audioPunch','midiPunch']){
  const a=prefix+'Start',b=prefix+'End';session[a]=shift(session[a]);session[b]=shift(session[b]);
  if(session[b]<=session[a]){session[prefix+'Enabled']=false;session[b]=Math.min(86400,session[a]+1);}
 }
 if(tempoTiming)Object.assign(session,tempoTiming);
 if(meterTiming)Object.assign(session,meterTiming);
}
export function deleteTimeView(session){return `<details class="daw-markers"><summary>Delete time</summary><form data-delete-time><label>From · seconds<input name="start" type="number" min="0" max="86400" step="any" value="${session.loopStart}" required></label><label>To · seconds<input name="end" type="number" min="0" max="86400" step="any" value="${session.loopEnd}" required></label><button type="button" data-delete-cycle>Use cycle range</button><button>Delete time across project</button></form><p class="muted">Removes this section from every track and closes the gap, including automation, markers and saved comp selections. Original media is preserved. Undo restores the whole edit.</p></details>`;}
export function bindDeleteTime(root,{session,execute,guard}){const form=root.querySelector('[data-delete-time]');root.querySelector('[data-delete-cycle]').onclick=()=>{form.elements.start.value=session.loopStart;form.elements.end.value=session.loopEnd;};form.onsubmit=guard(e=>{e.preventDefault();execute([{op:'session.deleteTime',values:{start:Number(form.elements.start.value),end:Number(form.elements.end.value)}}],'Deleted time across project');});}
