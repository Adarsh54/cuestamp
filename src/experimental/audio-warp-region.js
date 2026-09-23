import {bindWarpGraphic} from './audio-warp-graphic.js';
import {z} from 'zod';
import {anchorsSchema,audioWarpPlan} from './audio-warp-options.js';
import {audioStretchPlan,stretchedRegionTrack} from './audio-stretch-region.js';
export function audioWarpRegionPlan(session,regionId,anchors){
 anchors=anchorsSchema.parse(anchors);const plan=audioStretchPlan(session,regionId,1),duration=plan.region.duration;let previous={source:0,target:0};
 for(const point of [...anchors,{source:duration,target:duration}]){const source=point.source-previous.source,target=point.target-previous.target;if(source<.05-1e-9||target<=0||target/source<.5-1e-9||target/source>2+1e-9)throw Error('Keep warp anchors ordered, with source intervals of at least 50 ms and interval stretch between 50% and 200%.');previous=point;}
 if(anchors.every(p=>p.source===p.target))throw Error('Move at least one warp anchor before rendering.');
 return {...plan,anchors,name:plan.region.name.slice(0,180)+' warped'};
}
export function warpedRegionTrack(session,regionId,values){
 const v=z.object({anchors:z.string().max(20000),assetId:z.string(),sampleRate:z.number(),channels:z.number(),frames:z.number()}).strict().parse(values),plan=audioWarpRegionPlan(session,regionId,JSON.parse(v.anchors));
 if(audioWarpPlan({sampleRate:v.sampleRate,frames:Math.round(plan.region.duration*v.sampleRate),channels:v.channels,anchors:plan.anchors}).identity)throw Error('Move a warp anchor by at least one source sample.');
 const {anchors,...rendered}=v,result=stretchedRegionTrack(session,regionId,{...rendered,ratio:1});result.track.name=plan.name;result.track.regions[0].name=plan.name;return result;
}
export const audioWarpActionSchema=z.object({regionId:z.string().min(1).max(100).nullable(),anchors:anchorsSchema}).strict();
export function prepareAudioWarp(session,value,context){const v=audioWarpActionSchema.parse(value);if(!context||context.sessionId!==session.id||context.revision!==session.revision)throw Error('Warp context does not match the session.');return audioWarpRegionPlan(session,v.regionId??context.regionId,v.anchors);}
export function audioWarpView(region,kind,busy,ready=false){return region&&kind==='audio'?`<details data-audio-warp-panel><summary>Time warp</summary><form data-audio-warp><p>Move timing points within this region. Start and end stay fixed.</p>${ready?'<canvas data-warp-canvas width="1000" height="180" tabindex="0" aria-label="Warp timing preview" style="width:100%;height:180px;touch-action:none"></canvas><output data-warp-graphic-status></output>':`<button type="button" data-warp-wave-load ${busy?'disabled':''}>Load warp waveform</button>`}<div data-warp-anchors></div><button type="button" data-warp-add ${busy?'disabled':''}>Add timing point</button><button ${busy||region.mute?'disabled':''}>Render warped audio</button></form><p class="muted">Times are seconds within the region. Use ordered points, source intervals of at least 50 ms, and interval stretch between 50% and 200%. Creates a new audio track and retains the muted original. Pitch is approximately preserved; stretching can alter texture and transients.</p></details>`:'';}
export function bindAudioWarp(root,{session,region,guard,run,buffer,index,loadWaveform,draft,onDraftChange=()=>{}}){const form=root.querySelector('[data-audio-warp]');if(!form||!region)return;const list=form.querySelector('[data-warp-anchors]');let draw=()=>{};
 const rows=()=>[...list.children].map(row=>({source:row.querySelector('[name=source]').value,target:row.querySelector('[name=target]').value})),read=()=>rows().map(v=>({source:v.source.trim()?Number(v.source):NaN,target:v.target.trim()?Number(v.target):NaN})),changed=()=>{onDraftChange(rows());draw();};
 const add=value=>{if(list.children.length>=64)throw Error('Use at most 64 timing points.');const row=document.createElement('div');row.className='button-row';row.dataset.warpAnchor='';row.innerHTML=`<label>Source · seconds<input name="source" type="number" min="0" max="${region.duration}" step="any" required></label><label>Destination · seconds<input name="target" type="number" min="0" max="${region.duration}" step="any" required></label><button type="button" data-warp-remove aria-label="Remove timing point">Remove</button>`;row.querySelector('[name=source]').value=String(value?.source??'');row.querySelector('[name=target]').value=String(value?.target??'');row.oninput=changed;row.querySelector('[data-warp-remove]').onclick=()=>{row.remove();changed();};list.append(row);};
 for(const value of draft??[{source:region.duration/2,target:region.duration/2}])add(value);
 form.querySelector('[data-warp-add]').onclick=guard(()=>{add();changed();});form.querySelector('[data-warp-wave-load]')?.addEventListener('click',guard(loadWaveform));
 const write=points=>{points.forEach((p,i)=>{list.children[i].querySelector('[name=source]').value=String(p.source);list.children[i].querySelector('[name=target]').value=String(p.target);});onDraftChange(rows());};
 draw=bindWarpGraphic(form,{buffer,index,region,read,write,guard});form.onsubmit=guard(async e=>{e.preventDefault();await run(audioWarpRegionPlan(session,region.id,read()));});
}
