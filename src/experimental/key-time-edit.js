import {compileKeyMap,validateKeySignature} from './key-map.js';
import {compileTempoMap} from './tempo-map.js';
const same=(a,b)=>a===null?b===null:b!==null&&a.sharps===b.sharps&&a.mode===b.mode;
function timeline(session){
 const tempo=compileTempoMap(session),keys=compileKeyMap(session);
 const points=[{time:0,key:session.keySignature??null},...keys.points.filter(p=>p.beat>0).map(p=>({time:tempo.timeAtBeat(p.beat),key:validateKeySignature(p),id:p.id}))];
 return {points,at:time=>points.findLast(p=>p.time<=time)?.key??null};
}
function rebuild(points,timing){
 const ordered=[...new Map(points.map(p=>[p.time,p])).values()].sort((a,b)=>a.time-b.time),tempo=compileTempoMap(timing);
 if(ordered[0]?.time!==0)throw Error('Key timeline must start at zero.');
 const keySignature=ordered[0].key,keyChanges=[];let previous=keySignature;
 for(const p of ordered.slice(1)){
  if(!Number.isFinite(p.time)||p.time<0||p.time>86400)throw Error('Key change exceeds the 24-hour timeline.');
  if(same(previous,p.key))continue;
  if(p.key===null)throw Error('This section would introduce an unknown key after a known key. Set a project opening key before transferring it.');
  keyChanges.push({id:p.id??crypto.randomUUID(),beat:tempo.beatAtTime(p.time),...p.key});previous=p.key;
 }
 const result={keySignature,keyChanges};compileKeyMap(result);return result;
}
export function insertKeyTime(session,position,duration,timing){
 const from=timeline(session);
 return rebuild(from.points.map((p,i)=>({...p,time:i&&p.time>=position?p.time+duration:p.time})),timing);
}
export function deleteKeyTime(session,start,end,timing){
 const from=timeline(session),after=from.points.filter(p=>p.time>=end).map(p=>({...p,time:p.time-(end-start)}));
 if(!after.some(p=>p.time===start))after.unshift({time:start,key:from.at(end)});
 return rebuild([...from.points.filter(p=>p.time<start),...after],timing);
}
export function insertKeySection(destination,source,start,end,position,timing,{move=false}={}){
 const from=timeline(source),to=timeline(destination),duration=end-start;
 const before=to.points.filter(p=>p.time<position),after=to.points.filter(p=>p.time>=position).map(p=>({...p,time:p.time+duration}));
 if(!after.some(p=>p.time===position+duration))after.unshift({time:position+duration,key:to.at(position)});
 const first=from.points.find(p=>p.time===start),copied=[{time:position,key:from.at(start),...(move&&first?.id?{id:first.id}:{})},...from.points.filter(p=>p.time>start&&p.time<end).map(p=>({...p,time:position+p.time-start,id:move?p.id:crypto.randomUUID()}))];
 return rebuild([...before,...copied,...after],timing);
}
