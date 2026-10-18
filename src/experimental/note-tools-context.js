import {z} from 'zod';
import {strumOptions} from './note-strum.js';
import {velocityDynamicsOptions} from './velocity-dynamics.js';
import {selectedMidiNotes} from './note-selection.js';
const ident=z.string().min(1).max(100);
export const noteToolsContextSchema=z.object({sessionId:ident,revision:z.number().int().nonnegative(),trackId:ident,regionId:ident,strum:strumOptions.optional(),dynamics:velocityDynamicsOptions.optional()}).strict().refine(v=>v.strum||v.dynamics,'No visible note tool settings.');
export function validateNoteToolsContext(session,context){
 if(context===undefined)return;
 const v=noteToolsContextSchema.parse(context);
 if(v.sessionId!==session.id||v.revision!==session.revision)throw Error('Note tool settings are from a different session revision.');
 const track=session.tracks.find(t=>t.id===v.trackId),region=track?.regions.find(r=>r.id===v.regionId);
 if(track?.kind!=='midi'||!region)throw Error('Note tool settings must reference a MIDI region on their track.');
 for(const tool of [v.strum,v.dynamics])if(tool)selectedMidiNotes(region,tool);
}
export function captureNoteToolsContext(root,session,track,region,selectedIds=[]){
 if(!root||track?.kind!=='midi'||!region)return;
 const context={sessionId:session.id,revision:session.revision,trackId:track.id,regionId:region.id};
 const visible=selector=>{const form=root.querySelector(selector);return form?.closest('details')?.open?form:null;};
 const scope=value=>value==='selected'?{noteIds:selectedIds.join(',')}:{};
 const strum=visible('[data-note-strum]'),dynamics=visible('[data-velocity-dynamics]');
 if(strum){const f=strum.elements;const raw={direction:f.strumDirection.value,interval:Number(f.strumInterval.value)/1000,tolerance:Number(f.strumTolerance.value)/1000,...scope(root.querySelector('[data-note-tool="scope"]')?.value)};try{if(!strum.checkValidity())throw Error();const parsed=strumOptions.parse(raw);selectedMidiNotes(region,parsed);context.strum=parsed;}catch{}}
 if(dynamics){const f=dynamics.elements;const raw={threshold:Number(f.threshold.value)/127,ratio:Number(f.ratio.value),knee:Number(f.knee.value)/127,makeup:Number(f.makeup.value)/127,...scope(f.scope.value)};try{if(!dynamics.checkValidity())throw Error();const parsed=velocityDynamicsOptions.parse(raw);selectedMidiNotes(region,parsed);context.dynamics=parsed;}catch{}}
 try{validateNoteToolsContext(session,context);return context;}catch{return undefined;}
}
