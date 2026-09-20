import {selectedMidiNotes} from './note-selection.js';
import {regionBeatTiming} from './tempo-map.js';
import {musicalNoteShift} from './musical-note-shift.js';

export function notePhraseBeats(region,session,notes){
 if(!notes.length)throw Error('Select notes to repeat.');
 const clock=regionBeatTiming(region,session);
 return clock.beatAtTime(Math.max(...notes.map(n=>n.start+n.duration)))-clock.beatAtTime(Math.min(...notes.map(n=>n.start)));
}
export function repeatNotesPlan(region,session,values){
 const {count,beats,seconds,extend=false}=values;
 if(!Number.isInteger(count)||count<1||count>100)throw Error('Choose 1–100 additional copies.');
 if(typeof extend!=='boolean')throw Error('Extend region must be true or false.');
 if(beats!==undefined&&seconds!==undefined)throw Error('Choose repeat spacing in beats or seconds, not both.');
 const notes=selectedMidiNotes(region,values);
 if(!notes.length)throw Error('Select notes to repeat.');
 if(region.notes.length+count*notes.length>20000)throw Error('Repeating would exceed the 20,000-note region limit.');
 const musical=seconds===undefined,spacing=musical?(beats??notePhraseBeats(region,session,notes)):seconds;
 if(!Number.isFinite(spacing)||spacing<=0||spacing>(musical?432000:86400))throw Error('Choose positive repeat spacing within the timeline.');
 const bounds={...region,duration:extend?86400-region.start:region.duration},copies=[];
 for(let i=1;i<=count;i++){
  const shifted=musical?musicalNoteShift(bounds,session,notes,spacing*i):notes.map(n=>({...n,start:n.start+spacing*i}));
  for(const n of shifted){
   if(!Number.isFinite(n.start)||n.start+n.duration>bounds.duration+1e-9)throw Error('Repeated notes do not fit. Enable Extend region or use fewer copies.');
   copies.push({...n,id:crypto.randomUUID()});
  }
 }
 const duration=extend?Math.max(region.duration,...copies.map(n=>n.start+n.duration)):region.duration;
 if(region.start+duration>86400)throw Error('Repeated notes exceed the 24-hour timeline.');
 return {notes:copies,duration};
}
export function repeatNotesView(region,session,settings){
 const notes=region.notes.filter(n=>(settings.selectedIds||[]).includes(n.id)),span=notes.length?notePhraseBeats(region,session,notes):1;
 return `<details class="daw-note-tools"><summary>Repeat selected notes</summary><form class="button-row" data-note-repeat><label>Additional copies<input name="count" type="number" min="1" max="100" step="1" required value="1"></label><label>Spacing · beats<input name="beats" type="number" min="0.000001" max="432000" step="any" required value="${span}"></label><label><input name="extend" type="checkbox"> Extend region to fit</label><button type="submit" ${notes.length?'':'disabled'}>Repeat notes</button></form><p class="muted">Copies the selected phrase at each beat interval, following tempo changes. Originals stay in place. Controller events are unchanged.</p></details>`;
}
export function bindRepeatNotes(root,{region,settings,execute,guard}){
 const form=root.querySelector('[data-note-repeat]');if(!form)return;
 form.onsubmit=guard(e=>{e.preventDefault();execute([{op:'notes.repeat',target:region.id,values:{noteIds:(settings.selectedIds||[]).join(','),count:Number(form.elements.count.value),beats:Number(form.elements.beats.value),extend:form.elements.extend.checked}}],'Repeated selected notes');});
}
