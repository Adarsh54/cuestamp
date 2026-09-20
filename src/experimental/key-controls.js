import {keyChangesView,bindKeyChanges} from './key-change-controls.js';
import {keySignatureName} from './key-map.js';
export const projectKeys=['major','minor'].flatMap(mode=>Array.from({length:15},(_,i)=>({sharps:i-7,mode})));
export function keyView(session){
 const current=session.keySignature,value=current?`${current.sharps}:${current.mode}`:'';
 return `<details class="daw-bounce-settings" data-key-panel><summary>Project key · ${current?keySignatureName(current):'Not set'}</summary><form class="daw-cycle" data-project-key><label>Key signature<select name="key" aria-label="Project key"><option value="" ${!current?'selected':''}>Not set</option>${projectKeys.map(key=>{const id=`${key.sharps}:${key.mode}`;return `<option value="${id}" ${id===value?'selected':''}>${keySignatureName(key)}</option>`;}).join('')}</select></label><button>Apply project key</button></form><p class="muted">Labels the project and exported MIDI. Changing the key does not transpose notes or recordings. Not set leaves the opening key unknown; later changes remain.</p>${keyChangesView(session,projectKeys)}</details>`;
}
export function bindKey(root,{execute,guard}){
 bindKeyChanges(root,{execute,guard,projectKeys});
 const form=root.querySelector('[data-project-key]');form.onsubmit=guard(e=>{e.preventDefault();const value=form.elements.key.value,keySignature=projectKeys.find(key=>`${key.sharps}:${key.mode}`===value)??null;if(value&&!keySignature)throw Error('Choose a supported project key.');execute([keySignature?{op:'key.set',values:keySignature}:{op:'key.clear'}],keySignature?`Project key: ${keySignatureName(keySignature)}`:'Cleared project key');});
}
