import {insertTempoSection} from './tempo-time-edit.js';
import {copiedArrangementSections} from './arrangement-sections.js';
import {insertProjectTime} from './insert-time.js';
import {splitRegion,clampCompRounding} from './region-split.js';
import {automationSegments,orderedAutomationValue} from './automation-curves.js';

export function repeatAutomationSection(points,start,end){
 const duration=end-start,result=[];
 for(const parameter of new Set(points.map(p=>p.parameter))){
  let lane=points.filter(p=>p.parameter===parameter).sort((a,b)=>a.time-b.time);
  if(lane.at(-1).time<start){result.push(...lane);continue;}
  if(lane[0].time>=end){result.push(...lane.map(p=>({...p,time:p.time+duration})));continue;}
  lane=lane.flatMap((p,i)=>{const next=lane[i+1];return next&&['smooth','easeIn','easeOut'].includes(p.shape)&&[start,end].some(t=>p.time<t&&t<=next.time)?automationSegments([p,next],parameter).slice(0,-1).map(q=>({...q,id:q.id||crypto.randomUUID(),shape:'linear'})):[p];});
  const rendered=automationSegments(lane,parameter),value=t=>orderedAutomationValue(rendered,t,0);
  const before=lane.filter(p=>p.time<end),copy=lane.filter(p=>p.time>=start&&p.time<end).map(p=>({...p,id:crypto.randomUUID(),time:p.time+duration})),after=lane.filter(p=>p.time>=end).map(p=>({...p,time:p.time+duration}));
  const boundary=(time,sourceTime)=>({id:crypto.randomUUID(),parameter,time,value:value(sourceTime),shape:lane.findLast(p=>p.time<sourceTime)?.shape==='hold'?'hold':'linear'});
  if(!copy.some(p=>p.time===end))copy.unshift(boundary(end,start));
  if(!after.some(p=>p.time===end+duration))after.unshift(boundary(end+duration,end));
  // Preserve the curve up to each seam, then jump to the next section's value.
  const seam=(target,time,sourceEnd)=>{const gap=time-(target.at(-1)?.time??0),epsilon=Math.min(.000001,gap/2),at=time-epsilon;if(at>=time)throw Error('Repeat boundary is too close to an automation point.');target.push({...boundary(at,sourceEnd-epsilon),shape:'hold'});};
  seam(before,end,end);seam(copy,end+duration,end);
  result.push(...before,...copy,...after);
 }
 return result.sort((a,b)=>a.time-b.time);
}
function repeatedRegion(region,kind,start,end){
 let piece=structuredClone(region);
 if(piece.start+piece.duration>end)piece=splitRegion(piece,end,kind).left;
 if(piece.start<start)piece=splitRegion(piece,start,kind).right;
 piece.id=crypto.randomUUID();piece.start+=end-start;
 for(const item of [...piece.notes,...piece.events])item.id=crypto.randomUUID();
 return piece;
}
function repeatOnce(session,start,end){
 const source=structuredClone(session),duration=end-start;
 const tempoTiming=insertTempoSection(source,source,start,end,end);
 insertProjectTime(session,{position:end,duration});
 for(let i=0;i<source.tracks.length;i++){
  const original=source.tracks[i],track=session.tracks[i],copies=new Map();
  for(const region of original.regions){if(region.start>=end||region.start+region.duration<=start)continue;const copy=repeatedRegion(region,track.kind,start,end);copies.set(region.id,copy);track.regions.push(copy);}
  if(track.regions.length>1000)throw Error('Repeating would exceed the 1,000-region track limit.');
  for(const originalComp of original.compAlternatives||[]){const comp=track.compAlternatives.find(c=>c.id===originalComp.id);for(const segment of originalComp.segments){const a=Math.max(start,segment.start),b=Math.min(end,segment.end);if(b<=a)continue;const copy=copies.get(segment.regionId);if(!copy||a+duration<copy.start-1e-9||b+duration>copy.start+copy.duration+1e-9)throw Error('A saved comp section no longer fits its source region. Update the comp before repeating.');comp.segments.push({...segment,regionId:copy.id,start:a+duration,end:b+duration});}comp.segments.sort((a,b)=>a.start-b.start);}
  clampCompRounding(track);
  track.automation=repeatAutomationSection(original.automation,start,end);
  track.effects.forEach((effect,j)=>{effect.automation=repeatAutomationSection(original.effects[j].automation,start,end);});
  track.sends.forEach((send,j)=>{send.automation=repeatAutomationSection(original.sends[j].automation,start,end);});
 }
 session.sections.push(...copiedArrangementSections(source.sections,start,end,end));
 session.masterAutomation=repeatAutomationSection(source.masterAutomation,start,end);
 session.masterEffects.forEach((effect,j)=>{effect.automation=repeatAutomationSection(source.masterEffects[j].automation,start,end);});
 session.markers.push(...source.markers.filter(m=>m.time>=start&&m.time<end).map(m=>({...m,id:crypto.randomUUID(),time:m.time+duration})));
 if(tempoTiming)Object.assign(session,tempoTiming);
}
export function repeatProjectSection(session,{start,end,count=1}){
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||!Number.isInteger(count)||count<1||count>16||end+(end-start)*count>86400)throw Error('Choose a positive section and 1–16 additional copies within 24 hours.');
 for(let i=0;i<count;i++)repeatOnce(session,start,end);
}
export function repeatSectionView(session){return `<details class="daw-markers"><summary>Repeat section</summary><form data-repeat-section><label>From · seconds<input name="start" type="number" min="0" max="86400" step="any" value="${session.loopStart}" required></label><label>To · seconds<input name="end" type="number" min="0" max="86400" step="any" value="${session.loopEnd}" required></label><label>Additional copies<input name="count" type="number" min="1" max="16" step="1" value="1" required></label><button type="button" data-repeat-cycle>Use cycle range</button><button>Repeat across project</button></form><p class="muted">Copies this section immediately after itself and moves later material to make room. Includes all tracks, automation, markers and saved comp selections. Undo restores the whole edit.</p></details>`;}
export function bindRepeatSection(root,{session,execute,guard}){const form=root.querySelector('[data-repeat-section]');root.querySelector('[data-repeat-cycle]').onclick=()=>{form.elements.start.value=session.loopStart;form.elements.end.value=session.loopEnd;};form.onsubmit=guard(e=>{e.preventDefault();const values={start:Number(form.elements.start.value),end:Number(form.elements.end.value),count:Number(form.elements.count.value)};execute([{op:'session.repeatSection',values}],'Repeated section across project');const next=root.querySelector('[data-repeat-section]');for(const [key,value] of Object.entries(values))next.elements[key].value=value;});}
