import {z} from 'zod';
import {duplicateTrack} from './duplicate-track.js';
import {validateAudioStretch} from './audio-stretch-options.js';
const ratioSchema=z.number().finite().min(.5).max(2);
export function audioStretchPlan(session,regionId,ratio){
 ratio=ratioSchema.parse(ratio);const source=session.tracks.find(t=>t.regions.some(r=>r.id===regionId)),region=source?.regions.find(r=>r.id===regionId);
 if(source?.kind!=='audio'||!region?.assetId)throw Error('Select an audio region with a source file.');
 if(source.protected)throw Error('Unprotect the track before stretching audio.');
 if(region.mute)throw Error('Unmute the region before stretching audio.');
 if(session.tracks.length>=128)throw Error('Stretching needs room for a new audio track.');
 if(region.duration<.05||region.duration>600)throw Error('Stretch audio regions between 50 ms and 10 minutes.');
 if(region.start+region.duration*ratio>86400)throw Error('The stretched audio would exceed the timeline.');
 return {source,region,ratio,name:region.name.slice(0,180)+' stretched'};
}
export function stretchedRegionTrack(session,regionId,values){
 const v=z.object({ratio:ratioSchema,assetId:z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),sampleRate:z.number().int(),channels:z.number().int().min(1).max(2),frames:z.number().int().positive()}).strict().parse(values),plan=audioStretchPlan(session,regionId,v.ratio),r=plan.region;
 const frames=validateAudioStretch({sampleRate:v.sampleRate,frames:Math.round(r.duration*v.sampleRate),channels:v.channels,ratio:v.ratio});if(v.frames!==frames)throw Error('Stretched frame count does not match this region. Render it again.');
 if(v.assetId===r.assetId)throw Error('Stretching must create a new audio asset.');
 const copy=duplicateTrack(plan.source,{name:plan.name,includeRegions:false}),duration=v.frames/v.sampleRate,scale=duration/r.duration;
 copy.regions=[{...structuredClone(r),id:crypto.randomUUID(),name:plan.name,assetId:v.assetId,offset:0,reverse:false,duration,fadeIn:r.fadeIn*scale,fadeOut:r.fadeOut*scale}];
 return {track:copy,sourceTrackId:plan.source.id};
}
export function audioStretchView(region,kind,busy){return region&&kind==='audio'?`<details data-audio-stretch-panel><summary>Time stretch audio</summary><form data-audio-stretch><label>Duration · %<input name="percent" type="number" min="50" max="200" step="any" value="100" required></label><output data-audio-stretch-preview>${region.duration.toFixed(3)} seconds</output><button ${busy||region.mute?'disabled':''}>Stretch to new track</button></form><p class="muted">Preserves pitch. Creates a rendered file on a new track and mutes this region. Original audio remains available; undo restores it. Fades scale with duration; track effects and automation stay editable. Stretching can alter transients and texture.</p></details>`:'';}
export function bindAudioStretch(root,{session,region,run,guard}){const form=root.querySelector('[data-audio-stretch]');if(!form||!region)return;const values=()=>form.elements.percent.value.trim()?Number(form.elements.percent.value)/100:NaN;form.oninput=()=>{try{const plan=audioStretchPlan(session,region.id,values());form.querySelector('output').textContent=`${region.duration.toFixed(3)} → ${(region.duration*plan.ratio).toFixed(3)} seconds`; }catch(error){form.querySelector('output').textContent=error.message;}};form.onsubmit=guard(async e=>{e.preventDefault();const plan=audioStretchPlan(session,region.id,values());await run(plan);});}

export const audioStretchActionSchema=z.object({regionId:z.string().min(1).max(100).nullable(),ratio:ratioSchema}).strict();
export function prepareAudioStretch(session,value,context){
 const action=audioStretchActionSchema.parse(value);
 if(!context||context.sessionId!==session.id||context.revision!==session.revision)throw Error('Stretch context does not match the session.');
 return audioStretchPlan(session,action.regionId??context.regionId,action.ratio);
}
