import {sustainLengthPlan} from './sustain-lengths.js';
import {draggedSourceOffset} from './region-slip.js';
import {snapArrangementDelta,defaultArrangementSnap} from './arrangement-snap.js';
import {selectedRegions,clampRegionMove} from './region-selection.js';
import {regionEnvelopePoints} from './region-fades.js';
import {chasedEvents,sustainedEnd} from './midi-events.js';
// Timeline boundaries are absolute seconds. Source offsets always describe the
// unreversed recording, even when a region is auditioned backwards.
export function trimmedRegion(region,start,end){
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)throw Error('Trim boundaries must define a positive region.');
 const duration=end-start,offset=region.reverse?region.offset+region.start+region.duration-end:region.offset+start-region.start;
 if(offset<-.000001)throw Error('Trim would extend before the source recording.');
 const fadeIn=Math.min(region.fadeIn,duration),fadeOut=Math.min(region.fadeOut,duration-fadeIn);
 return {start,duration,offset:Math.max(0,offset),fadeIn,fadeOut};
}
// MIDI regions contain editable events, rather than a pointer into source audio.
// Cropping is undoable; extending a cropped edge does not resurrect removed notes.
export function trimmedMidiRegion(region,start,end){
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)throw Error('Trim boundaries must define a positive region.');
 if(start<region.start||end>region.start+region.duration)throw Error('MIDI trim must stay inside the current region. Undo to restore cropped notes.');
 // Cropped notes cannot retain the original key-down capture time for sostenuto.
 // Bake both pedals first so the new region preserves its audible gates.
 if(region.notes.length&&(region.events||[]).some(e=>e.type==='controlChange'&&e.parameter===66)){
  const plan=sustainLengthPlan(region),durations=new Map(plan.edits.map(e=>[e.id,e.duration])),removed=new Set(plan.removedIds);
  region={...region,notes:region.notes.map(n=>durations.has(n.id)?{...n,duration:durations.get(n.id)}:n),events:region.events.filter(e=>!removed.has(e.id))};
 }
 const from=start-region.start,to=end-region.start,duration=end-start;
 const notes=region.notes.flatMap(note=>{
  const soundingEnd=sustainedEnd(note,(region.events||[]).filter(e=>e.channel===note.channel),region.duration);
  if(note.start>=to||soundingEnd<=from)return [];
  // A note already released but held by the pedal must remain audible at the cut.
  // A carried gate need not span the entire pedal hold. Cap it at the MIDI
  // note-length limit; the chased pedal still sustains it to the original release.
  const noteEnd=note.start+note.duration<=from?Math.min(soundingEnd,from+3600):note.start+note.duration;
  const localStart=Math.max(from,note.start);
  return [{...note,start:localStart-from,duration:Math.min(to,noteEnd)-localStart}];
 });
 const events=[...chasedEvents(region.events||[],from),...(region.events||[]).filter(e=>e.start>=from&&e.start<=to).map(e=>({...e,start:e.start-from}))].sort((a,b)=>a.start-b.start);
 const fadeIn=Math.min(region.fadeIn,duration),fadeOut=Math.min(region.fadeOut,duration-fadeIn);
 return {start,duration,offset:0,notes,events,fadeIn,fadeOut};
}
// Split MIDI through the same crop/chase logic as trimming, including notes
// whose key has been released but whose channel sustain pedal remains down.
export function splitMidiRegion(region,time){
 const at=time-region.start;
 if(!Number.isFinite(at)||at<=0||at>=region.duration)throw Error('Split must be inside the region.');
 const left={...region,...trimmedMidiRegion(region,region.start,time),fadeOut:0,fadeIn:Math.min(region.fadeIn,at)};
 left.events=left.events.filter(event=>event.start<at);
 const right={...region,...trimmedMidiRegion(region,time,region.start+region.duration),id:crypto.randomUUID(),fadeIn:0,fadeOut:Math.min(region.fadeOut,region.duration-at)};
 right.notes=right.notes.map(note=>({...note,id:crypto.randomUUID()}));
 right.events=right.events.map(event=>({...event,id:crypto.randomUUID()}));
 return {left,right};
}
export function regionHandles(region,kind){return `<span class="daw-trim start" data-region-handle="trim-start" title="Trim start"></span><span class="daw-trim end" data-region-handle="trim-end" title="Trim end"></span>${kind!=='video'?`<svg class="daw-fade-envelope" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${regionEnvelopePoints(region).map((p,i)=>`${i?'L':'M'} ${p.time/region.duration*100} ${(1-p.value)*100}`).join(' ')}"/></svg><span class="daw-fade-handle" data-region-handle="fadeIn" style="left:${region.fadeIn/region.duration*100}%" title="Fade in"></span><span class="daw-fade-handle end" data-region-handle="fadeOut" style="right:${region.fadeOut/region.duration*100}%" title="Fade out"></span>`:''}`;}
export function bindRegions(root,{session,zoom,select,seek,execute,guard,sourceDuration,renderWaveform=null,selectionIds=[],snapSettings=defaultArrangementSnap}){
 root.querySelectorAll('[data-region]').forEach(el=>{
  const owner=session.tracks.find(t=>t.regions.some(r=>r.id===el.dataset.region)),region=owner.regions.find(r=>r.id===el.dataset.region);
  el.onclick=e=>{if(e.detail===0)select(region.id,true,e);};el.ondblclick=()=>seek(region.id,region.start);
  el.onpointerdown=e=>{if(e.button!==0)return;const handle=e.target.closest('[data-region-handle]')?.dataset.regionHandle||(e.altKey&&owner.kind==='audio'?'slip':'move'),x=e.clientX,y=e.clientY,revision=session.revision;const group=selectionIds.includes(region.id)&&selectionIds.length>1?selectedRegions(session,selectionIds):[region];let moved=false,command=null;if(handle==='slip'&&(!Number.isFinite(sourceDuration(region.assetId))||sourceDuration(region.assetId)<region.duration)){guard(()=>{throw Error('Load the audio source before slip editing.');})();return;}el.setPointerCapture(e.pointerId);
   el.onpointermove=event=>{const dx=event.clientX-x;if(!moved&&Math.abs(dx)<4&&(handle!=='move'||Math.abs(event.clientY-y)<4))return;moved=true;const end=region.start+region.duration,minLength=.01,anchor=handle==='trim-end'?end:handle==='fadeIn'?region.start+region.fadeIn:handle==='fadeOut'?end-region.fadeOut:region.start,delta=snapArrangementDelta(session,dx/zoom,anchor,snapSettings,event.shiftKey);let values;
    if(handle==='slip'){
     const offset=draggedSourceOffset(region,delta,sourceDuration(region.assetId));
     const wave=el.querySelector('svg:not(.daw-fade-envelope)');if(wave&&renderWaveform)wave.outerHTML=renderWaveform({...region,offset});
     const label=el.querySelector('strong');if(label)label.textContent=`${region.name} · Source ${offset.toFixed(3)} s`;
     command={op:'region.set',target:region.id,values:{offset}};return;
    }
    if(handle==='move'&&group.length>1){
     const seconds=clampRegionMove(group,delta);for(const item of group){const node=[...root.querySelectorAll('[data-region]')].find(n=>n.dataset.region===item.id);if(node)node.style.left=(item.start+seconds)*zoom+'px';}command={op:'regions.move',values:{regionIds:group.map(r=>r.id).join(','),seconds}};return;
    }
    if(handle==='move'){
     const lanes=[...root.querySelectorAll('[data-lane]')],lane=lanes.find(l=>{const box=l.getBoundingClientRect();return event.clientY>=box.top&&event.clientY<box.bottom&&event.clientX>=box.left&&event.clientX<box.right;});
     const trackId=lane?.dataset.lane||owner.id,destination=session.tracks.find(t=>t.id===trackId);
     for(const l of lanes){l.classList.toggle('daw-region-drop',l===lane&&destination.kind===owner.kind);l.classList.toggle('daw-region-drop-invalid',l===lane&&destination.kind!==owner.kind);}
     values={trackId,start:Math.max(0,region.start+delta)};el.style.left=values.start*zoom+'px';
    }
    else if(handle==='fadeIn'||handle==='fadeOut'){const other=handle==='fadeIn'?region.fadeOut:region.fadeIn;values={[handle]:Math.max(0,Math.min(region.duration-other,region[handle]+delta*(handle==='fadeOut'?-1:1)))};const h=el.querySelector(`[data-region-handle="${handle}"]`);h.style[handle==='fadeIn'?'left':'right']=values[handle]/region.duration*100+'%';}
    else{const sourceEnd=sourceDuration(region.assetId)??region.offset+region.duration;let start=region.start,finish=end;
     if(handle==='trim-start'){const available=owner.kind==='midi'?0:region.reverse?sourceEnd-region.offset-region.duration:region.offset;start=Math.max(0,region.start-available,Math.min(end-minLength,region.start+delta));}
     else{const available=owner.kind==='midi'?0:region.reverse?region.offset:sourceEnd-region.offset-region.duration;finish=Math.max(region.start+minLength,Math.min(end+available,end+delta));}
     values={start,end:finish};el.style.left=start*zoom+'px';el.style.width=Math.max(18,(finish-start)*zoom)+'px';
    }
    command={op:handle==='move'?'region.move':handle.startsWith('trim')?'region.trim':'region.set',target:region.id,values};
   };
   const doc=root.ownerDocument;
   const cleanup=()=>{doc.removeEventListener('keydown',cancelKey,true);root.querySelectorAll('.daw-region-drop,.daw-region-drop-invalid').forEach(l=>l.classList.remove('daw-region-drop','daw-region-drop-invalid'));el.onpointermove=null;el.onpointerup=null;el.onpointercancel=null;el.onlostpointercapture=null;};
   const cancel=()=>{cleanup();if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);if(root.isConnected&&el.isConnected)select(region.id,true,{preserveGroup:handle==='move'&&group.length>1});};
   const cancelKey=event=>{if(event.key!=='Escape')return;event.preventDefault();event.stopPropagation();cancel();};
   doc.addEventListener('keydown',cancelKey,true);
   el.onpointercancel=cancel;el.onlostpointercapture=cancel;el.onpointerup=guard(event=>{cleanup();if(el.hasPointerCapture(event.pointerId))el.releasePointerCapture(event.pointerId);if(moved&&command){select(region.id,false,{preserveGroup:handle==='move'&&group.length>1});execute([command],handle==='move'?'Moved region':handle==='slip'?'Slipped audio source':handle.startsWith('trim')?'Trimmed region':'Changed region fade',revision);}else select(region.id,true,event);});
  };
 });
}
