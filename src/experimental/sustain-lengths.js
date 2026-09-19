import {z} from 'zod';
import {selectedMidiNotes} from './note-selection.js';
const options=z.object({removePedal:z.boolean().default(true),noteId:z.string().optional(),noteIds:z.string().max(2020000).optional()}).strict();
const pedal=e=>e.type==='controlChange'&&e.parameter===64;
function upperBound(items,time){let lo=0,hi=items.length;while(lo<hi){const mid=(lo+hi)>>>1;if(items[mid].start<=time)lo=mid+1;else hi=mid;}return lo;}
export function sustainLengthPlan(region,values={}){
 const v=options.parse(values),notes=selectedMidiNotes(region,v);if(!notes.length)throw Error('Add or select notes to convert.');
 const channels=new Set(notes.map(n=>n.channel??0)),byChannel=new Map();
 for(const e of region.events||[])if(pedal(e)&&channels.has(e.channel??0)){const key=e.channel??0;if(!byChannel.has(key))byChannel.set(key,[]);byChannel.get(key).push(e);}
 const index=new Map([...byChannel].map(([channel,events])=>{events.sort((a,b)=>a.start-b.start);return [channel,{events,up:events.filter(e=>e.value<64)}];}));
 const endFor=n=>{const end=n.start+n.duration,data=index.get(n.channel??0);if(!data)return end;const last=upperBound(data.events,end)-1;if(last<0||data.events[last].value<64)return end;return Math.max(end,Math.min(region.duration,data.up[upperBound(data.up,end)]?.start??region.duration));};
 const selected=new Set(notes.map(n=>n.id));
 if(v.removePedal&&region.notes.some(n=>channels.has(n.channel??0)&&!selected.has(n.id)&&endFor(n)>n.start+n.duration))throw Error('Other notes on these channels use the pedal. Select them too, or keep pedal events.');
 const edits=notes.flatMap(n=>{const end=endFor(n);if(end<=n.start+n.duration)return [];const duration=end-n.start;if(duration>3600)throw Error('Converted notes cannot exceed one hour. Shorten the region or pedal hold first.');return duration>n.duration?[{id:n.id,duration}]:[];});
 return {edits,removedIds:v.removePedal?(region.events||[]).filter(e=>pedal(e)&&channels.has(e.channel??0)).map(e=>e.id):[],examined:notes.length};
}
const state=settings=>settings.sustainTools??={scope:'region',removePedal:true};
export function sustainLengthsView(settings){const s=state(settings);return `<details class="daw-sustain-lengths"><summary>Sustain pedal to note lengths</summary><form data-sustain-lengths class="button-row"><label>Convert<select name="scope"><option value="region" ${s.scope==='region'?'selected':''}>All notes in region</option><option value="selected" ${s.scope==='selected'?'selected':''}>Selected notes only</option></select></label><label><input type="checkbox" name="removePedal" ${s.removePedal?'checked':''}> Remove converted channels’ pedal events</label><button type="submit">Convert sustain</button></form><output data-sustain-preview></output><p class="muted">Extends notes to their channel’s next pedal release, or the region end if the pedal stays down. Pitch, start, velocity and mute stay unchanged. Removing pedal events requires including every affected note on those channels. Other controllers remain. Keeping pedal events allows them to continue influencing playback. Undo restores note lengths and events.</p></details>`;}
export function bindSustainLengths(root,{region,settings,execute,guard}){
 const form=root.querySelector('[data-sustain-lengths]');if(!form)return;const s=state(settings),button=form.querySelector('button');
 const values=()=>({removePedal:s.removePedal,...(s.scope==='selected'?{noteIds:(settings.selectedIds||[]).join(',')}:{})});
 const update=()=>{s.scope=form.elements.scope.value;s.removePedal=form.elements.removePedal.checked;try{const plan=sustainLengthPlan(region,values());root.querySelector('[data-sustain-preview]').textContent=`${plan.edits.length} notes will be lengthened; ${plan.removedIds.length} pedal events will be removed.`;button.disabled=!plan.edits.length&&!plan.removedIds.length;}catch(e){root.querySelector('[data-sustain-preview]').textContent=e.message;button.disabled=true;}};
 form.onchange=update;form.onsubmit=guard(e=>{e.preventDefault();update();if(!button.disabled)execute([{op:'notes.applySustain',target:region.id,values:values()}],'Converted sustain pedal to note lengths');});update();
}
