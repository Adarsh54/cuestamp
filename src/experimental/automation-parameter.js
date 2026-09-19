import {z} from 'zod';
import {automationLanes} from './automation-range.js';
const options=z.object({parameter:z.string().min(1).max(50),enabled:z.boolean(),busId:z.string().min(1).max(100).optional()}).strict();
export function setAutomationParameterEnabled(session,target,values){
 const v=options.parse(values);if(!automationLanes(session).some(l=>l.target===target&&l.busId===v.busId&&l.parameter===v.parameter))throw Error('Automation parameter does not belong to this channel, send or effect.');
 let owner,key='automationMuted';if(target===session.id){owner=session;key='masterAutomationMuted';}else{owner=session.tracks.find(t=>t.id===target);if(owner&&v.busId)owner=owner.sends.find(s=>s.busId===v.busId);if(!owner)owner=[...session.masterEffects,...session.tracks.flatMap(t=>t.effects)].find(e=>e.id===target);}
 const muted=new Set(owner[key]||[]);if(v.enabled)muted.delete(v.parameter);else muted.add(v.parameter);owner[key]=[...muted];
}
