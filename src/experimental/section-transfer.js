import {insertMeterSection} from './meter-time-edit.js';
import {insertTempoSection} from './tempo-time-edit.js';
import {copiedArrangementSections} from './arrangement-sections.js';
import {insertProjectTime,insertAutomationTime} from './insert-time.js';
import {deleteProjectTime} from './delete-time.js';
import {splitRegion,clampCompRounding} from './region-split.js';
import {automationSegments,orderedAutomationValue} from './automation-curves.js';

function materialize(points,parameter,bounds){const lane=points.filter(p=>p.parameter===parameter).sort((a,b)=>a.time-b.time);return lane.flatMap((p,i)=>{const next=lane[i+1];return next&&['smooth','easeIn','easeOut'].includes(p.shape)&&bounds.some(t=>p.time<t&&t<=next.time)?automationSegments([p,next],parameter).slice(0,-1).map(q=>({...q,id:q.id||crypto.randomUUID(),shape:'linear'})):[p];});}
export function insertAutomationSection(destination,source,start,end,position){
 const duration=end-start,result=[];
 for(const parameter of new Set([...source,...destination].map(p=>p.parameter))){
  const from=materialize(source,parameter,[start,end]),to=materialize(destination,parameter,[position]);
  if(!from.length){result.push(...insertAutomationTime(to,position,duration));continue;}
  const sourceCurve=automationSegments(from,parameter),targetCurve=automationSegments(to,parameter);
  const point=(time,at,lane,curve)=>({id:crypto.randomUUID(),parameter,time,value:orderedAutomationValue(curve,at,0),shape:lane.findLast(p=>p.time<at)?.shape==='hold'?'hold':'linear'});
  const before=to.filter(p=>p.time<position),copy=from.filter(p=>p.time>=start&&p.time<end).map(p=>({...p,id:crypto.randomUUID(),time:position+(p.time-start)})),after=to.filter(p=>p.time>=position).map(p=>({...p,time:p.time+duration}));
  if(!copy.some(p=>p.time===position))copy.unshift(point(position,start,from,sourceCurve));
  if(!after.some(p=>p.time===position+duration))after.unshift(point(position+duration,position,to,targetCurve));
  const seam=(points,time,at,lane,curve)=>{const epsilon=Math.min(.000001,(time-(points.at(-1)?.time??0))/2),left=time-epsilon;if(left>=time)throw Error('Section boundary is too close to an automation point.');points.push({...point(left,at-epsilon,lane,curve),shape:'hold'});};
  if(position>0)seam(before,position,position,to,targetCurve);
  seam(copy,position+duration,end,from,sourceCurve);
  result.push(...before,...copy,...after);
 }
 return result.sort((a,b)=>a.time-b.time);
}
function copyRegion(region,kind,start,end,position){let piece=structuredClone(region);if(piece.start+piece.duration>end)piece=splitRegion(piece,end,kind).left;if(piece.start<start)piece=splitRegion(piece,start,kind).right;piece.id=crypto.randomUUID();piece.start=position+(piece.start-start);for(const item of [...piece.notes,...piece.events])item.id=crypto.randomUUID();return piece;}
export function transferProjectSection(session,{mode,start,end,position}){
 if(!['copy','move'].includes(mode)||![start,end,position].every(Number.isFinite)||start<0||end<=start||end>86400||position<0||position>86400)throw Error('Choose Copy or Move, a positive source section, and a destination within 24 hours.');
 if(mode==='move'&&position>=start&&position<=end)throw Error('Choose a move destination outside the source section.');
 const duration=end-start,source=structuredClone(session);
 if(mode==='move'){deleteProjectTime(session,{start,end});if(position>end)position-=duration;}
 if(position+duration>86400)throw Error('The inserted section exceeds the 24-hour timeline.');
 const destination=structuredClone(session),automate=(to,from)=>insertAutomationSection(to,from,start,end,position);
 const tempoTiming=insertTempoSection(destination,source,start,end,position,{move:mode==='move'});
 const meterTiming=insertMeterSection(destination,source,start,end,position,tempoTiming??destination,{move:mode==='move'});
 insertProjectTime(session,{position,duration},{skipMeter:true});
 for(let i=0;i<source.tracks.length;i++){
  const original=source.tracks[i],previous=destination.tracks[i],track=session.tracks[i],copies=new Map();
  for(const region of original.regions){if(region.start>=end||region.start+region.duration<=start)continue;const copy=copyRegion(region,track.kind,start,end,position);copies.set(region.id,copy);track.regions.push(copy);}
  if(track.regions.length>1000)throw Error('Section insertion would exceed the 1,000-region track limit.');
  for(const alternative of original.compAlternatives||[]){const segments=[];for(const segment of alternative.segments){const a=Math.max(start,segment.start),b=Math.min(end,segment.end);if(b<=a)continue;const copy=copies.get(segment.regionId),mappedStart=position+(a-start),mappedEnd=position+(b-start);if(!copy||mappedStart<copy.start-1e-9||mappedEnd>copy.start+copy.duration+1e-9)throw Error('A saved comp section no longer fits its source region. Update the comp before transferring.');segments.push({...segment,regionId:copy.id,start:mappedStart,end:mappedEnd});}
   if(!segments.length)continue;let comp=track.compAlternatives.find(c=>c.id===alternative.id);if(!comp){comp={...structuredClone(alternative),segments:[]};track.compAlternatives.push(comp);}comp.segments.push(...segments);comp.segments.sort((a,b)=>a.start-b.start);
  }
  clampCompRounding(track);track.automation=automate(previous.automation,original.automation);track.effects.forEach((effect,j)=>{effect.automation=automate(previous.effects[j].automation,original.effects[j].automation);});track.sends.forEach((send,j)=>{send.automation=automate(previous.sends[j].automation,original.sends[j].automation);});
 }
 session.sections.push(...copiedArrangementSections(source.sections,start,end,position,mode==='move'));
 session.masterAutomation=automate(destination.masterAutomation,source.masterAutomation);session.masterEffects.forEach((effect,j)=>{effect.automation=automate(destination.masterEffects[j].automation,source.masterEffects[j].automation);});
 session.markers.push(...source.markers.filter(m=>m.time>=start&&m.time<end).map(m=>({...m,id:mode==='move'?m.id:crypto.randomUUID(),time:position+(m.time-start)})));
 // A locator range wholly inside the moved section follows that section.
 if(mode==='move')for(const prefix of ['loop','audioPunch','midiPunch']){const a=prefix+'Start',b=prefix+'End';if(source[a]>=start&&source[b]<=end){session[a]=position+(source[a]-start);session[b]=position+(source[b]-start);session[prefix+'Enabled']=source[prefix+'Enabled'];}}
 if(tempoTiming)Object.assign(session,tempoTiming);
 if(meterTiming)Object.assign(session,meterTiming);
}
export function sectionTransferView(session,position){return `<details class="daw-markers"><summary>Copy or move section</summary><form data-section-transfer><label>Action<select name="mode"><option value="copy">Copy section</option><option value="move">Move section</option></select></label><label>From · seconds<input name="start" type="number" min="0" max="86400" step="any" value="${session.loopStart}" required></label><label>To · seconds<input name="end" type="number" min="0" max="86400" step="any" value="${session.loopEnd}" required></label><label>Insert at · seconds<input name="position" type="number" min="0" max="86400" step="any" value="${position}" required></label><button type="button" data-transfer-cycle>Use cycle range</button><button>Apply across project</button></form><p class="muted">Includes all tracks, automation, markers and saved comp selections. Destination refers to the timeline before the edit. Copy makes room; Move also closes the source gap. Undo restores the whole edit.</p></details>`;}
export function bindSectionTransfer(root,{session,execute,guard}){const form=root.querySelector('[data-section-transfer]');root.querySelector('[data-transfer-cycle]').onclick=()=>{form.elements.start.value=session.loopStart;form.elements.end.value=session.loopEnd;};form.onsubmit=guard(e=>{e.preventDefault();const values={mode:form.elements.mode.value,start:Number(form.elements.start.value),end:Number(form.elements.end.value),position:Number(form.elements.position.value)};execute([{op:'session.transferSection',values}],values.mode==='copy'?'Copied section across project':'Moved section across project');const next=root.querySelector('[data-section-transfer]');for(const [key,value]of Object.entries(values))next.elements[key].value=value;});}
