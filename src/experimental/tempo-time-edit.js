import {compileTempoMap} from './tempo-map.js';
// Timeline edits move material in seconds. Rebuild beat anchors from the edited
// tempo segments instead of applying a second musical retime to MIDI regions.
export function tempoFromSeconds(points){
 const ordered=[...new Map(points.map(p=>[p.time,p])).values()].sort((a,b)=>a.time-b.time);
 if(!ordered.length||ordered[0].time!==0)throw Error('A tempo timeline must start at zero.');
 const tempo=ordered[0].bpm,tempoChanges=[];let previous=ordered[0],beat=0;
 for(const p of ordered.slice(1)){
  if(!Number.isFinite(p.time)||p.time<0||p.time>86400)throw Error('Tempo change exceeds the timeline.');
  if(p.bpm===previous.bpm)continue;
  const next=beat+(p.time-previous.time)*previous.bpm/60;if(next<=beat)throw Error('Tempo change spacing is below timeline precision.');
  tempoChanges.push({...(p.id===undefined?{}:{id:p.id}),beat:next,bpm:p.bpm});previous=p;beat=next;
 }
 const timing={tempo,tempoChanges};compileTempoMap(timing);return timing;
}
export function insertTempoTime(session,position,duration){
 if(!Number.isFinite(position)||position<0||!Number.isFinite(duration)||duration<=0||position+duration>86400)throw Error('Choose a valid tempo insertion range.');
 if(!session.tempoChanges?.length)return null;
 const map=compileTempoMap(session);
 return tempoFromSeconds(map.points.map((p,i)=>({...p,time:i&&p.time>=position?p.time+duration:p.time})));
}
export function deleteTempoTime(session,start,end){
 if(!Number.isFinite(start)||start<0||!Number.isFinite(end)||end<=start||end>86400)throw Error('Choose a valid tempo deletion range.');
 if(!session.tempoChanges?.length)return null;
 const map=compileTempoMap(session),after=map.points.filter(p=>p.time>=end).map(p=>({...p,time:p.time-(end-start)})),before=map.points.filter(p=>p.time<start);
 if(!after.some(p=>p.time===start))after.unshift({time:start,bpm:map.tempoAtTime(end),...(start?{id:crypto.randomUUID()}:{})});
 return tempoFromSeconds([...before,...after]);
}
