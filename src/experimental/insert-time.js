import {insertMeterTime} from './meter-time-edit.js';
import {insertTempoTime} from './tempo-time-edit.js';
import {insertArrangementSections} from './arrangement-sections.js';
import {splitRegion,clampCompRounding} from './region-split.js';
import {automationSegments,orderedAutomationValue} from './automation-curves.js';

// Preserve the rendered curve on both sides of the gap. Only a curved segment
// crossing the cut is materialized into the scheduler's existing linear pieces.
export function insertAutomationTime(points,position,duration){
 const result=[];
 for(const parameter of new Set(points.map(p=>p.parameter))){
  let lane=points.filter(p=>p.parameter===parameter).sort((a,b)=>a.time-b.time);
  if(!lane.some(p=>p.time>=position)){result.push(...lane);continue;}
  const previous=lane.findLast(p=>p.time<position),next=lane.find(p=>p.time>=position);
  if(previous&&next.time>position&&['smooth','easeIn','easeOut'].includes(previous.shape)){
   const pieces=automationSegments([previous,next],parameter).slice(0,-1).map(p=>({...p,id:p.id||crypto.randomUUID(),shape:'linear'}));
   lane=lane.flatMap(p=>p===previous?pieces:[p]);
  }
  const before=lane.findLast(p=>p.time<position),value=orderedAutomationValue(lane,position,0);
  const leftValue=next.time===position&&before?.shape==='hold'?before.value:value;
  result.push(...lane.map(p=>({...p,time:p.time>=position?p.time+duration:p.time})));
  result.push({id:crypto.randomUUID(),parameter,time:position,value:leftValue,shape:'hold'});
  if(!lane.some(p=>p.time===position))result.push({id:crypto.randomUUID(),parameter,time:position+duration,value,shape:before?.shape==='hold'?'hold':'linear'});
 }
 return result.sort((a,b)=>a.time-b.time);
}
export function insertProjectTime(session,{position,duration},{skipMeter=false}={}){
 if(!Number.isFinite(position)||position<0||!Number.isFinite(duration)||duration<=0||position+duration>86400)throw Error('Enter an insertion position and positive duration within 24 hours.');
 const tempoTiming=insertTempoTime(session,position,duration);
 const meterTiming=skipMeter?null:insertMeterTime(session,position,duration,tempoTiming??session);
 const shift=t=>{if(t<position)return t;const next=t+duration;if(next>86400||next<=t)throw Error('Insertion exceeds the timeline limit or is too small to represent.');return next;};
 shift(position);
 const automate=owner=>{owner.automation=insertAutomationTime(owner.automation||[],position,duration);};
 for(const track of session.tracks){
  const splitIds=new Map();
  track.regions=track.regions.flatMap(region=>{
   if(region.start+region.duration>position)shift(region.start+region.duration);
   if(region.start>=position)return [{...region,start:shift(region.start)}];
   if(region.start+region.duration<=position)return [region];
   const {left,right}=splitRegion(region,position,track.kind);
   right.start+=duration;splitIds.set(region.id,right.id);return [left,right];
  });
  for(const alternative of track.compAlternatives||[])alternative.segments=alternative.segments.flatMap(segment=>{
   const rightId=splitIds.get(segment.regionId)||segment.regionId;
   if(segment.end<=position)return [segment];
   if(segment.start>=position)return [{...segment,regionId:rightId,start:shift(segment.start),end:shift(segment.end)}];
   return [{...segment,end:position},{...segment,regionId:rightId,start:position+duration,end:segment.end+duration}];
  });
  clampCompRounding(track);automate(track);for(const owner of [...track.effects,...track.sends])automate(owner);
 }
 session.masterAutomation=insertAutomationTime(session.masterAutomation,position,duration);
 for(const effect of session.masterEffects)automate(effect);
 for(const marker of session.markers)marker.time=shift(marker.time);
 session.sections=insertArrangementSections(session.sections,position,duration);
 for(const prefix of ['loop','audioPunch','midiPunch']){
  const start=prefix+'Start',end=prefix+'End';
  // A range ending at the cut stays on the left; one starting there moves.
  if(session[start]>=position){session[start]+=duration;session[end]+=duration;}
  else if(session[end]>position)session[end]+=duration;
 }
 if(tempoTiming)Object.assign(session,tempoTiming);
 if(meterTiming)Object.assign(session,meterTiming);
}
export function insertTimeView(position){return `<details class="daw-markers"><summary>Insert time</summary><form data-insert-time><label>At · seconds<input name="position" type="number" min="0" max="86400" step="any" value="${position}" required></label><label>Duration · seconds<input name="duration" type="number" min="0.001" max="86400" step="any" value="4" required></label><button>Insert time across project</button></form><p class="muted">Splits crossing regions and moves later regions, automation, markers and saved comp selections together. Effect tails may continue into the gap. Undo restores the whole edit.</p></details>`;}
export function bindInsertTime(root,{execute,guard}){root.querySelector('[data-insert-time]').onsubmit=guard(e=>{e.preventDefault();const form=e.currentTarget;execute([{op:'session.insertTime',values:{position:Number(form.elements.position.value),duration:Number(form.elements.duration.value)}}],'Inserted time across project');});}
