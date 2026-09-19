import {z} from 'zod';
import {selectedMidiNotes} from './note-selection.js';
const options=z.object({pivot:z.number().min(0).max(127).refine(n=>Number.isInteger(n*2),'Pivot must be a whole or half semitone.'),noteId:z.string().optional(),noteIds:z.string().max(2020000).optional()}).strict();
export function invertNoteEdits(region,values){
 const v=options.parse(values),notes=selectedMidiNotes(region,v);
 if(!notes.length)throw Error('Add or select notes to invert.');
 return notes.map(n=>{const pitch=2*v.pivot-n.pitch;if(pitch<0||pitch>127)throw Error('Inverted pitches must stay within MIDI 0–127. Choose a different pivot.');return {id:n.id,pitch};});
}
const state=settings=>settings.invertTools??={scope:'region',pivot:60};
export function invertNotesView(settings){const s=state(settings);return `<details class="daw-invert-tools"><summary>Invert note pitches</summary><form data-invert-form class="button-row"><label>Apply to<select name="scope"><option value="region" ${s.scope==='region'?'selected':''}>All notes in region</option><option value="selected" ${s.scope==='selected'?'selected':''}>Selected notes</option></select></label><label>Pivot · MIDI pitch<input name="pivot" type="number" min="0" max="127" step=".5" value="${Number.isFinite(s.pivot)?s.pivot:''}" required></label><button type="button" data-invert-center>Use pitch-range center</button><button type="submit">Invert pitches</button></form><output data-invert-preview></output><p class="muted">Reflects pitches around the pivot: with pivot 60, 64 becomes 56. Half-step pivots lie between notes. Timing, velocity and controllers stay unchanged. This is melodic inversion, not chord-voicing inversion; drum pitches change which drum plays.</p></details>`;}
export function bindInvertNotes(root,{region,settings,execute,guard}){
 const form=root.querySelector('[data-invert-form]');if(!form)return;const s=state(settings),button=form.querySelector('[type=submit]');
 const selection=()=>s.scope==='selected'?{noteIds:(settings.selectedIds||[]).join(',')}:{};
 const update=()=>{s.scope=form.elements.scope.value;s.pivot=form.elements.pivot.valueAsNumber;try{const edits=invertNoteEdits(region,{pivot:s.pivot,...selection()}),original=new Map(region.notes.map(n=>[n.id,n.pitch])),changed=edits.filter(e=>e.pitch!==original.get(e.id)).length;root.querySelector('[data-invert-preview]').textContent=`${changed} of ${edits.length} notes will change pitch · resulting range ${Math.min(...edits.map(e=>e.pitch))}–${Math.max(...edits.map(e=>e.pitch))}.`;button.disabled=!changed;}catch(e){root.querySelector('[data-invert-preview]').textContent=e.message;button.disabled=true;}};
 form.oninput=update;form.onchange=update;
 form.querySelector('[data-invert-center]').onclick=guard(()=>{s.scope=form.elements.scope.value;const notes=selectedMidiNotes(region,selection());if(!notes.length)throw Error('Add or select notes first.');form.elements.pivot.value=(Math.min(...notes.map(n=>n.pitch))+Math.max(...notes.map(n=>n.pitch)))/2;update();});
 form.onsubmit=guard(e=>{e.preventDefault();update();if(!button.disabled)execute([{op:'notes.invert',target:region.id,values:{pivot:s.pivot,...selection()}}],'Inverted MIDI pitches');});update();
}
