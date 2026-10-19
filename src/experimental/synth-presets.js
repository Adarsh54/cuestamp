import {synthVibratoSchema} from './synth-vibrato.js';
import {factorySynths} from './synth-factory.js';
import {synthUnisonSchema} from './synth-unison.js';
import {synthTuningSchema} from './synth-tuning.js';
import {z} from 'zod';
import {synthEnvelopeSchema,isOscillator} from './synth-envelope.js';
import {synthFilterSchema} from './synth-filter.js';
import {pitchBendRangeSchema} from './pitch-bend.js';
const id=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),name=z.string().trim().min(1).max(100);
export const synthSettingsSchema=z.object({instrument:z.enum(['sine','triangle','square','sawtooth']),pitchBendRange:pitchBendRangeSchema,...synthVibratoSchema.shape,...synthUnisonSchema.shape,...synthTuningSchema.shape,...synthEnvelopeSchema.shape,...synthFilterSchema.shape}).strict();
export const synthPresetSchema=z.object({id,name,settings:synthSettingsSchema}).strict();
export const synthPresetsSchema=z.array(synthPresetSchema).max(32).default([]).refine(items=>new Set(items.map(p=>p.id)).size===items.length,'Synth preset IDs must be unique.');
export function synthSnapshot(track){if(track?.kind!=='midi'||!isOscillator(track.instrument))throw Error('Choose a built-in synth track.');return synthSettingsSchema.parse(Object.fromEntries(Object.keys(synthSettingsSchema.shape).filter(key=>track[key]!==undefined).map(key=>[key,structuredClone(track[key])])));}
export const synthPresetFileLimit=16*1024;
const synthFileSchema=z.object({format:z.literal('cuestamp-synth'),version:z.literal(1),name,settings:synthSettingsSchema}).strict();
export function encodeSynthPresetFile(preset){const p=synthPresetSchema.parse(preset);return JSON.stringify(synthFileSchema.parse({format:'cuestamp-synth',version:1,name:p.name,settings:p.settings}),null,2);}
export function parseSynthPresetFile(json){if(typeof json!=='string'||new TextEncoder().encode(json).length>synthPresetFileLimit)throw Error('Synth preset file exceeds 16 KiB.');let value;try{value=JSON.parse(json);}catch{throw Error('Invalid synth preset JSON.');}return synthFileSchema.parse(value);}
export function synthPresetFilename(preset){return (preset.name.replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'')||'synth')+'.cuestamp-synth.json';}
export function editSynthPreset(session,op,target,values){
 if(op==='synthPreset.factory'){const {sound}=z.object({sound:z.enum(factorySynths.map(item=>item.id))}).strict().parse(values),track=session.tracks.find(t=>t.id===target);if(track?.kind!=='midi')throw Error('Apply synth sounds to an instrument track.');Object.assign(track,synthSettingsSchema.parse(factorySynths.find(item=>item.id===sound).settings));return;}
 const presets=session.synthPresets,uniqueName=(value,except)=>{if(presets.some(p=>p.id!==except&&p.name.toLowerCase()===value.toLowerCase()))throw Error('Choose a different synth preset name.');};
 if(op==='synthPreset.import'){if(target!==undefined&&target!==session.id)throw Error('Import synth presets into the current project.');const v=z.object({id:id.optional(),json:z.string().max(synthPresetFileLimit)}).strict().parse(values);if(presets.length>=32)throw Error('A project can save up to 32 synth presets.');const imported=parseSynthPresetFile(v.json);let candidate=imported.name;for(let n=2;presets.some(p=>p.name.toLowerCase()===candidate.toLowerCase());n++){const suffix=` (${n})`;candidate=imported.name.slice(0,100-suffix.length)+suffix;}presets.push(synthPresetSchema.parse({id:v.id??crypto.randomUUID(),name:candidate,settings:imported.settings}));return;}

 if(op==='synthPreset.save'||op==='synthPreset.update'){
  const v=(op==='synthPreset.save'?z.object({id:id.optional(),name}):z.object({presetId:id})).strict().parse(values),settings=synthSnapshot(session.tracks.find(t=>t.id===target));
  if(op==='synthPreset.update'){const preset=presets.find(p=>p.id===v.presetId);if(!preset)throw Error('Choose a saved synth preset.');preset.settings=settings;return;}
  if(presets.length>=32)throw Error('A project can save up to 32 synth presets.');uniqueName(v.name);presets.push(synthPresetSchema.parse({id:v.id??crypto.randomUUID(),name:v.name,settings}));return;
 }
 if(op==='synthPreset.apply'){
  const {presetId}=z.object({presetId:id}).strict().parse(values),preset=presets.find(p=>p.id===presetId),track=session.tracks.find(t=>t.id===target);
  if(!preset)throw Error('Choose a saved synth preset.');if(track?.kind!=='midi')throw Error('Apply synth presets to an instrument track.');Object.assign(track,structuredClone(preset.settings));return;
 }
 const preset=presets.find(p=>p.id===target);if(!preset)throw Error('Choose a saved synth preset.');
 if(op==='synthPreset.rename'){const v=z.object({name}).strict().parse(values);uniqueName(v.name,target);preset.name=v.name;}
 else if(op==='synthPreset.delete'){z.object({}).strict().parse(values);session.synthPresets=presets.filter(p=>p.id!==target);}
 else throw Error('Unknown synth preset operation.');
}
export function synthPresetsView(session,track,esc){
 if(track?.kind!=='midi')return '';const canSave=isOscillator(track.instrument);
 return `<details data-synth-presets><summary>Synth presets</summary><p class="muted">Save the waveform, tuning, unison, vibrato, envelopes, filter and pitch-bend range with this project. Applying a preset keeps this track’s notes, effects and mix.</p><label>Saved synth<select data-synth-preset><option value="">Choose a preset</option>${session.synthPresets.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><div class="button-row"><button type="button" data-synth-preset-apply>Apply preset</button><button type="button" data-synth-preset-update ${canSave?'':'disabled'}>Update from this track</button><button type="button" data-synth-preset-delete>Delete preset</button><button type="button" data-synth-preset-export>Export preset</button><button type="button" data-synth-preset-import>Import preset</button><input type="file" data-synth-preset-file accept=".json,application/json" hidden></div><form data-synth-preset-save><label>Preset name<input name="name" maxlength="100" required></label><div class="button-row"><button ${canSave?'':'disabled'}>Save new preset</button><button type="button" data-synth-preset-rename>Rename selected preset</button></div></form><small>Saved presets are independent copies. Updating or deleting one does not change tracks that already use it.${canSave?'':' Select a sine, triangle, square or sawtooth instrument to save a new synth preset.'}</small></details>`;
}
export function bindSynthPresets(root,{session,track,state={},execute,guard,blocked,exportFile,importFile}){
 const scope=root.querySelector('[data-synth-presets]');if(!scope)return;const select=scope.querySelector('[data-synth-preset]'),form=scope.querySelector('form'),button=action=>scope.querySelector(`[data-synth-preset-${action}]`);
 select.value=state.id??'';const chosen=()=>{const preset=session.synthPresets.find(p=>p.id===select.value);if(!preset)throw Error('Choose a synth preset first.');return preset;},ready=()=>{if(blocked())throw Error('Finish the current operation before editing presets.');},refresh=()=>{state.id=select.value;for(const action of ['apply','update','rename','delete','export'])button(action).disabled=!select.value||(action==='update'&&!isOscillator(track.instrument));if(select.value)form.elements.namedItem('name').value=chosen().name;};select.onchange=refresh;refresh();
 button('export').onclick=guard(()=>{ready();exportFile(chosen());});const fileInput=scope.querySelector('[data-synth-preset-file]');button('import').onclick=guard(()=>{ready();fileInput.click();});fileInput.onchange=guard(async()=>{const file=fileInput.files?.[0];fileInput.value='';if(!file)return;ready();await importFile(file);});
 form.onsubmit=guard(e=>{e.preventDefault();ready();const id=crypto.randomUUID();execute([{op:'synthPreset.save',target:track.id,values:{id,name:form.elements.namedItem('name').value}}],'Saved synth preset',session.revision);state.id=id;const current=root.querySelector('[data-synth-preset]');if(current){current.value=id;current.onchange?.();}});
 for(const action of ['apply','update'])button(action).onclick=guard(()=>{ready();execute([{op:`synthPreset.${action}`,target:track.id,values:{presetId:chosen().id}}],action==='apply'?'Applied synth preset':'Updated synth preset',session.revision);});
 button('rename').onclick=guard(()=>{ready();execute([{op:'synthPreset.rename',target:chosen().id,values:{name:form.elements.namedItem('name').value}}],'Renamed synth preset',session.revision);});
 button('delete').onclick=guard(()=>{ready();execute([{op:'synthPreset.delete',target:chosen().id}],'Deleted synth preset',session.revision);});
}
