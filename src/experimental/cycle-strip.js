import {snapArrangementTime,snapArrangementDelta,arrangementStep,defaultArrangementSnap} from './arrangement-snap.js';
import {timelinePosition} from './timeline-ruler.js';
const limit=86400,minLength=.001,clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function cycleGesture(session,action,from,to,settings=defaultArrangementSnap,bypass=false){
 if(!Number.isFinite(from)||!Number.isFinite(to))throw Error('Choose a valid cycle position.');
 let start=session.loopStart,end=session.loopEnd;
 if(action==='draw'){
  const a=clamp(snapArrangementTime(session,from,settings.grid,bypass),0,limit),b=clamp(snapArrangementTime(session,to,settings.grid,bypass),0,limit);start=Math.min(a,b);end=Math.max(a,b);if(end-start<minLength)throw Error('Drag a positive cycle range. Hold Shift for a free edit.');
 }else{
  const anchor=action==='end'?end:start,delta=snapArrangementDelta(session,to-from,anchor,settings,bypass);
  if(action==='move'){const shift=clamp(delta,-start,limit-end);start+=shift;end+=shift;}
  else if(action==='start')start=clamp(start+delta,0,end-minLength);
  else if(action==='end')end=clamp(end+delta,start+minLength,limit);
  else throw Error('Choose a cycle edit.');
 }
 return {loopStart:start,loopEnd:end,loopEnabled:action==='draw'?true:session.loopEnabled};
}
const rangeText=(s,mode)=>`${timelinePosition(s.loopStart,s,mode)} – ${timelinePosition(s.loopEnd,s,mode)}`;
export function cycleStripView(session,zoom,mode){return `<div class="daw-cycle-strip" data-cycle-strip title="Drag empty space to create a cycle range. Shift bypasses snapping."><div class="daw-cycle-range" data-cycle-range data-enabled="${session.loopEnabled}" style="left:${session.loopStart*zoom}px;width:${Math.max(1,(session.loopEnd-session.loopStart)*zoom)}px"><span data-cycle-edge="start" role="slider" tabindex="0" aria-label="Cycle start" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="${session.loopEnd}" aria-valuenow="${session.loopStart}" aria-valuetext="${timelinePosition(session.loopStart,session,mode)}"></span><button type="button" data-cycle-body aria-label="Move cycle range; click to toggle cycle" aria-pressed="${session.loopEnabled}" title="Drag to move; click to turn cycle on or off. Arrow keys move by one snap step.">${rangeText(session,mode)}</button><span data-cycle-edge="end" role="slider" tabindex="0" aria-label="Cycle end" aria-orientation="horizontal" aria-valuemin="${session.loopStart}" aria-valuemax="86400" aria-valuenow="${session.loopEnd}" aria-valuetext="${timelinePosition(session.loopEnd,session,mode)}"></span></div></div>`;}
export function bindCycleStrip(root,{session,zoom,mode,settings,execute,guard,blocked}){
 const strip=root.querySelector('[data-cycle-strip]'),range=strip.querySelector('[data-cycle-range]'),body=strip.querySelector('[data-cycle-body]'),scroll=root.querySelector('.daw-scroll');
 const render=values=>{range.style.left=values.loopStart*zoom+'px';range.style.width=Math.max(1,(values.loopEnd-values.loopStart)*zoom)+'px';range.dataset.enabled=String(values.loopEnabled);const label=rangeText({...session,...values},mode);body.textContent=label;body.setAttribute('aria-pressed',String(values.loopEnabled));for(const edge of ['start','end']){const node=strip.querySelector(`[data-cycle-edge="${edge}"]`),time=edge==='start'?values.loopStart:values.loopEnd;node.setAttribute('aria-valuenow',String(time));node.setAttribute('aria-valuetext',timelinePosition(time,session,mode));node.setAttribute(edge==='start'?'aria-valuemax':'aria-valuemin',String(edge==='start'?values.loopEnd:values.loopStart));}body.title=label+' · Drag to move; click to toggle.';};
 const commit=(values,revision=session.revision)=>{if(Object.keys(values).every(key=>values[key]===session[key]))return;execute([{op:'session.set',values}],'Updated cycle range',revision);};
 const toggle=()=>commit({loopEnabled:!session.loopEnabled});
 root.querySelector('[data-cycle-strip-toggle]').onclick=guard(()=>{if(!blocked())toggle();});
 body.onclick=guard(e=>{if(e.detail===0&&!blocked())toggle();});
 strip.onkeydown=guard(e=>{if(blocked()||!['ArrowLeft','ArrowRight'].includes(e.key))return;const edge=e.target.dataset.cycleEdge,action=edge||'move';if(!edge&&!e.target.matches('[data-cycle-body]'))return;e.preventDefault();const amount=e.shiftKey ? .01 : (arrangementStep(session,settings.grid)||.01),anchor=action==='end'?session.loopEnd:session.loopStart;commit(cycleGesture(session,action,anchor,anchor+(e.key==='ArrowLeft'?-amount:amount),settings,e.shiftKey));const target=root.querySelector(edge?`[data-cycle-edge="${edge}"]`:'[data-cycle-body]');target?.focus({preventScroll:true});});
 strip.onpointerdown=e=>{
  if(e.button!==0||blocked())return;e.preventDefault();e.stopPropagation();const edge=e.target.closest('[data-cycle-edge]')?.dataset.cycleEdge,action=edge||(e.target.closest('[data-cycle-range]')?'move':'draw'),point=event=>(event.clientX-strip.getBoundingClientRect().left)/zoom,from=point(e),origin=e.clientX,revision=session.revision;
  let moved=false,ended=false,last=e,values=null,error='',frame;
  strip.setPointerCapture(e.pointerId);(edge?strip.querySelector(`[data-cycle-edge="${edge}"]`):body).focus({preventScroll:true});
  const update=()=>{if(!moved&&Math.abs(last.clientX-origin)<4)return;moved=true;try{values=cycleGesture(session,action,from,point(last),settings,last.shiftKey);error='';render(values);}catch(e){values=null;error=e.message;}};
  const key=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(true);}};
  const finish=cancel=>{if(ended)return;ended=true;cancelAnimationFrame(frame);strip.removeEventListener('keydown',key);strip.onpointermove=null;strip.onpointerup=null;strip.onpointercancel=null;strip.onlostpointercapture=null;if(strip.hasPointerCapture(e.pointerId))strip.releasePointerCapture(e.pointerId);if(!strip.isConnected)return;render(session);if(cancel)return;if(moved){if(error)throw Error(error);if(values)commit(values,revision);}else if(action==='move')toggle();};
  strip.addEventListener('keydown',key);strip.onpointermove=event=>{last=event;update();};strip.onpointerup=guard(event=>{last=event;update();finish(false);});strip.onpointercancel=()=>finish(true);strip.onlostpointercapture=()=>finish(true);
  const tick=()=>{if(ended)return;if(!strip.isConnected){finish(true);return;}if(moved){const bounds=scroll.getBoundingClientRect(),left=scroll.scrollLeft;if(last.clientX>bounds.right-24)scroll.scrollLeft+=12;else if(last.clientX<bounds.left+24)scroll.scrollLeft-=12;if(left!==scroll.scrollLeft)update();}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
 };
}
