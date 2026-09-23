// A launch creates a bounded passage on each affected track. Later actions cap
// existing passages, including future ones canceled before they become audible.
export function createScenePerformanceLog(initial){
 const passages=[];let windowEnd=initial.end;
 const canAppend=plan=>{if(passages.length+(plan.sourceCells?.length||0)>1000)throw Error('Stop and save this take before recording more than 1,000 clip passages.');};
 const append=(plan,start)=>{for(const cell of plan.sourceCells||[])passages.push({sceneId:plan.sceneId,trackId:cell.trackId,sourceSignature:cell.sourceSignature,start,end:Math.min(windowEnd,start+cell.duration)});};
 const cap=(time,trackId)=>{for(const p of passages)if(trackId===undefined||p.trackId===trackId)p.end=Math.min(p.end,time);};
 canAppend(initial);append(initial,0);
 return {canAppend,
  scene(plan,start){canAppend(plan);cap(start);windowEnd=start+plan.end;append(plan,start);},
  cell(plan,trackId,start){canAppend(plan);cap(start,trackId);append(plan,start);},
  stop(trackId,time){cap(time,trackId);},
  events(end){return passages.flatMap(({end:limit,...p})=>{const duration=Math.min(end,limit)-p.start;return duration>1e-6?[{...p,duration}]:[];}).sort((a,b)=>a.start-b.start||(a.trackId<b.trackId?-1:a.trackId>b.trackId?1:0));}
 };
}
