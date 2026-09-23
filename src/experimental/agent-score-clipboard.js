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
