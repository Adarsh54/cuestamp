// Read-only scheduling observations, independent of UI selection and timer ticks.
export function createSceneObservation(initial){
 let sceneId=initial.sceneId,pending=null,windowEnd=initial.end,cells=[];
 const append=(plan,start)=>{for(const cell of plan.sourceCells||[])if(cell.regionId)cells.push({sceneId:plan.sceneId,trackId:cell.trackId,regionId:cell.regionId,start,end:Math.min(windowEnd,start+cell.duration)});};
 const cap=(time,trackId)=>{for(const cell of cells)if(!trackId||cell.trackId===trackId)cell.end=Math.min(cell.end,time);cells=cells.filter(c=>c.end>c.start);};
 const prune=now=>{cells=cells.filter(c=>c.end>now);};
 append(initial,0);
 return {
  launch(plan,trackId,start,now){prune(now);cap(start,trackId);append(plan,start);},
  stop(trackId,time,now){prune(now);cap(time,trackId);},
  queue(plan,start,now){if(pending&&now>=pending.start)sceneId=pending.sceneId;prune(now);cap(start);pending={sceneId:plan.sceneId,start};windowEnd=start+plan.end;append(plan,start);},
  read(now){if(pending&&now>=pending.start){sceneId=pending.sceneId;pending=null;}return {currentSceneId:sceneId,queuedSceneId:pending?.sceneId??null,cells:cells.map(c=>({...c,state:now<c.start?'queued':now<c.end?'playing':'finished'}))};}
 };
}
export function updateSceneIndicators(root,observation){
 for(const element of root.querySelectorAll('[data-scene-cell-status]')){
  const states=new Set((observation?.cells||[]).filter(c=>c.sceneId===element.dataset.sceneCellStatus&&c.trackId===element.dataset.trackId&&c.regionId===element.dataset.regionId).map(c=>c.state));
  const visible=['playing','queued'].filter(s=>states.has(s));if(!visible.length&&states.has('finished'))visible.push('finished');
  const label=visible.map(s=>s[0].toUpperCase()+s.slice(1)).join(' · ');
  if(element.textContent!==label)element.textContent=label;
  element.dataset.playing=String(states.has('playing'));
 }
}
