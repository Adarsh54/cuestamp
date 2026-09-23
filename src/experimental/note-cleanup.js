import {articulationIdentity} from './articulation-identity.js';
import {z} from 'zod';
import {selectedMidiNotes} from './note-selection.js';
const options=z.object({match:z.enum(['onset','identical']).default('onset'),keep:z.enum(['first','longest','loudest']).default('first'),noteId:z.string().optional(),noteIds:z.string().max(2020000).optional()}).strict();
export function duplicateNotePlan(region,values={}){
 const v=options.parse(values),chosen=selectedMidiNotes(region,v);if(!chosen.length)throw Error('Add or select notes to clean up.');
 const selected=new Set(chosen.map(n=>n.id)),groups=new Map();
 for(const n of region.notes){if(!selected.has(n.id))continue;const key=JSON.stringify([n.channel??0,n.pitch,n.start,articulationIdentity(n.articulation),...(v.match==='identical'?[n.duration,n.velocity,Boolean(n.mute)]:[])]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n);}
 const removedIds=[],keptIds=[];
 for(const notes of groups.values()){if(notes.length<2)continue;let winner=notes[0];for(const n of notes.slice(1))if(v.keep==='longest'&&n.duration>winner.duration||v.keep==='loudest'&&n.velocity>winner.velocity)winner=n;keptIds.push(winner.id);removedIds.push(...notes.filter(n=>n!==winner).map(n=>n.id));}
 return {removedIds,keptIds,examined:chosen.length};
}
const state=settings=>settings.cleanupTools??={scope:'region',match:'onset',keep:'first'};
export function cleanupNotesView(settings){const s=state(settings);return `<details class="daw-note-cleanup"><summary>Remove duplicate notes</summary><form data-cleanup-form class="button-row"><label>Compare<select name="scope"><option value="region" ${s.scope==='region'?'selected':''}>All notes in region</option><option value="selected" ${s.scope==='selected'?'selected':''}>Selected notes only</option></select></label><label>Match<select name="match"><option value="onset" ${s.match==='onset'?'selected':''}>Same pitch, channel and start</option><option value="identical" ${s.match==='identical'?'selected':''}>Identical performance values</option></select></label><label>Keep<select name="keep">${[['first','First in region order'],['longest','Longest note'],['loudest','Highest velocity']].map(([v,label])=>`<option value="${v}" ${s.keep===v?'selected':''}>${label}</option>`).join('')}</select></label><button type="submit">Remove duplicates</button></form><output data-cleanup-preview></output><p class="muted">Different articulation mappings are kept in both comparison modes. Only exact start times match; nearby notes are kept. Identical values also require equal length, velocity and mute state. The retained note keeps all its values, including mute. Ties keep the first note in region order. Selected-only mode compares selected notes with each other. Controller events stay unchanged. Undo restores removed notes.</p></details>`;}
export function bindCleanupNotes(root,{region,settings,execute,guard}){
 const form=root.querySelector('[data-cleanup-form]');if(!form)return;const s=state(settings),button=form.querySelector('button');
 const values=()=>({match:s.match,keep:s.keep,...(s.scope==='selected'?{noteIds:(settings.selectedIds||[]).join(',')}:{})});
 const update=()=>{for(const key of ['scope','match','keep'])s[key]=form.elements[key].value;try{const plan=duplicateNotePlan(region,values());root.querySelector('[data-cleanup-preview]').textContent=`${plan.removedIds.length} duplicate notes will be removed from ${plan.examined} notes; ${plan.keptIds.length} duplicate groups retain one note each.`;button.disabled=!plan.removedIds.length;}catch(e){root.querySelector('[data-cleanup-preview]').textContent=e.message;button.disabled=true;}};
 form.onchange=update;form.onsubmit=guard(e=>{e.preventDefault();update();if(!button.disabled)execute([{op:'notes.removeDuplicates',target:region.id,values:values()}],'Removed duplicate MIDI notes');});update();
}
