// Cache the visible bar, keeping transport ticks independent of note edits.
const positions=new WeakMap();
export function updateDrumStepPosition(root,time){
 if(!root)return;
 const panel=root.querySelector('.daw-sequencer');
 let state=positions.get(root);
 if(!state||state.panel!==panel){
  state={panel,cells:[...(panel?.querySelectorAll('[data-step-start]')||[])].map(element=>({element,start:Number(element.dataset.stepStart),end:Number(element.dataset.stepEnd)})),active:new Set()};
  positions.set(root,state);
 }
 const active=new Set(Number.isFinite(time)?state.cells.filter(cell=>time>=cell.start&&time<cell.end).map(cell=>cell.element):[]);
 for(const element of state.active)if(!active.has(element))element.removeAttribute('data-step-current');
 for(const element of active)if(!state.active.has(element))element.setAttribute('data-step-current','true');
 state.active=active;
}
