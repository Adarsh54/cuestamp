import {z} from 'zod';
import {durationForBeats} from './tempo-map.js';
import {duplicateTrack} from './duplicate-track.js';
import {validateAudioStretch} from './audio-stretch-options.js';
const semitoneSchema=z.number().finite().min(-12).max(12);
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
export function audioPitchPlan(session,regionId,semitones){
 semitones=semitoneSchema.parse(semitones);const plan=audioStretchPlan(session,regionId,1);
 return {...plan,semitones,name:plan.region.name.slice(0,180)+' transposed'};
}
export function pitchedRegionTrack(session,regionId,values){
 const v=z.object({semitones:semitoneSchema,assetId:z.string(),sampleRate:z.number(),channels:z.number(),frames:z.number()}).strict().parse(values),plan=audioPitchPlan(session,regionId,v.semitones);
 const {semitones,...rendered}=v,result=stretchedRegionTrack(session,regionId,{...rendered,ratio:1});result.track.name=plan.name;result.track.regions[0].name=plan.name;return result;
}
export function audioStretchView(region,kind,busy){return region&&kind==='audio'?`<details data-audio-stretch-panel><summary>Time and pitch</summary><form data-audio-stretch><label>Change<select name="mode"><option value="percent">Duration percentage</option><option value="beats">Musical length</option><option value="pitch">Pitch only</option></select></label><label data-stretch-percent>Duration · %<input name="percent" type="number" min="50" max="200" step="any" value="100" required></label><label data-stretch-beats hidden>Length · quarter-note beats<input name="beats" type="number" min="0.001" max="432000" step="any" value="4" disabled required></label><label data-stretch-pitch hidden>Pitch · semitones<input name="semitones" type="number" min="-12" max="12" step="0.01" value="0" disabled required></label><output data-audio-stretch-preview>${region.duration.toFixed(3)} seconds</output><button ${busy||region.mute?'disabled':''}>Stretch to new track</button></form><p class="muted">Duration edits preserve pitch; pitch edits preserve duration. Creates a rendered file on a new track and mutes this region. Musical length uses the tempo map from the region’s start and fits its endpoint; it does not align individual transients. Original audio remains available; undo restores it. Fades scale with duration; track effects and automation stay editable. Processing can alter transients and texture; pitch edits do not preserve vocal formants.</p></details>`:'';}
export function bindAudioStretch(root,{session,region,run,guard}){
 const form=root.querySelector('[data-audio-stretch]');if(!form||!region)return;
 const number=name=>form.elements[name].value.trim()?Number(form.elements[name].value):NaN;
 const plan=()=>form.elements.mode.value==='pitch'?audioPitchPlan(session,region.id,number('semitones')):form.elements.mode.value==='beats'?audioStretchBeatPlan(session,region.id,number('beats')):audioStretchPlan(session,region.id,number('percent')/100);
 form.oninput=()=>{const beats=form.elements.mode.value==='beats',pitch=form.elements.mode.value==='pitch';form.querySelector('[data-stretch-pitch]').hidden=!pitch;form.elements.semitones.disabled=!pitch;form.querySelector('[data-stretch-beats]').hidden=!beats;form.querySelector('[data-stretch-percent]').hidden=beats||pitch;form.elements.beats.disabled=!beats;form.elements.percent.disabled=beats||pitch;form.querySelector('button').textContent=pitch?'Transpose to new track':'Stretch to new track';try{const result=plan();form.querySelector('output').textContent=pitch?`${result.semitones>0?'+':''}${result.semitones} semitones · ${region.duration.toFixed(3)} seconds unchanged`:`${region.duration.toFixed(3)} → ${(region.duration*result.ratio).toFixed(3)} seconds · ${(result.ratio*100).toFixed(1)}%`; }catch(error){form.querySelector('output').textContent=error.message;}};
 form.onsubmit=guard(async e=>{e.preventDefault();await run(plan());});
}
export function audioStretchBeatPlan(session,regionId,beats){
 if(!Number.isFinite(beats)||beats<=0||beats>432000)throw Error('Choose a positive number of quarter-note beats.');
 const original=audioStretchPlan(session,regionId,1),duration=durationForBeats(session,original.region.start,beats),ratio=duration/original.region.duration;
 if(ratio<.5||ratio>2)throw Error('That musical length requires a duration outside the supported 50–200% range.');
 return audioStretchPlan(session,regionId,ratio);
}
export const audioStretchBeatsSchema=z.object({regionId:z.string().min(1).max(100).nullable(),beats:z.number().finite().positive().max(432000)}).strict();
export function prepareAudioStretchBeats(session,value,context){
 const action=audioStretchBeatsSchema.parse(value);
 if(!context||context.sessionId!==session.id||context.revision!==session.revision)throw Error('Stretch context does not match the session.');
 return audioStretchBeatPlan(session,action.regionId??context.regionId,action.beats);
}

export const audioStretchActionSchema=z.object({regionId:z.string().min(1).max(100).nullable(),ratio:ratioSchema}).strict();
export function prepareAudioStretch(session,value,context){
 const action=audioStretchActionSchema.parse(value);
 if(!context||context.sessionId!==session.id||context.revision!==session.revision)throw Error('Stretch context does not match the session.');
 return audioStretchPlan(session,action.regionId??context.regionId,action.ratio);
}

export const audioPitchActionSchema=z.object({regionId:z.string().min(1).max(100).nullable(),semitones:semitoneSchema}).strict();
export function prepareAudioPitch(session,value,context){
 const action=audioPitchActionSchema.parse(value);
 if(!context||context.sessionId!==session.id||context.revision!==session.revision)throw Error('Pitch context does not match the session.');
 return audioPitchPlan(session,action.regionId??context.regionId,action.semitones);
}
