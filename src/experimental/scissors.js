export function scissorsCut(session,clickedId,selection,time,{snap=true}={}){
 if(!Number.isFinite(time)||time<0||time>86400)throw Error('Choose a cut position within the timeline.');
 const step=60/session.tempo/4,at=snap?Math.min(86400,Math.round(time/step)*step):time;
 const ids=selection.includes(clickedId)?[...selection]:[clickedId],all=new Map(session.tracks.flatMap(t=>t.regions.map(r=>[r.id,r])));
 if(!ids.length||ids.length>1000||new Set(ids).size!==ids.length||ids.some(id=>!all.has(id)))throw Error('Select up to 1,000 existing regions.');
 const count=ids.filter(id=>{const r=all.get(id);return r.start<at&&r.start+r.duration>at;}).length;
 return {time:at,regionIds:ids,count};
}
export function bindScissors(root,{session,zoom,selection,split,select,guard,blocked}){
 const timeline=root.querySelector('.daw-timeline');
 root.querySelectorAll('[data-region]').forEach(el=>{
  let active=false,preview=null,plan=null,pointerId;
  const remove=()=>{preview?.remove();preview=null;};
  const update=e=>{
   const time=Math.max(0,Math.min(86400,(e.clientX-timeline.getBoundingClientRect().left)/zoom));
   try{plan=scissorsCut(session,el.dataset.region,selection,time,{snap:!e.shiftKey});}catch(error){plan={time,count:0,regionIds:[],error:error.message};}
   if(!preview){preview=document.createElement('span');preview.className='daw-scissors-line';preview.setAttribute('aria-hidden','true');const label=document.createElement('span');preview.append(label);timeline.append(preview);}
   preview.style.left=plan.time*zoom+'px';preview.dataset.valid=String(plan.count>0);
   preview.firstChild.textContent=plan.error||`${plan.time.toFixed(3)} s · ${plan.count?`Split ${plan.count} region${plan.count===1?'':'s'}`:'No region crosses this point'}`;
  };
  const finish=cancel=>{if(!active)return;active=false;el.removeEventListener('keydown',key);remove();if(el.hasPointerCapture(pointerId))el.releasePointerCapture(pointerId);if(cancel||!el.isConnected)return;if(!plan?.count)throw Error(plan?.error||'Choose a cut point inside a region. Hold Shift to cut without snapping.');split(plan.regionIds,plan.time,session.revision);};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(true);}};
  el.onclick=e=>{if(e.detail===0)select(el.dataset.region,e);};el.ondblclick=null;
  el.onpointermove=e=>{if(!blocked())update(e);};el.onpointerleave=()=>{if(!active)remove();};
  el.onpointerdown=e=>{
   if(e.button!==0||blocked())return;e.preventDefault();e.stopPropagation();
   if(e.ctrlKey||e.metaKey){remove();select(el.dataset.region,e);return;}
   active=true;pointerId=e.pointerId;el.focus({preventScroll:true});update(e);el.setPointerCapture(pointerId);el.addEventListener('keydown',key);
  };
  el.onpointerup=guard(e=>{if(!active)return;update(e);finish(false);});el.onpointercancel=()=>finish(true);el.onlostpointercapture=()=>finish(true);
 });
}
