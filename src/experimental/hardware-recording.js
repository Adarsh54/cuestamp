import {z} from 'zod';
export const hardwareRecordingOptions=z.object({autoFinish:z.boolean().default(true),tailSeconds:z.number().finite().min(0).max(30).default(2)}).strict();
export function hardwareCaptureDuration(playbackDuration,options={}){
 const settings=hardwareRecordingOptions.parse(options);if(!settings.autoFinish)return null;
 if(!Number.isFinite(playbackDuration)||playbackDuration<=0)throw Error('Hardware playback needs a finite duration for automatic recording.');
 const duration=playbackDuration+settings.tailSeconds;
 if(duration>600)throw Error('Automatic hardware capture, including its tail, must fit within 10 minutes. Shorten the part or turn off automatic finish.');
 return duration;
}

const sourceId=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const hardwareRecordingSchema=z.object({kind:z.literal('midi-hardware'),deviceName:z.string().max(200),scope:z.enum(['track','arrangement']),revision:z.number().int().nonnegative(),capturedAt:z.string().datetime(),start:z.number().finite().min(0).max(86400),end:z.number().finite().max(86400),tracks:z.array(z.object({id:sourceId,name:z.string().max(200)}).strict()).min(1).max(128)}).strict().refine(v=>v.end>v.start,'Capture end must follow its start.');
export function hardwareRecordingSource(session,plan,deviceName,scope){return hardwareRecordingSchema.parse({kind:'midi-hardware',deviceName:deviceName.slice(0,200),scope,revision:session.revision,capturedAt:new Date().toISOString(),start:plan.start,end:plan.end,tracks:plan.trackIds.map(id=>({id,name:session.tracks.find(t=>t.id===id).name}))});}
export function hardwareRecordingView(region,session,esc){
 const source=region?.hardwareRecording;if(!source)return '';
 return `<section class="daw-hardware-source"><h4>Recorded from MIDI</h4><p>${esc(source.deviceName)} · ${source.start.toFixed(2)}–${source.end.toFixed(2)} s · Revision ${source.revision}</p><p>Captured ${esc(new Date(source.capturedAt).toLocaleString())}</p><ul>${source.tracks.map(t=>`<li>${esc(t.name)} ${session.tracks.some(current=>current.id===t.id&&current.kind==='midi')?`<button type="button" data-hardware-source="${esc(t.id)}">Open source</button>`:'<span class="muted">Source no longer in this project</span>'}</li>`).join('')}</ul><p class="muted">This records the source at capture time. Later MIDI edits do not change this audio.</p></section>`;
}
export function bindHardwareRecordingSource(root,{session,select}){root.querySelectorAll('[data-hardware-source]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.hardwareSource;if(session().tracks.some(t=>t.id===id&&t.kind==='midi'))select(id);}));}
