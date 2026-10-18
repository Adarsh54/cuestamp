import {z} from 'zod';
import {copyRegionClipboard} from './region-clipboard.js';
export const clipboardContextSchema=z.object({sessionId:z.string().min(1),revision:z.number().int().nonnegative(),epoch:z.number().int().nonnegative(),count:z.number().int().min(0).max(1000),position:z.number().finite().min(0).max(1e9),transportEpoch:z.number().int().nonnegative()}).strict();
export const clipboardActionSchema=z.object({operation:z.enum(['copy','cut','paste']),regionIds:z.array(z.string().min(1).max(100)).min(1).max(1000).nullable(),position:z.number().finite().min(0).max(86400).nullable(),trackId:z.string().min(1).max(100).nullable().optional()}).strict();
export function validateClipboardContext(value,session){const context=clipboardContextSchema.parse(value);if(context.sessionId!==session.id||context.revision!==session.revision)throw Error('Clipboard context does not match the session.');return context;}
export function resolveClipboardAction(session,value,context,selection=[]){
 context=validateClipboardContext(context,session);const action=clipboardActionSchema.parse(value);
 if(action.trackId!=null){if(action.operation!=='paste')throw Error('Only paste accepts a destination track.');const track=session.tracks.find(t=>t.id===action.trackId);if(!track||track.kind==='bus')throw Error('Choose an audio, MIDI or video destination track.');if(track.protected)throw Error('Unprotect the destination track before pasting.');}
 if(action.operation==='paste'){if(action.regionIds!==null)throw Error('Paste uses the session clipboard, not a region ID list.');if(!context.count)throw Error('The region clipboard is empty. Copy regions first.');const position=action.position??context.position;if(position>86400)throw Error('Paste position must be within 86,400 seconds.');return {...action,position};}
 if(action.position!==null)throw Error('Copy and cut do not accept a position.');const ids=action.regionIds??selection;copyRegionClipboard(session,ids);return {...action,regionIds:[...ids]};
}
