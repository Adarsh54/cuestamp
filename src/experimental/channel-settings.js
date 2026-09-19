import {duplicateTrack} from './duplicate-track.js';
export const channelSettingChoices={effects:'Effects and their automation',mix:'Volume and pan',automation:'Volume and pan automation',routing:'Output, sends and send automation',instrument:'Instrument and sampler settings'};
export function copyChannelSettings(destination,source,options){
 if(!source||!destination)throw Error('Choose existing source and destination tracks.');
 if(source.id===destination.id)throw Error('Choose a different source track.');
 if([source.kind,destination.kind].includes('video'))throw Error('Video tracks do not have audio channel settings.');
 for(const key of Object.keys(options))if(!['sourceId',...Object.keys(channelSettingChoices)].includes(key))throw Error('Unknown channel setting: '+key);
 const selected=Object.keys(channelSettingChoices).filter(key=>options[key]===true);
 for(const key of Object.keys(channelSettingChoices))if(options[key]!==undefined&&typeof options[key]!=='boolean')throw Error('Channel setting choices must be true or false.');
 if(!selected.length)throw Error('Select at least one category to replace.');
 if(options.instrument&&(source.kind!=='midi'||destination.kind!=='midi'))throw Error('Instrument settings require two MIDI tracks.');
 const copy=duplicateTrack(source,{includeRegions:false});
 const keys={effects:['effects'],mix:['gainDb','pan'],automation:['automation','automationMode'],routing:['output','sends'],instrument:Object.keys(copy).filter(key=>key==='instrument'||key.startsWith('sample'))};
 for(const category of selected)for(const key of keys[category])destination[key]=copy[key];
}
export function channelSettingsView(session,track,esc){
 const sources=session.tracks.filter(t=>t.id!==track.id&&t.kind!=='video');
 if(!sources.length)return '';
 return `<details class="daw-channel-settings"><summary>Copy channel settings</summary><form data-channel-settings><label>Copy from<select name="sourceId">${sources.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label><p>Replace selected settings on ${esc(track.name)}. Regions, name, mute and solo stay unchanged.</p>${Object.entries(channelSettingChoices).map(([key,label])=>`<label><input type="checkbox" name="${key}" ${key==='effects'?'checked':''} ${key==='instrument'&&track.kind!=='midi'?'disabled':''}> ${label}</label>`).join('')}<p class="muted">Copied curves keep their project times and override static values. Routing copies can be rejected if they create a feedback loop.</p><button type="submit">Copy settings</button></form></details>`;
}
export function bindChannelSettings(root,{session,track,execute,guard,blocked}){
 const form=root.querySelector('[data-channel-settings]');if(!form)return;
 const update=()=>{const input=form.elements.instrument;input.disabled=track.kind!=='midi'||session.tracks.find(t=>t.id===form.elements.sourceId.value)?.kind!=='midi';if(input.disabled)input.checked=false;};update();form.elements.sourceId.onchange=update;
 form.onsubmit=guard(event=>{event.preventDefault();if(blocked())throw Error('Stop recording or wait for the current operation before copying settings.');const values={sourceId:form.elements.sourceId.value};for(const key of Object.keys(channelSettingChoices))values[key]=form.elements[key].checked;execute([{op:'track.copySettings',target:track.id,values}],'Copied channel settings',session.revision);});
}
