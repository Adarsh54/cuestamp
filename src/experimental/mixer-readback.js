import {activeAutomation} from './automation-mode.js';
import {automationSegments,orderedAutomationValue} from './automation-curves.js';

export function createMixerReadback(session){
 const owners=[...session.tracks.filter(t=>t.kind!=='video'),{id:session.id,gainDb:session.masterDb,pan:session.masterPan??0,automation:session.masterAutomation,automationMode:session.masterAutomationMode,automationMuted:session.masterAutomationMuted}];
 const lanes=new Map();
 for(const owner of owners){const points=activeAutomation(owner);for(const parameter of ['gainDb','pan'])lanes.set(`${owner.id}:${parameter}`,{points:automationSegments(points,parameter),fallback:owner[parameter]});}
 return (target,parameter,time)=>{const lane=lanes.get(`${target}:${parameter}`);return lane?orderedAutomationValue(lane.points,time,lane.fallback):undefined;};
}
const cache=new WeakMap();
export function updateMixerReadback(root,session,time,liveValue=()=>undefined){
 if(!root||!Number.isFinite(time)||time<0)return;
 let entry=cache.get(root);if(!entry||entry.session!==session||entry.revision!==session.revision){entry={session,revision:session.revision,value:createMixerReadback(session)};cache.set(root,entry);}
 for(const input of root.querySelectorAll('[data-mix-gain],[data-mix-pan],[data-master-gain],[data-master-pan]')){
  // Never overwrite a pointer gesture or a partially typed numeric value.
  if(input.dataset.mixerEditing==='true'||(input.type==='number'&&input.ownerDocument.activeElement===input))continue;
  const parameter=('mixGain' in input.dataset||'masterGain' in input.dataset)?'gainDb':'pan',target=input.dataset.mixGain||input.dataset.mixPan||session.id;
  const value=liveValue(target,parameter)??entry.value(target,parameter,time);if(!Number.isFinite(value))continue;
  input.value=String(value);
  const output=input.parentElement.querySelector('output');if(output)output.textContent=parameter==='gainDb'?`${value.toFixed(1)} dB`:value.toFixed(2);
  input.setAttribute('aria-valuetext',parameter==='gainDb'?`${value.toFixed(1)} decibels`:value===0?'Center':`${Math.round(Math.abs(value)*100)}% ${value<0?'left':'right'}`);
 }
}
