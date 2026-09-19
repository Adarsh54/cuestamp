export function marqueeRegions(regions,from,to){
 const left=Math.min(from.x,to.x),right=Math.max(from.x,to.x),top=Math.min(from.y,to.y),bottom=Math.max(from.y,to.y);
 return regions.filter(r=>r.left<right&&r.right>left&&r.top<bottom&&r.bottom>top).map(r=>r.id);
}
export function combinedRegionSelection(previous,hit,add){const ids=add?[...new Set([...previous,...hit])]:[...new Set(hit)];if(ids.length>1000)throw Error('Select up to 1,000 regions at once. Reduce the selection box.');return ids;}
export function bindRegionMarquee(root,{selection,select,blocked}){
 const timeline=root.querySelector('.daw-timeline'),scroll=root.querySelector('.daw-scroll');if(!timeline)return;
 timeline.onpointerdown=e=>{
  if(e.button!==0||e.pointerType==='touch'||blocked()||e.target.closest('[data-region],.daw-ruler')||!e.target.closest('[data-lane]'))return;
  e.preventDefault();e.stopPropagation();const previous=[...selection],add=e.ctrlKey||e.metaKey||e.shiftKey,point=event=>{const rect=timeline.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};},from=point(e),origin=timeline.getBoundingClientRect();
  const nodes=[...timeline.querySelectorAll('[data-region]')],rects=nodes.map(node=>{const b=node.getBoundingClientRect();return {id:node.dataset.region,left:b.left-origin.left,right:b.right-origin.left,top:b.top-origin.top,bottom:b.bottom-origin.top};});
  const hint=root.querySelector('[data-region-selection-status]');if(hint)hint.style.minHeight=hint.getBoundingClientRect().height+'px';
  const box=document.createElement('span');box.className='daw-region-marquee';box.setAttribute('aria-hidden','true');timeline.append(box);timeline.tabIndex=0;timeline.focus({preventScroll:true});timeline.setPointerCapture(e.pointerId);
  let moved=false,ended=false,hit=[],last={clientX:e.clientX,clientY:e.clientY},frame,error='';
  const update=()=>{const to=point(last);if(!moved&&Math.abs(to.x-from.x)+Math.abs(to.y-from.y)<4)return;moved=true;box.style.left=Math.min(from.x,to.x)+'px';box.style.top=Math.min(from.y,to.y)+'px';box.style.width=Math.abs(to.x-from.x)+'px';box.style.height=Math.abs(to.y-from.y)+'px';hit=marqueeRegions(rects,from,to);let chosen;try{chosen=combinedRegionSelection(previous,hit,add);error='';}catch(e){chosen=previous;error=e.message;}const preview=new Set(chosen);for(const node of nodes){const active=preview.has(node.dataset.region);node.classList.toggle('selected',active);node.setAttribute('aria-pressed',String(active));}const status=root.querySelector('[data-region-selection-status]');if(status)status.textContent=error||`${chosen.length} regions selected`;};
  const finish=cancel=>{if(ended)return;ended=true;cancelAnimationFrame(frame);box.remove();timeline.onpointermove=null;timeline.onpointerup=null;timeline.onpointercancel=null;timeline.onlostpointercapture=null;timeline.removeEventListener('keydown',key);if(timeline.hasPointerCapture(e.pointerId))timeline.releasePointerCapture(e.pointerId);if(!timeline.isConnected)return;select(cancel||error?previous:combinedRegionSelection(previous,hit,add),cancel?'':error);};
  const key=event=>{if(event.key==='Escape'){event.preventDefault();finish(true);}};timeline.addEventListener('keydown',key);
  timeline.onpointermove=event=>{last={clientX:event.clientX,clientY:event.clientY};update();};timeline.onpointerup=()=>finish(false);timeline.onpointercancel=()=>finish(true);timeline.onlostpointercapture=()=>finish(true);
  const tick=()=>{if(ended)return;if(!timeline.isConnected){finish(true);return;}if(moved){const bounds=scroll.getBoundingClientRect(),old=scroll.scrollLeft;if(last.clientY>=bounds.top&&last.clientY<=bounds.bottom){if(last.clientX>bounds.right-24)scroll.scrollLeft+=12;else if(last.clientX<bounds.left+24)scroll.scrollLeft-=12;}if(scroll.scrollLeft!==old)update();}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
 };
}
