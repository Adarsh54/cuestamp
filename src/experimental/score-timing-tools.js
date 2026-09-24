import {selectedMidiNotes} from './note-selection.js';
import {quantizeNotes,humanizeNotes} from './note-transforms.js';
export function scoreTimingCommand(session,region,ids,action,options){
 if(!region||!Array.isArray(ids))throw Error('Select score notes first.');
 const noteIds=ids.join(',');selectedMidiNotes(region,{noteIds});
 const values={...options,noteIds},preview=structuredClone(region);
 if(action==='quantize'){values.timing='beats';quantizeNotes(preview,values,session);}
 else if(action==='humanize')humanizeNotes(preview,values);
 else throw Error('Choose quantize or humanize.');
 return {op:`notes.${action}`,target:region.id,values};
}
export const scoreTimingToolsView=()=>`<details data-score-timing-tools hidden><summary>Selection timing</summary><div class="button-row"><label>Quantize grid<select name="scoreQuantizeGrid"><option value="1">Quarter notes</option><option value="0.5">Eighth notes</option><option value="0.25" selected>Sixteenth notes</option><option value="0.125">Thirty-second notes</option><option value="${1/3}">Eighth-note triplets</option><option value="${1/6}">Sixteenth-note triplets</option></select></label><label>Strength · %<input name="scoreQuantizeStrength" type="number" min="0" max="100" step="1" value="100"></label><label>Swing delay · % of grid<input name="scoreQuantizeSwing" type="number" min="0" max="75" step="1" value="0"></label><button type="button" data-score-quantize>Quantize selected notes</button></div><p class="muted">Moves note starts toward the grid in project beats. Strength 0 leaves timing unchanged; 100 snaps fully. Swing delays alternate grid points. Note lengths stay unchanged.</p><div class="button-row"><label>Start variation · ms<input name="scoreHumanizeStart" type="number" min="0" max="1000" step="1" value="10"></label><label>Length variation · ms<input name="scoreHumanizeLength" type="number" min="0" max="1000" step="1" value="0"></label><label>Velocity variation · 0–1<input name="scoreHumanizeVelocity" type="number" min="0" max="1" step="0.01" value="0.03"></label><label>Variation seed<input name="scoreHumanizeSeed" type="number" min="0" max="4294967295" step="1" value="1"></label><button type="button" data-score-humanize>Humanize selected notes</button></div><p class="muted">Adds bounded variation to the selected notes. The same seed and starting notes produce the same result. Undo before trying another variation. These edits change playback timing and can make notation more complex.</p></details>`;
export function bindScoreTimingTools(form,{session,selection,execute,guard}){
 const value=name=>form.elements.namedItem(name).valueAsNumber;
 form.querySelector('[data-score-quantize]').onclick=guard(()=>{const {region,ids}=selection();execute([scoreTimingCommand(session,region,ids,'quantize',{grid:Number(form.elements.namedItem('scoreQuantizeGrid').value),strength:value('scoreQuantizeStrength')/100,swing:value('scoreQuantizeSwing')/100})],'Quantized selected score notes');});
 form.querySelector('[data-score-humanize]').onclick=guard(()=>{const {region,ids}=selection();execute([scoreTimingCommand(session,region,ids,'humanize',{timing:value('scoreHumanizeStart')/1000,duration:value('scoreHumanizeLength')/1000,velocity:value('scoreHumanizeVelocity'),seed:value('scoreHumanizeSeed')})],'Humanized selected score notes');});
}
