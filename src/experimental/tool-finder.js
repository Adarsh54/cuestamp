const bindings=new WeakMap();
export function filterTools(entries,query){const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);return entries.filter(entry=>words.every(word=>`${entry.title} ${entry.context} ${entry.keywords}`.toLowerCase().includes(word))).sort((a,b)=>{const q=query.trim().toLowerCase();return Number(b.title.toLowerCase().startsWith(q))-Number(a.title.toLowerCase().startsWith(q))||a.title.localeCompare(b.title);});}
export function collectTools(root){
 const entries=[],seen=new Set();
 for(const element of root.querySelectorAll('details > summary,form > h4,.daw-toolbar [data-action],.daw-toolbar .daw-import')){
  const target=element.matches('summary')?element.parentElement:element.matches('h4')?element.parentElement:element;
  if(seen.has(target))continue;seen.add(target);
  const title=element.textContent.trim();if(!title||element.disabled)continue;
  const section=element.closest('.daw-piano,.daw-inspector,.daw-mixer,.daw-toolbar'),context=section?.matches('.daw-piano')?'Piano roll':section?.matches('.daw-toolbar')?'Session toolbar':section?.querySelector('h3')?.textContent.trim()||'Workspace';
  const keywords=Array.from(target.querySelectorAll('label,button')).slice(0,30).map(el=>el.textContent.trim()).join(' ').slice(0,1600);
  entries.push({title,context,keywords,target,focus:element.matches('summary')?element:target.querySelector('input:not([type=hidden]),select,button')||element});
 }
 return entries;
}
export function bindToolFinder(root){
 bindings.get(root)?.();const doc=root.ownerDocument,trigger=root.querySelector('[data-find-tool]');let dialog=null,returnFocus=null;
 const close=restore=>{if(!dialog)return;const current=dialog;dialog=null;current.close();current.remove();if(restore&&returnFocus?.isConnected)returnFocus.focus();};
 const open=()=>{if(dialog||doc.querySelector('dialog[open],[aria-modal=true]'))return;returnFocus=doc.activeElement;const entries=collectTools(root);dialog=doc.createElement('dialog');dialog.className='daw-tool-finder';dialog.setAttribute('aria-label','Find a workspace tool');dialog.innerHTML='<form method="dialog"><h2>Find tool</h2><button type="button" data-finder-close aria-label="Close tool search">Close</button></form><label>Search tools<input type="search" data-finder-query placeholder="Quantize, effects, export…" autocomplete="off"></label><p data-finder-count aria-live="polite"></p><div data-finder-results></div><small>Opens a control or panel. Your project is unchanged until you apply an edit.</small>';doc.body.append(dialog);
  const query=dialog.querySelector('[data-finder-query]'),results=dialog.querySelector('[data-finder-results]'),count=dialog.querySelector('[data-finder-count]');
  const choose=entry=>{if(!entry.target.isConnected){close(true);return;}close(false);for(let node=entry.target;node&&node!==root;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;entry.target.scrollIntoView({block:'center',behavior:'auto'});entry.focus.focus({preventScroll:true});entry.target.classList.add('daw-tool-found');entry.target.addEventListener('animationend',()=>entry.target.classList.remove('daw-tool-found'),{once:true});};
  const render=()=>{const matches=filterTools(entries,query.value);results.replaceChildren();count.textContent=matches.length?`${matches.length} tools available`:'No matching tools. Select a track or region to see its editing tools.';for(const entry of matches){const button=doc.createElement('button');button.type='button';const name=doc.createElement('span'),context=doc.createElement('small');name.textContent=entry.title;context.textContent=entry.context;button.append(name,context);button.onclick=()=>choose(entry);results.append(button);}};
  query.oninput=render;dialog.querySelector('[data-finder-close]').onclick=()=>close(true);dialog.addEventListener('cancel',event=>{event.preventDefault();close(true);});dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close(true);return;}const buttons=[...results.querySelectorAll('button')],index=buttons.indexOf(doc.activeElement);if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const next=index<0?(event.key==='ArrowDown'?0:buttons.length-1):(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();}else if(event.key==='Enter'&&event.target===query){event.preventDefault();buttons[0]?.click();}});render();dialog.showModal();query.focus();
 };
 const key=event=>{if((event.ctrlKey||event.metaKey)&&!event.altKey&&!event.shiftKey&&event.key.toLowerCase()==='k'&&!event.isComposing&&!event.defaultPrevented){event.preventDefault();if(!event.repeat)open();}};
 trigger?.addEventListener('click',open);root.addEventListener('keydown',key);const dispose=()=>{close(false);trigger?.removeEventListener('click',open);root.removeEventListener('keydown',key);bindings.delete(root);};bindings.set(root,dispose);return dispose;
}
export function disposeToolFinder(root){bindings.get(root)?.();}
