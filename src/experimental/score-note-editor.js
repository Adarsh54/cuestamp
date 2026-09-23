import {scoreSelectionToolsView,bindScoreSelectionTools} from './score-selection-tools.js';
import {scoreChordDraft,scoreChordCommand} from './score-chord.js';
import {scoreTransposition} from './score-transposition.js';
import {compileTempoMap} from './tempo-map.js';
import {scoreNoteGroupAction} from './score-note-actions.js';
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
export const scoreNoteEditorView=()=>`<form data-score-note-editor hidden><p data-score-note-label></p>${scoreRhythmView()}<div class="button-row"><label>Sounding MIDI pitch<input name="pitch" type="number" min="0" max="127" step="1" required></label><label>Start · seconds in region<input name="start" type="number" min="0" step="any" required></label><label>Duration · seconds<input name="duration" type="number" min="0.001" step="any" required></label><label>Velocity<input name="velocity" type="number" min="0" max="1" step="any" required></label><button type="submit">Apply note edit</button><button type="button" data-score-note-chord>Add chord tone</button><button type="button" data-score-note-duplicate>Duplicate after</button><button type="button" data-score-note-delete>Delete note</button><button type="button" data-score-note-close>Cancel</button></div>${scoreSelectionToolsView()}</form>`;
// OSMD returns all chord heads for each graphical note; VexFlow's index identifies its own head.
export function scoreNoteheads(graphical){
 const heads=graphical.getNoteheadSVGs()||[];
 if(heads.length<=1)return heads;
 const index=graphical.vfnoteIndex;
 return Number.isInteger(index)&&heads[index]?[heads[index]]:[];
}
export function bindScoreNotes(panel,renderer,{session,track,region,scope,execute,guard}){
 const tempo=compileTempoMap(session),origin=scope==='arrangement'?0:tempo.beatAtTime(region.start);
 const plans=scoreNotePlans(session,track,region,scope),form=panel.querySelector('[data-score-note-editor]'),targets=new Map();let selected=null,selectedRegion=null,chordDraft=false,selectedIds=new Set();
 form.hidden=true;delete panel.dataset.selectedScoreNote;delete panel.dataset.selectedScoreRegion;delete panel.dataset.selectedScoreNotes;
 const select=(reference,extend=false,preserve=false)=>{
  const sourceRegion=session.tracks.flatMap(t=>t.regions).find(r=>r.id===reference.regionId),note=reference.note??sourceRegion?.notes.find(n=>n.id===reference.noteId);if(!note)return;
  if(!extend||selectedRegion?.id!==sourceRegion.id||!note.id)selectedIds.clear();
  if(note.id&&!preserve){if(extend&&selectedIds.has(note.id))selectedIds.delete(note.id);else selectedIds.add(note.id);}
  if(note.id&&!selectedIds.size){form.querySelector('[data-score-note-close]').click();return;}
  if(note.id&&!selectedIds.has(note.id)){select({regionId:sourceRegion.id,noteId:[...selectedIds][0]},true,true);return;}
  if(note.id){panel.dataset.selectedScoreNotes=JSON.stringify([...selectedIds]);panel.dataset.selectedScoreNote=note.id;panel.dataset.selectedScoreRegion=sourceRegion.id;}else{delete panel.dataset.selectedScoreNote;delete panel.dataset.selectedScoreRegion;delete panel.dataset.selectedScoreNotes;}
  selected=note;selectedRegion=sourceRegion;chordDraft=Boolean(reference.chord);const rhythm=identifyScoreRhythm(session,sourceRegion,note);form.elements.namedItem('scoreLength').value=rhythm.length;form.elements.namedItem('scoreRhythm').value=rhythm.variant;form.elements.namedItem('scoreRhythm').disabled=rhythm.length==='custom';form.querySelector('[data-score-rhythm-status]').textContent='';form.hidden=false;form.querySelector('[data-score-note-label]').textContent=reference.chord?`Add chord tone in ${sourceRegion.name||'MIDI region'}`:reference.note?`Add note to ${sourceRegion.name||'MIDI region'}`:`Edit note in ${sourceRegion.name||'MIDI region'} · changes all tied segments`;form.querySelector('[type=submit]').textContent=reference.chord?'Add chord tone':reference.note?'Add note':'Apply note edit';
  for(const action of ['duplicate','delete','chord'])form.querySelector(`[data-score-note-${action}]`).hidden=!note.id;
  const multiple=selectedIds.size>1;
  if(multiple)form.querySelector('[data-score-note-label]').textContent=`${selectedIds.size} notes selected in ${sourceRegion.name||'MIDI region'}`;
  for(const input of form.querySelectorAll('input,select'))if(!input.closest('[data-score-selection-tools]'))input.closest('label').hidden=multiple;
  form.querySelector('[data-score-selection-tools]').hidden=!multiple;
  form.querySelector('[type=submit]').hidden=multiple;form.querySelector('[data-score-note-chord]').hidden=multiple||!note.id;
  form.querySelector('[data-score-note-delete]').textContent=multiple?'Delete selected notes':'Delete note';
  form.querySelector('[data-score-note-duplicate]').textContent=multiple?'Duplicate selection after':'Duplicate after';
  for(const key of ['pitch','start','duration','velocity'])form.elements.namedItem(key).value=note[key];
  panel.querySelectorAll('[data-score-note]').forEach(el=>{const active=selectedIds.has(el.dataset.scoreNote);el.setAttribute('aria-pressed',String(active));el.style.fill=active?'#168544':'';});
 };
 for(const measures of renderer.GraphicSheet.MeasureList){for(const [partIndex,measure] of measures.entries()){
  if(!measure||!plans[partIndex])continue;
  for(const entry of measure.staffEntries){for(const voice of entry.graphicalVoiceEntries){for(const graphical of voice.notes){
   const source=graphical.sourceNote;
   const beat=source.getAbsoluteTimestamp().RealValue*4,length=graphical.graphicalNoteLength.RealValue*4;
   for(const element of scoreNoteheads(graphical)){element.dataset.scoreStart=String(tempo.timeAtBeat(origin+beat));element.dataset.scoreEnd=String(tempo.timeAtBeat(origin+beat+length));}
   if(!source.Pitch){
    const draft=scoreRestDraft(session,{...plans[partIndex],scope,beat:source.getAbsoluteTimestamp().RealValue*4,beats:source.Length.RealValue*4});
    if(draft)for(const element of scoreNoteheads(graphical)){element.dataset.scoreRest=draft.regionId;element.setAttribute('role','button');element.setAttribute('tabindex','0');element.setAttribute('aria-label','Add note at this rest');element.style.cursor='pointer';element.onclick=e=>{e.stopPropagation();select(draft);};element.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();select(draft);}};}
    continue;
   }
   const reference=resolveScoreNote(plans[partIndex],{pitch:source.Pitch.getHalfTone()+12-plans[partIndex].transposition.semitones,tick:Math.round(source.getAbsoluteTimestamp().RealValue*4*960),voice:source.ParentVoiceEntry.ParentVoice.VoiceId});
   if(!reference)continue;
   for(const element of scoreNoteheads(graphical)){
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
  bindScorePitchDrag(element,{session,reference,zoom:renderer.Zoom,execute,guard,onSelect:e=>select(reference,Boolean(e?.shiftKey)),onDelete:()=>{const ids=selectedIds.has(reference.noteId)?[...selectedIds]:[reference.noteId],r=session.tracks.flatMap(t=>t.regions).find(r=>r.id===reference.regionId);execute([scoreNoteGroupAction(session,r,ids,'delete')],'Deleted score notes');}});
 }
 bindScoreSelectionTools(form,{session,selection:()=>({region:selectedRegion,ids:[...selectedIds]}),execute,guard});
 const length=form.elements.namedItem('scoreLength'),rhythm=form.elements.namedItem('scoreRhythm'),duration=form.elements.namedItem('duration'),start=form.elements.namedItem('start'),rhythmStatus=form.querySelector('[data-score-rhythm-status]');
 const updateRhythm=()=>{rhythm.disabled=length.value==='custom';rhythmStatus.textContent='';if(!selected||length.value==='custom')return;try{duration.value=scoreRhythmDuration(session,selectedRegion,Number(start.value),length.value,rhythm.value);rhythmStatus.textContent='Length follows the project tempo at this note.';}catch(error){rhythmStatus.textContent=error.message;}};
 length.onchange=updateRhythm;rhythm.onchange=updateRhythm;start.oninput=updateRhythm;duration.oninput=()=>{length.value='custom';rhythm.disabled=true;rhythmStatus.textContent='';};
 form.onsubmit=guard(e=>{e.preventDefault();if(!selected)throw Error('Select a score note first.');if(selectedIds.size>1)throw Error('Select one note to change its fields.');const values=Object.fromEntries(['pitch','start','duration','velocity'].map(key=>[key,Number(form.elements.namedItem(key).value)]));if(length.value!=='custom')values.duration=scoreRhythmDuration(session,selectedRegion,values.start,length.value,rhythm.value);execute([chordDraft?scoreChordCommand(selectedRegion,selected,values):{op:selected.id?'note.set':'note.add',target:selected.id??selectedRegion.id,values}],chordDraft?'Added chord tone':selected.id?'Edited score note':'Added score note');});
 form.querySelector('[data-score-note-chord]').onclick=guard(()=>select(scoreChordDraft(session,selectedRegion,selected)));
 for(const action of ['duplicate','delete'])form.querySelector(`[data-score-note-${action}]`).onclick=guard(()=>execute([scoreNoteGroupAction(session,selectedRegion,[...selectedIds],action)],action==='delete'?'Deleted score note':'Duplicated score note'));
 form.querySelector('[data-score-note-close]').onclick=()=>{form.hidden=true;selected=null;selectedIds.clear();delete panel.dataset.selectedScoreNote;delete panel.dataset.selectedScoreRegion;delete panel.dataset.selectedScoreNotes;panel.querySelectorAll('[data-score-note]').forEach(el=>{el.style.fill='';el.setAttribute('aria-pressed','false');});};
}
