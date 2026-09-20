import {z} from 'zod';
import {scaleIntervals} from './scales.js';
export const scalePresetSchema=z.object({id:z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),name:z.string().trim().min(1).max(100),root:z.number().int().min(0).max(11),custom:z.string().max(40).transform(value=>scaleIntervals('custom',value).join(','))}).strict();
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function scalePresetsView(session){return `<div class="button-row"><label>Saved scales<select data-scale-preset><option value="">Choose a saved scale</option>${(session?.scalePresets??[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><button type="button" data-scale-preset-load>Load scale</button><button type="button" data-scale-preset-delete>Delete scale</button></div><form data-scale-preset-save class="button-row"><label>Preset name<input name="name" maxlength="100" required></label><button>Save as new scale</button><button type="button" data-scale-preset-update>Update selected scale</button></form>`;}
export function bindScalePresets(root,{session,read,load,execute,guard}){
 const selector=root.querySelector('[data-scale-preset]'),form=root.querySelector('[data-scale-preset-save]');
 const chosen=()=>{const p=session.scalePresets.find(p=>p.id===selector.value);if(!p)throw Error('Choose a saved scale first.');return p;};
 const fields=()=>{const s=read();return {name:form.elements.name.value,root:s.root,custom:scaleIntervals(s.scale,s.scale==='custom'?s.custom:undefined).join(',')};};
 const update=()=>{const selected=Boolean(selector.value);root.querySelector('[data-scale-preset-load]').disabled=!selected;root.querySelector('[data-scale-preset-delete]').disabled=!selected;root.querySelector('[data-scale-preset-update]').disabled=!selected;};selector.onchange=()=>{update();if(selector.value)form.elements.name.value=chosen().name;};update();
 root.querySelector('[data-scale-preset-load]').onclick=guard(()=>load(chosen()));
 root.querySelector('[data-scale-preset-delete]').onclick=guard(()=>execute([{op:'scalePreset.delete',target:chosen().id}],'Deleted saved scale'));
 form.onsubmit=guard(e=>{e.preventDefault();execute([{op:'scalePreset.add',values:fields()}],'Saved scale preset');});
 root.querySelector('[data-scale-preset-update]').onclick=guard(()=>execute([{op:'scalePreset.set',target:chosen().id,values:fields()}],'Updated scale preset'));
}
