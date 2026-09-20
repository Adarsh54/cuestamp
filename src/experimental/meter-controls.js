import {compileMeterMap} from './meter-map.js';
import {compileTempoMap} from './tempo-map.js';
export function meterView(session){
 const tempo=compileTempoMap(session),points=compileMeterMap(session).points.slice(1);
 const fields=p=>`<label>Bar<input name="bar" type="number" min="2" max="10000000" step="1" value="${p.bar}" required></label><label>Beats<input name="numerator" type="number" min="1" max="32" step="1" value="${p.numerator}" required></label><label>Beat value<select name="denominator">${[1,2,4,8,16,32,64].map(d=>`<option value="${d}" ${d===p.denominator?'selected':''}>${d}</option>`).join('')}</select></label>`;
 return `<details class="daw-bounce-settings" data-meter-panel><summary>Time signatures</summary><p class="muted">Changes start at a bar boundary and update the musical grid without moving recordings or MIDI notes. Set the starting signature in Metronome. Time edits that would put a signature inside a bar are rejected.</p>${points.map(p=>`<form class="daw-cycle" data-meter-point="${p.id}">${fields(p)}<span>${tempo.timeAtBeat(p.beat).toFixed(2)} s</span><button>Update</button><button type="button" data-meter-delete="${p.id}">Remove</button></form>`).join('')}<form class="daw-cycle" data-meter-add>${fields({bar:(points.at(-1)?.bar??1)+1,numerator:points.at(-1)?.numerator??session.meter,denominator:points.at(-1)?.denominator??session.meterDenominator??4})}<button>Add time signature</button></form></details>`;
}
export function bindMeter(root,{execute,guard}){
 const values=form=>Object.fromEntries(['bar','numerator','denominator'].map(key=>[key,Number(form.elements[key].value)]));
 const add=root.querySelector('[data-meter-add]');add.onsubmit=guard(e=>{e.preventDefault();execute([{op:'meter.add',values:values(add)}],'Added time signature');});
 root.querySelectorAll('[data-meter-point]').forEach(form=>{form.onsubmit=guard(e=>{e.preventDefault();execute([{op:'meter.set',target:form.dataset.meterPoint,values:values(form)}],'Updated time signature');});});
 root.querySelectorAll('[data-meter-delete]').forEach(button=>{button.onclick=guard(()=>execute([{op:'meter.delete',target:button.dataset.meterDelete}],'Removed time signature'));});
}
