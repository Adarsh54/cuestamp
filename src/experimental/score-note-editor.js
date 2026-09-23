import {scoreTransposition} from './score-transposition.js';
import {compileTempoMap} from './tempo-map.js';
import {scoreNoteAction} from './score-note-actions.js';
import {scoreRestDraft} from './score-rest-insert.js';
import {scoreRhythmDuration,identifyScoreRhythm,scoreRhythmView} from './score-rhythm.js';
import {bindScorePitchDrag} from './score-pitch-drag.js';
import {musicxmlRegionPlan,scorePartRegions} from './musicxml.js';
export function scoreNotePlans(session,track,region,scope){
 const parts=scope==='arrangement'?scorePartRegions(session):[{track,region}];
 return parts.map(({track,region})=>({transposition:scoreTransposition(track),trackId:track.id,regionId:region.id,notes:musicxmlRegionPlan(session,track,region).notes}));
}
export function resolveScoreNote(part,{pitch,tick,voice}){
 const notes=part.notes.filter(n=>n.pitch===pitch&&n.voice===voice&&n.startTick<=tick&&n.endTick>tick);
 if(notes.length!==1||!notes[0].id)return null;
 return {noteId:notes[0].id,regionId:notes[0].scoreRegionId??part.regionId};
}
export const scoreNoteEditorView=()=>`<form data-score-note-editor hidden><p data-score-note-label></p>${scoreRhythmView()}<div class="button-row"><label>Sounding MIDI pitch<input name="pitch" type="number" min="0" max="127" step="1" required></label><label>Start · seconds in region<input name="start" type="number" min="0" step="any" required></label><label>Duration · seconds<input name="duration" type="number" min="0.001" step="any" required></label><label>Velocity<input name="velocity" type="number" min="0" max="1" step="any" required></label><button type="submit">Apply note edit</button><button type="button" data-score-note-duplicate>Duplicate after</button><button type="button" data-score-note-delete>Delete note</button><button type="button" data-score-note-close>Cancel</button></div></form>`;
export function bindScoreNotes(panel,renderer,{session,track,region,scope,execute,guard}){
 const tempo=compileTempoMap(session),origin=scope==='arrangement'?0:tempo.beatAtTime(region.start);
 const plans=scoreNotePlans(session,track,region,scope),form=panel.querySelector('[data-score-note-editor]'),targets=new Map();let selected=null,selectedRegion=null;
 form.hidden=true;delete panel.dataset.selectedScoreNote;delete panel.dataset.selectedScoreRegion;
 const select=reference=>{
  const sourceRegion=session.tracks.flatMap(t=>t.regions).find(r=>r.id===reference.regionId),note=reference.note??sourceRegion?.notes.find(n=>n.id===reference.noteId);if(!note)return;
  if(note.id){panel.dataset.selectedScoreNote=note.id;panel.dataset.selectedScoreRegion=sourceRegion.id;}else{delete panel.dataset.selectedScoreNote;delete panel.dataset.selectedScoreRegion;}
  selected=note;selectedRegion=sourceRegion;const rhythm=identifyScoreRhythm(session,sourceRegion,note);form.elements.namedItem('scoreLength').value=rhythm.length;form.elements.namedItem('scoreRhythm').value=rhythm.variant;form.elements.namedItem('scoreRhythm').disabled=rhythm.length==='custom';form.querySelector('[data-score-rhythm-status]').textContent='';form.hidden=false;form.querySelector('[data-score-note-label]').textContent=reference.note?`Add note to ${sourceRegion.name||'MIDI region'}`:`Edit note in ${sourceRegion.name||'MIDI region'} · changes all tied segments`;form.querySelector('[type=submit]').textContent=reference.note?'Add note':'Apply note edit';
  for(const action of ['duplicate','delete'])form.querySelector(`[data-score-note-${action}]`).hidden=!note.id;
  for(const key of ['pitch','start','duration','velocity'])form.elements.namedItem(key).value=note[key];
  panel.querySelectorAll('[data-score-note]').forEach(el=>{const active=el.dataset.scoreNote===note.id;el.setAttribute('aria-pressed',String(active));el.style.fill=active?'#168544':'';});
 };
 for(const measures of renderer.GraphicSheet.MeasureList){for(const [partIndex,measure] of measures.entries()){
  if(!plans[partIndex])continue;
  for(const entry of measure.staffEntries){for(const voice of entry.graphicalVoiceEntries){for(const graphical of voice.notes){
   const source=graphical.sourceNote;
   const beat=source.getAbsoluteTimestamp().RealValue*4,length=graphical.graphicalNoteLength.RealValue*4;
   for(const element of graphical.getNoteheadSVGs()||[]){element.dataset.scoreStart=String(tempo.timeAtBeat(origin+beat));element.dataset.scoreEnd=String(tempo.timeAtBeat(origin+beat+length));}
   if(!source.Pitch){
    const draft=scoreRestDraft(session,{...plans[partIndex],scope,beat:source.getAbsoluteTimestamp().RealValue*4,beats:source.Length.RealValue*4});
    if(draft)for(const element of graphical.getNoteheadSVGs()||[]){element.dataset.scoreRest=draft.regionId;element.setAttribute('role','button');element.setAttribute('tabindex','0');element.setAttribute('aria-label','Add note at this rest');element.style.cursor='pointer';element.onclick=e=>{e.stopPropagation();select(draft);};element.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();select(draft);}};}
    continue;
   }
   const reference=resolveScoreNote(plans[partIndex],{pitch:source.Pitch.getHalfTone()+12-plans[partIndex].transposition.semitones,tick:Math.round(source.getAbsoluteTimestamp().RealValue*4*960),voice:source.ParentVoiceEntry.ParentVoice.VoiceId});
   if(!reference)continue;
   for(const element of graphical.getNoteheadSVGs()||[]){
    const previous=targets.get(element);
    // Some engravings merge unison heads from different voices. Never guess which note to edit.
    if(targets.has(element)&&(!previous||previous.reference.noteId!==reference.noteId))targets.set(element,null);
    else targets.set(element,{reference,pitch:source.Pitch.getHalfTone()+12-plans[partIndex].transposition.semitones});
   }
  }}}
 }}
 for(const [element,target] of targets){
  if(!target)continue;const {reference,pitch}=target;
  element.dataset.scoreNote=reference.noteId;element.setAttribute('role','button');element.setAttribute('tabindex','0');element.setAttribute('aria-label',`Edit MIDI note ${pitch}`);element.style.cursor='pointer';
  bindScorePitchDrag(element,{session,reference,zoom:renderer.Zoom,execute,guard,onSelect:()=>select(reference)});
 }
 const length=form.elements.namedItem('scoreLength'),rhythm=form.elements.namedItem('scoreRhythm'),duration=form.elements.namedItem('duration'),start=form.elements.namedItem('start'),rhythmStatus=form.querySelector('[data-score-rhythm-status]');
 const updateRhythm=()=>{rhythm.disabled=length.value==='custom';rhythmStatus.textContent='';if(!selected||length.value==='custom')return;try{duration.value=scoreRhythmDuration(session,selectedRegion,Number(start.value),length.value,rhythm.value);rhythmStatus.textContent='Length follows the project tempo at this note.';}catch(error){rhythmStatus.textContent=error.message;}};
 length.onchange=updateRhythm;rhythm.onchange=updateRhythm;start.oninput=updateRhythm;duration.oninput=()=>{length.value='custom';rhythm.disabled=true;rhythmStatus.textContent='';};
 form.onsubmit=guard(e=>{e.preventDefault();if(!selected)throw Error('Select a score note first.');const values=Object.fromEntries(['pitch','start','duration','velocity'].map(key=>[key,Number(form.elements.namedItem(key).value)]));if(length.value!=='custom')values.duration=scoreRhythmDuration(session,selectedRegion,values.start,length.value,rhythm.value);execute([{op:selected.id?'note.set':'note.add',target:selected.id??selectedRegion.id,values}],selected.id?'Edited score note':'Added score note');});
 for(const action of ['duplicate','delete'])form.querySelector(`[data-score-note-${action}]`).onclick=guard(()=>execute([scoreNoteAction(session,selectedRegion,selected,action)],action==='delete'?'Deleted score note':'Duplicated score note'));
 form.querySelector('[data-score-note-close]').onclick=()=>{form.hidden=true;selected=null;delete panel.dataset.selectedScoreNote;delete panel.dataset.selectedScoreRegion;panel.querySelectorAll('[data-score-note]').forEach(el=>{el.style.fill='';el.setAttribute('aria-pressed','false');});};
}
