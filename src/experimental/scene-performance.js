import {sceneSourceSignature} from './scene-source.js';
import {z} from 'zod';
import {placeScene} from './scene-arrangement.js';
export const scenePerformanceSchema=z.object({sessionId:z.string().min(1).max(100),revision:z.number().int().nonnegative(),events:z.array(z.object({sceneId:z.string().min(1).max(100),sourceSignature:z.string().regex(/^[a-f0-9]{64}$/).optional(),start:z.number().finite().min(0).max(86400),duration:z.number().finite().positive().max(600)}).strict()).min(1).max(100)}).strict().superRefine((value,ctx)=>{for(let i=0;i<value.events.length;i++){const e=value.events[i];if(e.start+e.duration>86400||(i&&e.start<value.events[i-1].start+value.events[i-1].duration-1e-8))ctx.addIssue({code:'custom',message:'Recorded scenes must be ordered and non-overlapping within the timeline.'});}});
export function validateScenePerformance(session,value){
 const take=scenePerformanceSchema.parse(value);
 if(take.sessionId!==session.id)throw Error('This performance belongs to another project.');
 const signatures=new Map();
 for(const event of take.events){
  if(!event.sourceSignature){if(take.revision!==session.revision)throw Error('The project changed after this legacy performance. Its source clips must match before it can be saved.');continue;}
  if(!signatures.has(event.sceneId))signatures.set(event.sceneId,sceneSourceSignature(session,event.sceneId));
  if(signatures.get(event.sceneId)!==event.sourceSignature)throw Error('A recorded scene or source clip changed. Undo those source edits to recover this take.');
 }
 return take;
}
export function availableScenePerformance(session,value){if(!value)return;try{return validateScenePerformance(session,value);}catch{return;}}

export function commitScenePerformance(session,values){const v=z.object({performance:z.string().max(30000),position:z.number().finite().min(0).max(86400),overlap:z.enum(['reject','allow']).default('reject')}).strict().parse(values),take=validateScenePerformance(session,JSON.parse(v.performance));for(const event of take.events)placeScene(session,event.sceneId,{position:v.position+event.start,duration:event.duration,overlap:v.overlap},{recorded:true});}
export function scenePerformanceView(take,session,disabled){if(!take)return '';const fresh=Boolean(availableScenePerformance(session,take)),off=disabled?'disabled':'';return `<section class="daw-scenes"><form data-scene-performance><strong>Recorded scene performance</strong><p>${take.events.length} scene ${take.events.length===1?'launch':'launches'} · ${(take.events.at(-1).start+take.events.at(-1).duration).toFixed(2)} seconds. Saved on this device until placed or discarded.</p>${fresh?'':'<p>Recorded scenes or source clips no longer match this project. Undo source edits to recover this take.</p>'}<label>Arrangement start · seconds<input name="position" type="number" min="0" max="86400" step="any" value="0" required></label><label>Existing clips<select name="overlap"><option value="reject">Keep range clear</option><option value="allow">Allow overlap</option></select></label><button ${off||!fresh?'disabled':''}>Save performance</button><button type="button" data-scene-performance-discard ${off}>Discard performance</button><small>Saves clip timing as editable regions. Existing mixer automation stays in place; this is not a rendered mix recording.</small></form></section>`;}
