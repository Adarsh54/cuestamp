import {z} from 'zod';
import {effectSchema} from './effects.js';
const ident=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const effectPresetSchema=z.object({id:ident,name:z.string().trim().min(1).max(100),effects:z.array(effectSchema).min(1).max(16)}).strict();
const cloneEffects=effects=>effects.map(effect=>({...structuredClone(effect),id:crypto.randomUUID(),automation:effect.automation.map(point=>({...point,id:crypto.randomUUID()}))}));
function channel(session,target){
 if(target===session.id)return {get:()=>session.masterEffects,set:value=>{session.masterEffects=value;}};
 const track=session.tracks.find(t=>t.id===target);if(!track||track.kind==='video')throw Error('Choose an audio, instrument, bus, or master channel.');
 return {get:()=>track.effects,set:value=>{track.effects=value;}};
}
export function editEffectPreset(session,op,target,values){
 if(op==='effectPreset.save'){
  const v=z.object({id:ident.optional(),name:z.string().trim().min(1).max(100),includeAutomation:z.boolean().default(false)}).strict().parse(values);
  if(session.effectPresets.length>=32)throw Error('A project can save up to 32 effect presets.');
  if(session.effectPresets.some(p=>p.name.toLowerCase()===v.name.toLowerCase()))throw Error('Choose a different preset name.');
  const effects=cloneEffects(channel(session,target).get());if(!effects.length)throw Error('Add an effect before saving a preset.');
  if(!v.includeAutomation)for(const e of effects){e.automation=[];delete e.automationMode;delete e.automationMuted;}
  session.effectPresets.push(effectPresetSchema.parse({id:v.id??crypto.randomUUID(),name:v.name,effects}));return;
 }
 if(op==='effectPreset.apply'){
  const v=z.object({presetId:ident,mode:z.enum(['replace','append']).default('replace')}).strict().parse(values),preset=session.effectPresets.find(p=>p.id===v.presetId);
  if(!preset)throw Error('Saved effect preset not found.');const destination=channel(session,target),effects=cloneEffects(preset.effects),next=v.mode==='append'?[...destination.get(),...effects]:effects;
  if(next.length>16)throw Error('A channel can have up to 16 effects.');destination.set(next);return;
 }
 const preset=session.effectPresets.find(p=>p.id===target);if(!preset)throw Error('Saved effect preset not found.');
 if(op==='effectPreset.rename'){
  const v=z.object({name:z.string().trim().min(1).max(100)}).strict().parse(values);
  if(session.effectPresets.some(p=>p.id!==target&&p.name.toLowerCase()===v.name.toLowerCase()))throw Error('Choose a different preset name.');preset.name=v.name;
 }else if(op==='effectPreset.delete'){z.object({}).strict().parse(values);session.effectPresets=session.effectPresets.filter(p=>p.id!==target);}
 else throw Error('Unknown effect preset operation.');
}
export function effectPresetsView(session,esc){return `<details data-effect-presets><summary>Effect chain presets</summary><p class="muted">Saved with this project. Applying a preset is undoable. Included automation keeps its project times; volume, routing and instruments stay unchanged.</p><div class="button-row"><label>Saved chain<select data-effect-preset><option value="">Choose a preset</option>${(session.effectPresets||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${p.effects.length} effects</option>`).join('')}</select></label><label>Apply mode<select data-effect-preset-mode><option value="replace">Replace effects</option><option value="append">Append effects</option></select></label><button type="button" data-effect-preset-apply>Apply preset</button><button type="button" data-effect-preset-delete>Delete preset</button></div><form data-effect-preset-save><label>Preset name<input name="name" required maxlength="100"></label><label><input name="automation" type="checkbox"> Include effect automation</label><div class="button-row"><button type="submit">Save current chain</button><button type="button" data-effect-preset-rename>Rename selected preset</button></div></form></details>`;}
export function bindEffectPresets(root,{session,target,execute,guard,blocked}){
 const scope=root.querySelector('[data-effect-presets]');if(!scope)return;
 const select=scope.querySelector('[data-effect-preset]'),form=scope.querySelector('form'),apply=scope.querySelector('[data-effect-preset-apply]'),remove=scope.querySelector('[data-effect-preset-delete]'),rename=scope.querySelector('[data-effect-preset-rename]');
 const ready=()=>{if(blocked())throw Error('Finish the current operation before editing presets.');};
 const chosen=()=>{const p=session.effectPresets.find(p=>p.id===select.value);if(!p)throw Error('Choose an effect preset first.');return p;};
 const update=()=>{apply.disabled=remove.disabled=rename.disabled=!select.value;};update();select.onchange=()=>{update();if(select.value)form.elements.name.value=chosen().name;};
 form.onsubmit=guard(e=>{e.preventDefault();ready();execute([{op:'effectPreset.save',target,values:{name:form.elements.name.value,includeAutomation:form.elements.automation.checked}}],'Saved effect preset',session.revision);});
 apply.onclick=guard(()=>{ready();execute([{op:'effectPreset.apply',target,values:{presetId:chosen().id,mode:scope.querySelector('[data-effect-preset-mode]').value}}],'Applied effect preset',session.revision);});
 remove.onclick=guard(()=>{ready();execute([{op:'effectPreset.delete',target:chosen().id}],'Deleted effect preset',session.revision);});
 rename.onclick=guard(()=>{ready();execute([{op:'effectPreset.rename',target:chosen().id,values:{name:form.elements.name.value}}],'Renamed effect preset',session.revision);});
}
