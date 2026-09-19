import {z} from 'zod';
export const automationModeSchema=z.enum(['read','off']);
export const activeAutomation=(owner,inheritedOff=false)=>inheritedOff||owner.automationMode==='off'?[]:owner.automation||[];
export function effectiveAutomationSession(session){
 const masterOff=session.masterAutomationMode==='off',effects=(items,off)=>items.map(e=>({...e,automation:activeAutomation(e,off)}));
 return {...session,masterAutomation:masterOff?[]:session.masterAutomation,masterEffects:effects(session.masterEffects||[],masterOff),tracks:session.tracks.map(t=>{const off=t.automationMode==='off';return {...t,automation:activeAutomation(t),effects:effects(t.effects||[],off),sends:(t.sends||[]).map(s=>({...s,automation:activeAutomation(s,off)}))};})};
}
