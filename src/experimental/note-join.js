import {z} from 'zod';
import {selectedMidiNotes} from './note-selection.js';
const options=z.object({gap:z.number().finite().min(0).max(10).default(0),velocity:z.enum(['first','highest','average']).default('first'),noteId:z.string().optional(),noteIds:z.string().max(2020000).optional()}).strict();
export function joinNotesPlan(region,values={}){
 const v=options.parse(values),chosen=selectedMidiNotes(region,v);if(!chosen.length)throw Error('Add or select notes to join.');
 const buckets=new Map();for(const n of chosen){const key=JSON.stringify([n.pitch,n.channel??0,Boolean(n.mute)]);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(n);}
 const changes=[],removedIds=[];
 for(const notes of buckets.values()){
  notes.sort((a,b)=>a.start-b.start);let group=[],end=0;
  const flush=()=>{if(group.length<2)return;const first=group[0],duration=end-first.start;if(duration>3600)throw Error('Joined notes cannot exceed 3,600 seconds.');const velocity=v.velocity==='highest'?Math.max(...group.map(n=>n.velocity)):v.velocity==='average'?group.reduce((sum,n)=>sum+n.velocity,0)/group.length:first.velocity;changes.push({id:first.id,duration,velocity});removedIds.push(...group.slice(1).map(n=>n.id));};
  for(const n of notes){if(group.length&&n.start>end+v.gap){flush();group=[];}if(!group.length)end=n.start+n.duration;else end=Math.max(end,n.start+n.duration);group.push(n);}flush();
 }
 return {changes,removedIds,examined:chosen.length};
}
const state=settings=>settings.joinTools??={scope:'region',gap:0,velocity:'first'};
export function joinNotesView(settings){const s=state(settings);return `<details class="daw-note-join"><summary>Join note fragments</summary><form data-note-join-form class="button-row"><label>Join<select name="scope"><option value="region" ${s.scope==='region'?'selected':''}>All notes in region</option><option value="selected" ${s.scope==='selected'?'selected':''}>Selected notes only</option></select></label><label>Maximum gap · ms<input name="gap" type="number" min="0" max="10000" step="1" value="${s.gap}"></label><label>Velocity<select name="velocity">${[['first','First note'],['highest','Highest velocity'],['average','Average velocity']].map(([v,label])=>`<option value="${v}" ${s.velocity===v?'selected':''}>${label}</option>`).join('')}</select></label><button type="submit">Join notes</button></form><output data-note-join-preview></output><p class="muted">Join touching or overlapping notes of the same pitch, channel and mute state. Increase the gap to fill short silences. Each group becomes one sustained note without repeated attacks. The earliest note keeps its identity. Selected-only mode joins selected notes with each other. Controller events stay unchanged. Undo restores the fragments.</p></details>`;}
export function bindJoinNotes(root,{region,settings,execute,guard}){
 const form=root.querySelector('[data-note-join-form]');if(!form)return;const s=state(settings),button=form.querySelector('button');
 const values=()=>({gap:s.gap/1000,velocity:s.velocity,...(s.scope==='selected'?{noteIds:(settings.selectedIds||[]).join(',')}:{})});
 const update=()=>{s.scope=form.elements.scope.value;s.gap=form.elements.gap.valueAsNumber;s.velocity=form.elements.velocity.value;try{const plan=joinNotesPlan(region,values());root.querySelector('[data-note-join-preview]').textContent=`${plan.changes.length} sustained ${plan.changes.length===1?'note':'notes'} will replace ${plan.changes.length+plan.removedIds.length} fragments.`;button.disabled=!plan.changes.length;}catch(e){root.querySelector('[data-note-join-preview]').textContent=e.message;button.disabled=true;}};
 form.oninput=update;form.onchange=update;form.onsubmit=guard(e=>{e.preventDefault();update();if(!button.disabled)execute([{op:'notes.join',target:region.id,values:values()}],'Joined MIDI note fragments');});update();
}
