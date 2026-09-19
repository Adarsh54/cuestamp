import {z} from 'zod';
export const automationModeSchema=z.enum(['read','off']);
export const automationMutedSchema=parameters=>z.array(z.enum(parameters)).max(parameters.length).refine(items=>new Set(items).size===items.length,'Muted automation parameters must be distinct.').optional();
export const activeAutomation=(owner,inheritedOff=false)=>inheritedOff||owner.automationMode==='off'?[]:(owner.automation||[]).filter(p=>!(owner.automationMuted||[]).includes(p.parameter));
export function effectiveAutomationSession(session){
 const masterOff=session.masterAutomationMode==='off',effects=(items,off)=>items.map(e=>({...e,automation:activeAutomation(e,off)}));
 return {...session,masterAutomation:activeAutomation({automation:session.masterAutomation,automationMuted:session.masterAutomationMuted},masterOff),masterEffects:effects(session.masterEffects||[],masterOff),tracks:session.tracks.map(t=>{const off=t.automationMode==='off';return {...t,automation:activeAutomation(t),effects:effects(t.effects||[],off),sends:(t.sends||[]).map(s=>({...s,automation:activeAutomation(s,off)}))};})};
}
