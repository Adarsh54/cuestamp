import {hardwareMidiFingerprint,hardwareSourceStatus} from './hardware-source-status.js';
import {z} from 'zod';
export const hardwareRecordingOptions=z.object({latencyMs:z.number().finite().min(0).max(2000).default(0),autoFinish:z.boolean().default(true),tailSeconds:z.number().finite().min(0).max(30).default(2)}).strict();
export function hardwareCaptureDuration(playbackDuration,options={}){
 const settings=hardwareRecordingOptions.parse(options);if(!settings.autoFinish)return null;
 if(!Number.isFinite(playbackDuration)||playbackDuration<=0)throw Error('Hardware playback needs a finite duration for automatic recording.');
 const duration=playbackDuration+settings.tailSeconds;
 if(duration>600)throw Error('Automatic hardware capture, including its tail, must fit within 10 minutes. Shorten the part or turn off automatic finish.');
 return duration;
}

const sourceId=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const hardwareRecordingSchema=z.object({latencyMs:z.number().finite().min(0).max(2000).optional(),midiFingerprint:z.string().regex(/^[a-f0-9]{64}$/).optional(),kind:z.literal('midi-hardware'),deviceName:z.string().max(200),scope:z.enum(['track','arrangement']),revision:z.number().int().nonnegative(),capturedAt:z.string().datetime(),start:z.number().finite().min(0).max(86400),end:z.number().finite().max(86400),tracks:z.array(z.object({id:sourceId,name:z.string().max(200)}).strict()).min(1).max(128)}).strict().refine(v=>v.end>v.start,'Capture end must follow its start.');
export function hardwareRecordingSource(session,plan,deviceName,scope){return hardwareRecordingSchema.parse({midiFingerprint:hardwareMidiFingerprint(plan),kind:'midi-hardware',deviceName:deviceName.slice(0,200),scope,revision:session.revision,capturedAt:new Date().toISOString(),start:plan.start,end:plan.end,tracks:plan.trackIds.map(id=>({id,name:session.tracks.find(t=>t.id===id).name}))});}
export function hardwareRecordingView(region,session,esc,disabled=false){
 const source=region?.hardwareRecording;if(!source)return '';const comparison=hardwareSourceStatus(source,session);
 return `<section class="daw-hardware-source"><h4>Recorded from MIDI</h4><p data-hardware-source-status="${comparison.state}">${esc(comparison.label)}</p><p>${esc(source.deviceName)} · ${source.start.toFixed(2)}–${source.end.toFixed(2)} s · Revision ${source.revision}</p><p>Captured ${esc(new Date(source.capturedAt).toLocaleString())} · Input delay correction ${(source.latencyMs??0).toFixed(1)} ms</p><ul>${source.tracks.map(t=>`<li>${esc(t.name)} ${session.tracks.some(current=>current.id===t.id&&current.kind==='midi')?`<button type="button" data-hardware-source="${esc(t.id)}">Open source</button>`:'<span class="muted">Source no longer in this project</span>'}</li>`).join('')}</ul><button type="button" data-hardware-retake="${esc(region.id)}" ${disabled||comparison.state==='missing'?'disabled':''}>Prepare another take</button><p class="muted">This records the source at capture time. Later MIDI edits do not change this audio.</p></section>`;
}
export function bindHardwareRecordingSource(root,{session,select,prepare,guard=fn=>fn}){root.querySelectorAll('[data-hardware-retake]').forEach(button=>button.addEventListener('click',guard(()=>prepare(button.dataset.hardwareRetake))));root.querySelectorAll('[data-hardware-source]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.hardwareSource;if(session().tracks.some(t=>t.id===id&&t.kind==='midi'))select(id);}));}

export function hardwareLatencyFrames(sampleRate,options={}){
 if(!Number.isFinite(sampleRate)||sampleRate<=0)throw Error('Choose a valid recording sample rate.');
 return Math.round(hardwareRecordingOptions.parse(options).latencyMs*sampleRate/1000);
}

export const hardwareRetakeActionSchema=z.object({regionId:sourceId}).strict();
export function hardwareRetakePlan(session,regionId){
 const destination=session.tracks.find(t=>t.kind==='audio'&&t.regions.some(r=>r.id===regionId)),region=destination?.regions.find(r=>r.id===regionId);
 if(!region?.hardwareRecording)throw Error('Select a recorded hardware take.');
 if(destination.protected)throw Error('Unprotect the destination audio track before preparing another take.');
 if(destination.regions.length>=1000)throw Error('The destination audio track is full. Choose another recording destination.');
 const source=hardwareRecordingSchema.parse(region.hardwareRecording);
 if(source.tracks.some(t=>!session.tracks.some(current=>current.id===t.id&&current.kind==='midi')))throw Error('A source MIDI track is no longer in this project.');
 if(source.scope==='track'&&source.tracks.length!==1)throw Error('This capture does not identify a single source MIDI track.');
 return {source,destinationId:destination.id,position:source.start};
}
