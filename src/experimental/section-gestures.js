import {snapArrangementDelta,arrangementKeyboardDelta,defaultArrangementSnap} from './arrangement-snap.js';
import {timelinePosition} from './timeline-ruler.js';
const limit=86400,minLength=.001,clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function sectionGesture(session,id,action,delta,settings=defaultArrangementSnap,bypass=false){
 const ordered=[...session.sections].sort((a,b)=>a.start-b.start),index=ordered.findIndex(s=>s.id===id),section=ordered[index];
 if(!section||!Number.isFinite(delta))throw Error('Choose an existing section and a valid drag distance.');
 const duration=section.end-section.start,anchor=action==='end'?section.end:section.start,offset=snapArrangementDelta(session,delta,anchor,settings,bypass);
 if(['move','copy'].includes(action)){
  const position=clamp(section.start+offset,0,action==='copy'?limit-duration:limit),start=action==='move'&&position>section.end?position-duration:position;
  if(action==='move'&&(position===section.start||position===section.end))return {commands:[],action,position,start:section.start,end:section.end,preview:[]};
  if(action==='move'&&position>section.start&&position<section.end)throw Error('Move outside this section; hold Option / Alt to copy inside it.');
  return {commands:[{op:'section.editContent',target:id,values:{action,position}}],action,position,start,end:start+duration,preview:[]};
 }
 if(!['start','end'].includes(action))throw Error('Choose a section move, copy or boundary edit.');
 const neighbor=ordered[index+(action==='start'?-1:1)],touching=neighbor&&Math.abs((action==='start'?neighbor.end:neighbor.start)-anchor)<=1e-9;
 const low=action==='start'?(neighbor?(touching?neighbor.start+minLength:neighbor.end):0):section.start+minLength;
 const high=action==='end'?(neighbor?(touching?neighbor.end-minLength:neighbor.start):limit):section.end-minLength;
 if(low>high)throw Error('These sections are too short for a graphical resize. Use the numeric bounds.');
 const position=clamp(anchor+offset,low,high),preview=[{...section,[action]:position}];
 if(touching)preview.push({...neighbor,[action==='start'?'end':'start']:position});
 const commands=preview.filter(s=>{const old=session.sections.find(p=>p.id===s.id);return s.start!==old.start||s.end!==old.end;}).map(s=>({op:'section.set',target:s.id,values:{start:s.start,end:s.end}}));
 return {commands,action,position,start:preview[0].start,end:preview[0].end,preview};
}
export function bindSectionGestures(root,{session,zoom,mode,settings,select,selectForEdit,execute,guard,blocked}){
 const strip=root.querySelector('[data-section-strip]'),scroll=root.querySelector('.daw-scroll');let dragging=false;
 const format=time=>timelinePosition(time,session,mode);
 root.querySelectorAll('[data-section-select]').forEach(button=>button.onclick=e=>{if(e.detail===0&&!blocked())select(button.dataset.sectionSelect);});
 const render=sections=>{for(const s of sections){const row=strip.querySelector(`[data-section-range="${s.id}"]`);if(!row)continue;row.style.left=s.start*zoom+'px';row.style.width=Math.max(1,(s.end-s.start)*zoom)+'px';for(const edge of ['start','end']){const handle=row.querySelector(`[data-section-edge="${edge}"]`);handle.setAttribute('aria-valuenow',String(s[edge]));handle.setAttribute('aria-valuetext',format(s[edge]));}}};
 strip.onkeydown=guard(e=>{if(dragging||blocked()||!['ArrowLeft','ArrowRight'].includes(e.key))return;const edge=e.target.dataset.sectionEdge,id=e.target.closest('[data-section-range]')?.dataset.sectionRange;if(!edge||!id)return;e.preventDefault();e.stopPropagation();const section=session.sections.find(s=>s.id===id),anchor=edge==='end'?section.end:section.start,direction=e.key==='ArrowLeft'?-1:1,delta=e.shiftKey?.01*direction:arrangementKeyboardDelta(session,settings.grid,anchor,direction),plan=sectionGesture(session,id,edge,delta,settings,e.shiftKey);if(plan.commands.length){selectForEdit(id);execute(plan.commands,'Resized section labels',session.revision);root.querySelector(`[data-section-range="${id}"] [data-section-edge="${edge}"]`)?.focus({preventScroll:true});}});
 strip.onpointerdown=e=>{
  const row=e.target.closest('[data-section-range]');if(e.button!==0||dragging||blocked()||!row)return;
  e.preventDefault();e.stopPropagation();dragging=true;const id=row.dataset.sectionRange,edge=e.target.closest('[data-section-edge]')?.dataset.sectionEdge,point=event=>(event.clientX-strip.getBoundingClientRect().left)/zoom,from=point(e),origin=e.clientX;
  const ghost=document.createElement('div'),line=document.createElement('div'),hint=document.createElement('output');ghost.className='daw-section-ghost';ghost.hidden=true;line.className='daw-section-drop-line';line.hidden=true;hint.className='daw-section-gesture-hint';hint.setAttribute('role','status');hint.hidden=true;strip.append(ghost,line,hint);
  let moved=false,ended=false,last=e,plan=null,error='',frame;
  strip.setPointerCapture(e.pointerId);(edge?row.querySelector(`[data-section-edge="${edge}"]`):row.querySelector('button')).focus({preventScroll:true});
  const update=()=>{if(!moved&&Math.abs(last.clientX-origin)<4)return;moved=true;hint.hidden=false;try{plan=sectionGesture(session,id,edge||(last.altKey?'copy':'move'),point(last)-from,settings,last.shiftKey);error='';render(session.sections);render(plan.preview);if(edge){ghost.hidden=true;line.hidden=true;hint.textContent=`Label bounds: ${format(plan.start)} – ${format(plan.end)} · music stays in place`;}else{ghost.hidden=false;line.hidden=false;ghost.style.left=plan.start*zoom+'px';ghost.style.width=Math.max(1,(plan.end-plan.start)*zoom)+'px';line.style.left=plan.position*zoom+'px';ghost.textContent=(plan.action==='copy'?'Copy ':'Move ')+session.sections.find(s=>s.id===id).name;hint.textContent=plan.commands.length?`${plan.action==='copy'?'Copy':'Move'} starts at ${format(plan.start)} · insert at ${format(plan.position)} on the original timeline`:'Section stays in place';}hint.dataset.invalid='false';}catch(e){plan=null;error=e.message;ghost.hidden=true;line.hidden=true;render(session.sections);hint.textContent=error;hint.dataset.invalid='true';}};
  const key=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(true);}else if(['Alt','Shift'].includes(event.key)){last={clientX:last.clientX,altKey:event.altKey,shiftKey:event.shiftKey};update();}};
  const finish=cancel=>{if(ended)return;ended=true;dragging=false;cancelAnimationFrame(frame);strip.removeEventListener('keydown',key);strip.removeEventListener('keyup',key);strip.onpointermove=null;strip.onpointerup=null;strip.onpointercancel=null;strip.onlostpointercapture=null;if(strip.hasPointerCapture(e.pointerId))strip.releasePointerCapture(e.pointerId);ghost.remove();line.remove();hint.remove();if(!strip.isConnected)return;render(session.sections);if(cancel)return;if(!moved){select(id);return;}if(error)throw Error(error);if(plan?.commands.length){selectForEdit(id);execute(plan.commands,edge?'Resized section labels':plan.action==='copy'?'Copied arrangement section':'Moved arrangement section',session.revision);}};
  strip.addEventListener('keydown',key);strip.addEventListener('keyup',key);strip.onpointermove=event=>{if(event.pointerId!==e.pointerId)return;last=event;update();};strip.onpointerup=guard(event=>{if(event.pointerId!==e.pointerId)return;last=event;update();finish(false);});strip.onpointercancel=()=>finish(true);strip.onlostpointercapture=()=>finish(true);
  const tick=()=>{if(ended)return;if(!strip.isConnected){finish(true);return;}if(moved&&scroll){const bounds=scroll.getBoundingClientRect(),old=scroll.scrollLeft;if(last.clientX>bounds.right-24)scroll.scrollLeft+=12;else if(last.clientX<bounds.left+24)scroll.scrollLeft-=12;if(old!==scroll.scrollLeft)update();}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
 };
}
