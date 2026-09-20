import {z} from 'zod';
const channel=z.number().int().min(0).max(15);
const options=z.object({from:channel,to:channel,merge:z.boolean().default(false)}).strict();
export function channelRemapPlan(regions,values){
 const v=options.parse(values);if(v.from===v.to)throw Error('Choose a different destination channel.');
 const notes=regions.flatMap(r=>r.notes).filter(n=>n.channel===v.from),events=regions.flatMap(r=>r.events||[]).filter(e=>e.channel===v.from);
 if(!notes.length&&!events.length)throw Error('The source channel has no notes or events in this scope.');
 const occupied=regions.some(r=>[...r.notes,...(r.events||[])].some(item=>item.channel===v.to));
 if(occupied&&!v.merge)throw Error('The destination channel already has notes or events. Choose another channel or enable merging.');
 return {notes,events,to:v.to,occupied};
}
export function remapMidiChannel(regions,values){const plan=channelRemapPlan(regions,values);for(const item of [...plan.notes,...plan.events])item.channel=plan.to;}
export function channelRemapView(){return `<details class="daw-midi-channel-remap"><summary>Reassign MIDI channel</summary><form data-midi-channel-remap><label>Scope<select name="scope"><option value="region">This region</option><option value="track">All regions on this track</option></select></label><label>From channel<select name="from"></select></label><label>To channel<select name="to">${Array.from({length:16},(_,i)=>`<option value="${i}" ${i===1?'selected':''}>${i+1}</option>`).join('')}</select></label><label><input type="checkbox" name="merge">Merge with an occupied channel</label><output data-channel-remap-preview></output><p class="muted">Moves notes and all associated controllers together, including sustain, pitch bend, RPN, pressure and program changes. Timing and pitches stay unchanged. Merged parts share controller state; other tracks are not reassigned.</p><button>Reassign channel</button></form></details>`;}
export function bindChannelRemap(root,{track,region,execute,guard}){
 const form=root.querySelector('[data-midi-channel-remap]');if(!form||!region||track?.kind!=='midi')return;const f=form.elements,button=form.querySelector('button'),preview=form.querySelector('output');
 const regions=()=>f.scope.value==='track'?track.regions:[region];
 const populate=()=>{const previous=f.from.value,channels=[...new Set(regions().flatMap(r=>[...r.notes,...(r.events||[])]).map(item=>item.channel))].sort((a,b)=>a-b);f.from.innerHTML=channels.map(c=>`<option value="${c}">${c+1}</option>`).join('');if(channels.includes(Number(previous))&&previous!=='')f.from.value=previous;};
 const values=()=>({from:f.from.value===''?NaN:Number(f.from.value),to:Number(f.to.value),merge:f.merge.checked});
 const update=()=>{try{const plan=channelRemapPlan(regions(),values());preview.textContent=`${plan.notes.length} notes and ${plan.events.length} events will move to channel ${plan.to+1}.${plan.occupied?' Destination controller streams will merge.':''}`;button.disabled=false;}catch(error){preview.textContent=error.message;button.disabled=true;}};
 f.scope.onchange=()=>{populate();update();};form.onchange=update;form.onsubmit=guard(event=>{event.preventDefault();update();if(!button.disabled)execute([{op:'midi.remapChannel',target:f.scope.value==='track'?track.id:region.id,values:values()}],'Reassigned MIDI channel');});populate();update();
}
