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
export function audioWarpView(region,kind,busy){return region&&kind==='audio'?`<details data-audio-warp-panel><summary>Time warp</summary><form data-audio-warp><p>Move timing points within this region. Start and end stay fixed.</p><div data-warp-anchors></div><button type="button" data-warp-add ${busy?'disabled':''}>Add timing point</button><button ${busy||region.mute?'disabled':''}>Render warped audio</button></form><p class="muted">Times are seconds within the region. Use ordered points, source intervals of at least 50 ms, and interval stretch between 50% and 200%. Creates a new audio track and retains the muted original. Pitch is approximately preserved; stretching can alter texture and transients.</p></details>`:'';}
export function bindAudioWarp(root,{session,region,guard,run}){const form=root.querySelector('[data-audio-warp]');if(!form||!region)return;const list=form.querySelector('[data-warp-anchors]');let count=0;
 const add=()=>{if(count>=64)throw Error('Use at most 64 timing points.');const row=document.createElement('div');row.className='button-row';row.dataset.warpAnchor='';row.innerHTML=`<label>Source · seconds<input name="source" type="number" min="0" max="${region.duration}" step="any" value="${count?'':region.duration/2}" required></label><label>Destination · seconds<input name="target" type="number" min="0" max="${region.duration}" step="any" value="${count?'':region.duration/2}" required></label><button type="button" data-warp-remove aria-label="Remove timing point">Remove</button>`;row.querySelector('[data-warp-remove]').onclick=()=>{row.remove();count--;};list.append(row);count++;};add();form.querySelector('[data-warp-add]').onclick=guard(add);
 form.onsubmit=guard(async e=>{e.preventDefault();const anchors=[...list.children].map(row=>({source:Number(row.querySelector('[name=source]').value),target:Number(row.querySelector('[name=target]').value)}));await run(audioWarpRegionPlan(session,region.id,anchors));});
}
