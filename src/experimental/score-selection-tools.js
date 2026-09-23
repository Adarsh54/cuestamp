import {selectedMidiNotes} from './note-selection.js';
import {transposeNoteEdits} from './note-transpose.js';
export function scoreSelectionCommand(session,region,ids,{action,amount}){
 if(!region||!Array.isArray(ids))throw Error('Select score notes first.');
 const noteIds=ids.join(',');selectedMidiNotes(region,{noteIds});
 if(action==='semitones'||action==='steps'){
  const values=action==='semitones'?{noteIds,semitones:amount}:{noteIds,mode:'diatonic',steps:amount,useProjectKey:true,accidentals:'preserve'};
  transposeNoteEdits(region,values,session);
  return {op:'notes.transpose',target:region.id,values};
 }
 if(action==='velocity'||action==='velocityDelta'){
  if(!Number.isFinite(amount)||amount>1||amount<(action==='velocity'?0:-1))throw Error('Velocity must be 0–1; changes must be between −1 and 1.');
  return {op:'notes.velocity',target:region.id,values:{noteIds,[action==='velocity'?'velocity':'delta']:amount}};
 }
 throw Error('Choose a supported score selection edit.');
}
export const scoreSelectionToolsView=()=>`<div data-score-selection-tools hidden><div class="button-row"><label>Transpose selection by<select name="scoreTransposeMode"><option value="semitones">Semitones</option><option value="steps">Project scale steps</option></select></label><label>Amount<input name="scoreTransposeAmount" type="number" min="-127" max="127" step="1" value="0"></label><button type="button" data-score-transpose>Transpose selection</button></div><div class="button-row"><label>Selection velocity<select name="scoreVelocityMode"><option value="velocityDelta">Change by</option><option value="velocity">Set to</option></select></label><label>Value · 0–1<input name="scoreVelocityAmount" type="number" min="-1" max="1" step="0.05" value="0"></label><button type="button" data-score-velocity>Apply selection velocity</button></div><p class="muted">Positive transposition raises pitch; negative lowers it. Scale steps follow the key at each note and preserve chromatic offsets. Velocity changes keep relative differences until reaching 0 or 1; zero makes a note silent.</p></div>`;
export function bindScoreSelectionTools(form,{session,selection,execute,guard}){
 const input=name=>form.elements.namedItem(name);
 for(const [button,mode,amount] of [['transpose','scoreTransposeMode','scoreTransposeAmount'],['velocity','scoreVelocityMode','scoreVelocityAmount']])form.querySelector(`[data-score-${button}]`).onclick=guard(()=>{
  const {region,ids}=selection();
  execute([scoreSelectionCommand(session,region,ids,{action:input(mode).value,amount:input(amount).valueAsNumber})],button==='transpose'?'Transposed score selection':'Changed score selection velocity');
 });
 input('scoreVelocityMode').onchange=()=>{const value=input('scoreVelocityAmount'),absolute=input('scoreVelocityMode').value==='velocity';value.min=absolute?'0':'-1';value.value=absolute?'0.8':'0';};
}
