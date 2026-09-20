import {keySignatureName} from './key-map.js';
import {compileTempoMap} from './tempo-map.js';
import {compileMeterMap} from './meter-map.js';
const valueOf=key=>`${key.sharps}:${key.mode}`;
export function keyChangesView(session,keys){
 const tempo=compileTempoMap(session),meter=compileMeterMap(session);
 const options=current=>keys.map(key=>`<option value="${valueOf(key)}" ${valueOf(key)===current?'selected':''}>${keySignatureName(key)}</option>`).join('');
 const fields=(point={beat:4,sharps:0,mode:'major'})=>`<label>Quarter-note beat (0 = start)<input name="beat" type="number" min="0.000001" max="432000" step="any" required value="${point.beat}"></label><label>Key<select name="key">${options(valueOf(point))}</select></label>`;
 return `<section data-key-changes><h4>Key changes</h4>${(session.keyChanges||[]).map(point=>{const pos=meter.positionAtBeat(point.beat);return `<form class="daw-cycle" data-key-change="${point.id}">${fields(point)}<small>Bar ${pos.bar} · ${tempo.timeAtBeat(point.beat).toFixed(2)} s</small><button>Apply</button><button type="button" data-key-change-delete="${point.id}">Remove</button></form>`;}).join('')}<form class="daw-cycle" data-key-change-new>${fields()}<button>Add key change</button></form><p class="muted">Each key lasts until the next change. Positions are quarter-note beats from the project start. These labels do not transpose audio or MIDI. Timeline and section edits carry key changes with the music.</p></section>`;
}
export function bindKeyChanges(root,{execute,guard,projectKeys}){
 const bind=(form,id)=>{form.onsubmit=guard(event=>{event.preventDefault();const beatText=form.elements.beat.value,key=projectKeys.find(k=>valueOf(k)===form.elements.key.value);if(!beatText.trim()||!key)throw Error('Choose a beat and key signature.');execute([{op:id?'keyChange.set':'keyChange.add',...(id?{target:id}:{}),values:{beat:Number(beatText),...key}}],id?'Updated key change':'Added key change');});};
 root.querySelectorAll('[data-key-change]').forEach(form=>bind(form,form.dataset.keyChange));
 const add=root.querySelector('[data-key-change-new]');if(add)bind(add);
 root.querySelectorAll('[data-key-change-delete]').forEach(button=>button.onclick=guard(()=>execute([{op:'keyChange.delete',target:button.dataset.keyChangeDelete}],'Removed key change')));
}
