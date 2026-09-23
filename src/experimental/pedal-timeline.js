const upper=(points,time,inclusive=true)=>{let lo=0,hi=points.length;while(lo<hi){const mid=(lo+hi)>>>1;if(inclusive?points[mid].time<=time:points[mid].time<time)lo=mid+1;else hi=mid;}return lo;};
export function compilePedalTimeline(events){
 const damper=[],releases=[],sostenuto=[],states=[];let active=null;
 for(const e of [...events].sort((a,b)=>a.start-b.start)){
  if(e.type!=='controlChange')continue;
  if(e.parameter===64||e.parameter===121){const p={time:e.start,value:e.parameter===121?0:e.value};damper.push(p);if(p.value<64)releases.push(p);}
  if(e.parameter===66||e.parameter===121){const down=e.parameter!==121&&e.value>=64;states.push({time:e.start,down});if(down&&!active){active={time:e.start,end:Infinity};sostenuto.push(active);}else if(!down&&active){active.end=e.start;active=null;}}
 }
 const captured=(note,time)=>{const interval=sostenuto[upper(sostenuto,time)-1];return interval&&interval.end>time&&note.start<interval.time&&note.start+note.duration>=interval.time?interval:null;};
 return {
  sostenutoCaptured:(note,time)=>Boolean(captured(note,time)),
  sostenutoBefore:time=>states[upper(states,time,false)-1]?.down??false,
  sustainedEnd(note,duration){const nominal=note.start+note.duration,hold=captured(note,nominal),end=hold?Math.min(duration,hold.end):nominal,index=upper(damper,end)-1;return index<0||damper[index].value<64?end:Math.min(duration,releases[upper(releases,end)]?.time??duration);}
 };
}
