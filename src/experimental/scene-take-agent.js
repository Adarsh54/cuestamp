import {z} from 'zod';
import {availableScenePerformance,validateScenePerformance} from './scene-performance.js';
const id=z.string().min(1).max(100);
export const sceneTakeContextSchema=z.object({sessionId:id,revision:z.number().int().nonnegative(),epoch:z.number().int().nonnegative(),selectedId:id.nullable(),takes:z.array(z.object({id,name:z.string().min(1).max(100),createdAt:z.string().datetime(),duration:z.number().finite().positive().max(86400),passages:z.number().int().min(1).max(1000),compatible:z.boolean(),placements:z.number().int().nonnegative()}).strict()).max(32)}).strict();
export const sceneTakeActionSchema=z.object({operation:z.enum(['select','rename','discard','place','preview']),takeId:id,name:z.string().trim().min(1).max(100).nullable(),position:z.number().finite().min(0).max(86400).nullable(),overlap:z.enum(['reject','allow']).nullable()}).strict().superRefine((v,ctx)=>{
 if((v.operation==='rename')!==(v.name!==null))ctx.addIssue({code:'custom',message:'Only rename accepts and requires a name.'});
 if((v.operation==='place')!==(v.position!==null&&v.overlap!==null)||v.operation!=='place'&&(v.position!==null||v.overlap!==null))ctx.addIssue({code:'custom',message:'Only place accepts and requires a position and overlap policy.'});
});
export function sceneTakeContext(library,session){if(library.loadError)return;return {sessionId:session.id,revision:session.revision,epoch:library.epoch,selectedId:library.selected(session.id)?.id??null,takes:library.list(session.id).map(t=>({id:t.id,name:t.name,createdAt:t.createdAt,duration:Math.max(...t.performance.events.map(e=>e.start+e.duration)),passages:t.performance.events.length,compatible:Boolean(availableScenePerformance(session,t.performance)),placements:t.placements}))};}
export function validateSceneTakeContext(value,session){if(value===undefined)return;const c=sceneTakeContextSchema.parse(value);if(c.sessionId!==session.id||c.revision!==session.revision)throw Error('Take library does not match the project.');if(new Set(c.takes.map(t=>t.id)).size!==c.takes.length||c.selectedId&&!c.takes.some(t=>t.id===c.selectedId))throw Error('Invalid take library selection or duplicate IDs.');return c;}
export function resolveSceneTakeAction(value,context,session){const action=sceneTakeActionSchema.parse(value),c=validateSceneTakeContext(context,session);if(!c)throw Error('Take library context is required.');const take=c.takes.find(t=>t.id===action.takeId);if(!take)throw Error('Choose a take from this project.');if(['place','preview'].includes(action.operation)&&!take.compatible)throw Error('This take no longer matches its recorded source clips.');return action;}
export function performSceneTakeAction(library,session,value,epoch,execute,preview){
 if(library.epoch!==epoch)throw Error('The take library changed while planning. Try the request again.');
 const action=resolveSceneTakeAction(value,sceneTakeContext(library,session),session),take=library.list(session.id).find(t=>t.id===action.takeId),name=take.name;
 if(action.operation==='preview'){if(!preview)throw Error('Take preview is unavailable.');return Promise.resolve(preview(take)).then(()=>`Previewing take “${name}”.`);}
 if(action.operation==='place'){const performance=validateScenePerformance(session,take.performance);execute([{op:'scene.performance',values:{performance:JSON.stringify(performance),position:action.position,overlap:action.overlap}}],`Placed take “${name}”`,session.revision,take.id);}
 else if(action.operation==='select')library.select(take.id,session.id);
 else if(action.operation==='rename')library.rename(take.id,action.name,session.id);
 else library.discard(take.id,session.id);
 return `${{select:'Selected',rename:'Renamed',discard:'Discarded',place:'Placed'}[action.operation]} take “${action.operation==='rename'?action.name:name}”.`;
}
