import {z} from 'zod';
export const historyContextSchema=z.object({sessionId:z.string().min(1),revision:z.number().int().nonnegative(),undoSteps:z.number().int().min(0).max(100),redoSteps:z.number().int().min(0).max(100)}).strict();
export const historyActionSchema=z.object({operation:z.enum(['undo','redo']),steps:z.number().int().min(1).max(100)}).strict();
export function historyContext(history){return {sessionId:history.session.id,revision:history.session.revision,undoSteps:history.past.length,redoSteps:history.future.length};}
export function validateHistoryContext(value,session){const context=historyContextSchema.parse(value);if(context.sessionId!==session.id||context.revision!==session.revision)throw Error('History context does not match the session.');return context;}
export function validateHistoryAction(value,context){const action=historyActionSchema.parse(value),available=action.operation==='undo'?context.undoSteps:context.redoSteps;if(action.steps>available)throw Error(`Only ${available} ${action.operation} steps are available. No history changes applied.`);return action;}
export function applyHistoryAction(history,value,expected){
 const current=historyContext(history);validateHistoryContext(expected,history.session);
 if(current.undoSteps!==expected.undoSteps||current.redoSteps!==expected.redoSteps)throw Error('History changed while planning. Run the instruction again.');
 const action=validateHistoryAction(value,current);
 for(let i=0;i<action.steps;i++)history[action.operation]();
 return `${action.operation==='undo'?'Undid':'Redid'} ${action.steps} ${action.steps===1?'edit':'edits'}.`;
}
