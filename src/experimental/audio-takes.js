import {z} from 'zod';
const id=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const takeGroupSchema=z.object({id,takeId:id,name:z.string().trim().min(1).max(200)}).strict();
export function editTakeGroup(track,operation,values){
 if(track?.kind!=='audio')throw Error('Take groups require an audio track.');
 if(operation==='create'){
  const v=z.object({regionIds:z.string().min(1).max(101000),name:z.string().trim().min(1).max(200),activeRegionId:id.optional()}).strict().parse(values),ids=v.regionIds.split(',');
  if(ids.length<2||ids.length>1000||new Set(ids).size!==ids.length)throw Error('Select at least two distinct takes on one track.');
  const regions=ids.map(key=>track.regions.find(r=>r.id===key));if(regions.some(r=>!r?.assetId||r.takeGroup))throw Error('Choose ungrouped audio regions with source media on this track.');
  if(Math.max(...regions.map(r=>r.start))>=Math.min(...regions.map(r=>r.start+r.duration)))throw Error('Takes must share an overlapping timeline interval.');
  const active=v.activeRegionId??ids[0];if(!ids.includes(active))throw Error('The active take must belong to the group.');
  const group={id:crypto.randomUUID(),name:v.name};for(const r of regions){r.takeGroup={...group,takeId:r.id};r.mute=r.id!==active;}return;
 }
 const v=z.object({groupId:id,regionId:id.optional()}).strict().parse(values),members=track.regions.filter(r=>r.takeGroup?.id===v.groupId);
 if(!members.length)throw Error('Take group no longer exists.');
 if(operation==='select'){if(!members.some(r=>r.id===v.regionId))throw Error('Choose a take in this group.');const takeId=members.find(r=>r.id===v.regionId).takeGroup.takeId;for(const r of members)r.mute=r.takeGroup.takeId!==takeId;}
 else if(operation==='ungroup'){if(v.regionId!==undefined)throw Error('Ungroup does not accept a region.');for(const r of members)delete r.takeGroup;}
 else throw Error('Unknown take group operation.');
}
export function takeGroupsView(track,selected,esc){
 if(track?.kind!=='audio')return '';
 const available=track.regions.filter(r=>selected.includes(r.id)&&r.assetId&&!r.takeGroup),groups=new Map();for(const r of track.regions)if(r.takeGroup){if(!groups.has(r.takeGroup.id))groups.set(r.takeGroup.id,[]);groups.get(r.takeGroup.id).push(r);}
 return `<details class="daw-take-groups"><summary>Take groups</summary><p class="muted">Choose overlapping audio regions on this track, then group them to switch between performances. Source recordings stay intact.</p><form data-take-group-create><label>Group name<input name="name" value="Take group" maxlength="200" required></label>${track.regions.filter(r=>r.assetId&&!r.takeGroup).map(r=>`<label><input type="checkbox" name="regionIds" value="${esc(r.id)}" ${selected.includes(r.id)?'checked':''}>${esc(r.name)}</label>`).join('')}<button ${available.length<2||track.protected?'disabled':''}>Group selected takes</button></form>${[...groups].map(([id,regions])=>`<section><h4>${esc(regions[0].takeGroup.name)}</h4>${regions.filter((r,i)=>regions.findIndex(other=>other.takeGroup.takeId===r.takeGroup.takeId)===i).map(r=>`<div class="daw-toolbar"><span>${esc(r.name)} ${r.mute?'':'· Active'}</span><button data-take-use="${esc(r.id)}" data-take-group="${esc(id)}" ${track.protected?'disabled':''}>Use take</button></div>`).join('')}<button data-take-ungroup="${esc(id)}" ${track.protected?'disabled':''}>Ungroup takes</button></section>`).join('')}<small>Use take changes region mutes within its group. Other regions and track mute/solo stay as set. Ungroup keeps current mutes. Comping can use every take.</small></details>`;
}
export function bindTakeGroups(root,{track,selected,execute,guard}){
 const form=root.querySelector('[data-take-group-create]');if(!form)return;
 form.onchange=()=>{form.querySelector('button').disabled=track.protected||form.querySelectorAll('[name=regionIds]:checked').length<2;};
 form.onsubmit=guard(event=>{event.preventDefault();const ids=[...form.querySelectorAll('[name=regionIds]:checked')].map(input=>input.value);execute([{op:'takes.create',target:track.id,values:{regionIds:ids.join(','),name:form.elements.name.value}}],'Grouped audio takes');});
 root.querySelectorAll('[data-take-use]').forEach(button=>button.onclick=guard(()=>execute([{op:'takes.select',target:track.id,values:{groupId:button.dataset.takeGroup,regionId:button.dataset.takeUse}}],'Selected audio take')));
 root.querySelectorAll('[data-take-ungroup]').forEach(button=>button.onclick=guard(()=>execute([{op:'takes.ungroup',target:track.id,values:{groupId:button.dataset.takeUngroup}}],'Ungrouped audio takes')));
}
