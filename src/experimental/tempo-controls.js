import {compileTempoMap} from './tempo-map.js';

export function tempoView(session){
 const points=compileTempoMap(session).points.slice(1);
 return `<details class="daw-bounce-settings" data-tempo-panel><summary>Tempo map</summary><p class="muted">BPM holds until the next change. Beat positions count quarter notes from 1. MIDI follows the tempo; audio, video, automation and markers keep their time positions.</p><div>${points.map(p=>`<form class="daw-cycle" data-tempo-point="${p.id}"><label>Beat<input name="beat" aria-label="Tempo change beat" type="number" min="1.000001" step="any" required value="${p.beat+1}"></label><label>BPM<input name="bpm" aria-label="Tempo change BPM" type="number" min="20" max="300" step="any" required value="${p.bpm}"></label><span>${p.time.toFixed(2)} s</span><button type="submit">Update</button><button type="button" data-tempo-delete="${p.id}" aria-label="Remove tempo change at beat ${p.beat+1}">Remove</button></form>`).join('')||'<p class="muted">One tempo throughout. Change the starting BPM in the toolbar.</p>'}</div><form class="daw-cycle" data-tempo-add><label>Beat<input name="beat" aria-label="New tempo change beat" type="number" min="1.000001" step="any" required value="${(points.at(-1)?.beat??0)+session.meter+1}"></label><label>BPM<input name="bpm" aria-label="New tempo change BPM" type="number" min="20" max="300" step="any" required value="${points.at(-1)?.bpm??session.tempo}"></label><button type="submit">Add tempo change</button></form></details>`;
}
export function bindTempo(root,{execute,guard}){
 const values=form=>({beat:Number(form.elements.beat.value)-1,bpm:Number(form.elements.bpm.value)});
 const add=root.querySelector('[data-tempo-add]');
 add.onsubmit=guard(e=>{e.preventDefault();execute([{op:'tempo.add',values:values(add)}],'Added tempo change');});
 root.querySelectorAll('[data-tempo-point]').forEach(form=>{form.onsubmit=guard(e=>{e.preventDefault();execute([{op:'tempo.set',target:form.dataset.tempoPoint,values:values(form)}],'Updated tempo change');});});
 root.querySelectorAll('[data-tempo-delete]').forEach(button=>{button.onclick=guard(()=>execute([{op:'tempo.delete',target:button.dataset.tempoDelete}],'Removed tempo change'));});
}
