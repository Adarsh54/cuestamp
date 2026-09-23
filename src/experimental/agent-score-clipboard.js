import {z} from 'zod';
export const scoreClipboardContextSchema=z.object({sessionId:z.string().min(1),revision:z.number().int().nonnegative(),token:z.string().uuid(),count:z.number().int().min(1).max(20000)}).strict();
export const scorePasteActionSchema=z.object({regionId:z.string().min(1).max(100),beat:z.number().finite().min(0).max(1e7),timing:z.enum(['beats','seconds']),extend:z.boolean()}).strict();
export function validateScoreClipboardContext(session,value){
 const context=scoreClipboardContextSchema.parse(value);
 if(context.sessionId!==session.id||context.revision!==session.revision)throw Error('Score clipboard context does not match the session.');
 return context;
}
export function resolveScorePasteAction(session,value,context){
 validateScoreClipboardContext(session,context);const action=scorePasteActionSchema.parse(value);
 const region=session.tracks.filter(t=>t.kind==='midi').flatMap(t=>t.regions).find(r=>r.id===action.regionId);
 if(!region)throw Error('Choose an existing MIDI destination region.');
 if(region.notes.length+context.count>20000)throw Error('The destination would exceed 20,000 notes.');
 return action;
}
export const scoreCopyContextSchema=z.object({sessionId:z.string().min(1),revision:z.number().int().nonnegative(),epoch:z.number().int().nonnegative()}).strict();
export const scoreCopyActionSchema=z.object({operation:z.enum(['copy','cut']),regionId:z.string().min(1).max(100),noteIds:z.array(z.string().min(1).max(100)).min(1).max(20000).nullable()}).strict();
export function resolveScoreCopyAction(session,value,context,selection=[]){
 const observed=scoreCopyContextSchema.parse(context);if(observed.sessionId!==session.id||observed.revision!==session.revision)throw Error('Score copy context does not match the session.');
 const action=scoreCopyActionSchema.parse(value),ids=action.noteIds??selection;
 const region=session.tracks.filter(t=>t.kind==='midi').flatMap(t=>t.regions).find(r=>r.id===action.regionId);
 if(!region||!ids.length||new Set(ids).size!==ids.length)throw Error('Choose distinct notes in an existing MIDI region.');
 const available=new Set(region.notes.map(n=>n.id));if(ids.some(id=>!available.has(id)))throw Error('Selected notes must belong to the destination clipboard source region.');
 return {...action,noteIds:[...ids]};
}
