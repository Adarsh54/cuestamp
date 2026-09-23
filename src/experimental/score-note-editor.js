import {bindScorePitchDrag} from './score-pitch-drag.js';
import {musicxmlRegionPlan,scorePartRegions} from './musicxml.js';
export function scoreNotePlans(session,track,region,scope){
 const parts=scope==='arrangement'?scorePartRegions(session):[{track,region}];
 return parts.map(({track,region})=>({regionId:region.id,notes:musicxmlRegionPlan(session,track,region).notes}));
}
export function resolveScoreNote(part,{pitch,tick,voice}){
 const notes=part.notes.filter(n=>n.pitch===pitch&&n.voice===voice&&n.startTick<=tick&&n.endTick>tick);
 if(notes.length!==1||!notes[0].id)return null;
 return {noteId:notes[0].id,regionId:notes[0].scoreRegionId??part.regionId};
}
export const scoreNoteEditorView=()=>`<form data-score-note-editor hidden><p data-score-note-label></p><div class="button-row"><label>MIDI pitch<input name="pitch" type="number" min="0" max="127" step="1" required></label><label>Start · seconds in region<input name="start" type="number" min="0" step="any" required></label><label>Duration · seconds<input name="duration" type="number" min="0.001" step="any" required></label><label>Velocity<input name="velocity" type="number" min="0" max="1" step="any" required></label><button type="submit">Apply note edit</button><button type="button" data-score-note-close>Cancel</button></div></form>`;
export function bindScoreNotes(panel,renderer,{session,track,region,scope,execute,guard}){
 const plans=scoreNotePlans(session,track,region,scope),form=panel.querySelector('[data-score-note-editor]'),targets=new Map();let selected=null;
 form.hidden=true;
 const select=reference=>{
  const sourceRegion=session.tracks.flatMap(t=>t.regions).find(r=>r.id===reference.regionId),note=sourceRegion?.notes.find(n=>n.id===reference.noteId);if(!note)return;
  selected=note;form.hidden=false;form.querySelector('[data-score-note-label]').textContent=`Edit note in ${sourceRegion.name||'MIDI region'} · changes all tied segments`;
  for(const key of ['pitch','start','duration','velocity'])form.elements.namedItem(key).value=note[key];
  panel.querySelectorAll('[data-score-note]').forEach(el=>{const active=el.dataset.scoreNote===note.id;el.setAttribute('aria-pressed',String(active));el.style.fill=active?'#168544':'';});
 };
 for(const measures of renderer.GraphicSheet.MeasureList){for(const [partIndex,measure] of measures.entries()){
  if(!plans[partIndex])continue;
  for(const entry of measure.staffEntries){for(const voice of entry.graphicalVoiceEntries){for(const graphical of voice.notes){
   const source=graphical.sourceNote;if(!source.Pitch)continue;
   const reference=resolveScoreNote(plans[partIndex],{pitch:source.Pitch.getHalfTone()+12,tick:Math.round(source.getAbsoluteTimestamp().RealValue*4*960),voice:source.ParentVoiceEntry.ParentVoice.VoiceId});
   if(!reference)continue;
   for(const element of graphical.getNoteheadSVGs()||[]){
    const previous=targets.get(element);
    // Some engravings merge unison heads from different voices. Never guess which note to edit.
    if(targets.has(element)&&(!previous||previous.reference.noteId!==reference.noteId))targets.set(element,null);
    else targets.set(element,{reference,pitch:source.Pitch.getHalfTone()+12});
   }
  }}}
 }}
 for(const [element,target] of targets){
  if(!target)continue;const {reference,pitch}=target;
  element.dataset.scoreNote=reference.noteId;element.setAttribute('role','button');element.setAttribute('tabindex','0');element.setAttribute('aria-label',`Edit MIDI note ${pitch}`);element.style.cursor='pointer';
  bindScorePitchDrag(element,{session,reference,zoom:renderer.Zoom,execute,guard,onSelect:()=>select(reference)});
 }
 form.onsubmit=guard(e=>{e.preventDefault();if(!selected)throw Error('Select a score note first.');const values=Object.fromEntries(['pitch','start','duration','velocity'].map(key=>[key,Number(form.elements.namedItem(key).value)]));execute([{op:'note.set',target:selected.id,values}],'Edited score note');});
 form.querySelector('[data-score-note-close]').onclick=()=>{form.hidden=true;selected=null;panel.querySelectorAll('[data-score-note]').forEach(el=>{el.style.fill='';el.setAttribute('aria-pressed','false');});};
}
