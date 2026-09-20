import {effectParameters} from './effect-automation.js';
import {sendAutomationTarget} from './automation-recording-lane.js';
import {activeAutomation} from './automation-mode.js';
import {automationSegments,orderedAutomationValue} from './automation-curves.js';

export function createMixerReadback(session){
 const owners=[...session.tracks.filter(t=>t.kind!=='video'),{id:session.id,gainDb:session.masterDb,pan:session.masterPan??0,automation:session.masterAutomation,automationMode:session.masterAutomationMode,automationMuted:session.masterAutomationMuted}];
 const lanes=new Map();
 for(const owner of owners){const points=activeAutomation(owner);for(const parameter of ['gainDb','pan'])lanes.set(`${owner.id}:${parameter}`,{points:automationSegments(points,parameter),fallback:owner[parameter]});}
 for(const track of session.tracks)for(const send of track.sends||[])lanes.set(`${sendAutomationTarget(track.id,send.busId)}:gainDb`,{points:automationSegments(activeAutomation(send,track.automationMode==='off'),'gainDb'),fallback:send.gainDb});
 for(const parent of [...session.tracks,{effects:session.masterEffects,automationMode:session.masterAutomationMode}])for(const effect of parent.effects||[])for(const parameter of Object.keys(effectParameters[effect.kind]))lanes.set(`${effect.id}:${parameter}`,{points:automationSegments(activeAutomation(effect,parent.automationMode==='off'||!effect.enabled||(effect.kind==='tremolo'&&effect.sync&&parameter==='rate')),parameter),fallback:effect[parameter]});
 return (target,parameter,time)=>{const lane=lanes.get(`${target}:${parameter}`);return lane?orderedAutomationValue(lane.points,time,lane.fallback):undefined;};
}
const cache=new WeakMap();
export function updateMixerReadback(root,session,time,liveValue=()=>undefined){
 if(!root||!Number.isFinite(time)||time<0)return;
 let entry=cache.get(root);if(!entry||entry.session!==session||entry.revision!==session.revision){entry={session,revision:session.revision,value:createMixerReadback(session)};cache.set(root,entry);}
 for(const input of root.querySelectorAll('[data-mix-gain],[data-mix-pan],[data-master-gain],[data-master-pan],[data-send-gain],[data-effect-live]')){
  // Never overwrite a pointer gesture or a partially typed numeric value.
  if(input.dataset.mixerEditing==='true'||(input.type==='number'&&input.ownerDocument.activeElement===input))continue;
  const parameter=input.dataset.effectParameter||(('mixGain' in input.dataset||'masterGain' in input.dataset||'sendGain' in input.dataset)?'gainDb':'pan'),source=input.dataset.sendSource,busId=input.dataset.sendGain,target=source?sendAutomationTarget(source,busId):input.dataset.effectLive||input.dataset.mixGain||input.dataset.mixPan||session.id;
  const trim=input.dataset.trimOffset==='true',value=liveValue(source||target,parameter,busId)??(trim?0:entry.value(target,parameter,time));if(!Number.isFinite(value))continue;
  input.value=String(value);
  const output=input.parentElement.querySelector('output');if(output)output.textContent=input.dataset.effectLive?String(Number(value.toFixed(4))):parameter==='gainDb'?`${value.toFixed(1)} dB`:value.toFixed(2);
  input.setAttribute('aria-valuetext',(trim?'Trim offset: ':'')+(input.dataset.effectLive?String(Number(value.toFixed(4))):parameter==='gainDb'?`${value.toFixed(1)} decibels`:value===0?'Center':`${Math.round(Math.abs(value)*100)}% ${value<0?'left':'right'}`));
 }
}
