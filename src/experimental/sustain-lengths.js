import {compilePedalTimeline} from './pedal-timeline.js';
import {z} from 'zod';
import {selectedMidiNotes} from './note-selection.js';
const options=z.object({removePedal:z.boolean().default(true),noteId:z.string().optional(),noteIds:z.string().max(2020000).optional()}).strict();
const pedal=e=>e.type==='controlChange'&&[64,66].includes(e.parameter);
export function sustainLengthPlan(region,values={}){
 const v=options.parse(values),notes=selectedMidiNotes(region,v);if(!notes.length)throw Error('Add or select notes to convert.');
 const channels=new Set(notes.map(n=>n.channel??0)),byChannel=new Map();
 for(const e of region.events||[])if((pedal(e)||(e.type==='controlChange'&&e.parameter===121))&&channels.has(e.channel??0)){const key=e.channel??0;if(!byChannel.has(key))byChannel.set(key,[]);byChannel.get(key).push(e);}
 const index=new Map([...byChannel].map(([channel,events])=>[channel,compilePedalTimeline(events)]));
 const endFor=n=>index.get(n.channel??0)?.sustainedEnd(n,region.duration)??n.start+n.duration;
 const selected=new Set(notes.map(n=>n.id));
 if(v.removePedal&&region.notes.some(n=>channels.has(n.channel??0)&&!selected.has(n.id)&&endFor(n)>n.start+n.duration))throw Error('Other notes on these channels use the pedal. Select them too, or keep pedal events.');
 const edits=notes.flatMap(n=>{const end=endFor(n);if(end<=n.start+n.duration)return [];const duration=end-n.start;if(duration>3600)throw Error('Converted notes cannot exceed one hour. Shorten the region or pedal hold first.');return duration>n.duration?[{id:n.id,duration}]:[];});
 return {edits,removedIds:v.removePedal?(region.events||[]).filter(e=>pedal(e)&&channels.has(e.channel??0)).map(e=>e.id):[],examined:notes.length};
}
const state=settings=>settings.sustainTools??={scope:'region',removePedal:true};
export function sustainLengthsView(settings){const s=state(settings);return `<details class="daw-sustain-lengths"><summary>Sustain pedal to note lengths</summary><form data-sustain-lengths class="button-row"><label>Convert<select name="scope"><option value="region" ${s.scope==='region'?'selected':''}>All notes in region</option><option value="selected" ${s.scope==='selected'?'selected':''}>Selected notes only</option></select></label><label><input type="checkbox" name="removePedal" ${s.removePedal?'checked':''}> Remove converted channels’ pedal events</label><button type="submit">Convert sustain</button></form><output data-sustain-preview></output><p class="muted">Bakes sustain (CC64) and sostenuto (CC66) holds into note lengths, bounded by the region end. Pitch, start, velocity and mute stay unchanged. Removing pedal events requires including every affected note on those channels. Other controllers remain. Keeping pedal events allows them to continue influencing playback. Undo restores note lengths and events.</p></details>`;}
export function bindSustainLengths(root,{region,settings,execute,guard}){
 const form=root.querySelector('[data-sustain-lengths]');if(!form)return;const s=state(settings),button=form.querySelector('button');
 const values=()=>({removePedal:s.removePedal,...(s.scope==='selected'?{noteIds:(settings.selectedIds||[]).join(',')}:{})});
 const update=()=>{s.scope=form.elements.scope.value;s.removePedal=form.elements.removePedal.checked;try{const plan=sustainLengthPlan(region,values());root.querySelector('[data-sustain-preview]').textContent=`${plan.edits.length} notes will be lengthened; ${plan.removedIds.length} pedal events will be removed.`;button.disabled=!plan.edits.length&&!plan.removedIds.length;}catch(e){root.querySelector('[data-sustain-preview]').textContent=e.message;button.disabled=true;}};
 form.onchange=update;form.onsubmit=guard(e=>{e.preventDefault();update();if(!button.disabled)execute([{op:'notes.applySustain',target:region.id,values:values()}],'Converted sustain pedal to note lengths');});update();
}
