import {z} from 'zod';
import {selectedMidiNotes} from './note-selection.js';
const options=z.object({rate:z.number().finite().min(.125).max(4).default(.25),gate:z.number().finite().min(.01).max(1).default(.8),order:z.enum(['up','down','upDown','asPlayed']).default('up'),octaves:z.number().int().min(1).max(4).default(1),noteId:z.string().optional(),noteIds:z.string().max(2020000).optional()}).strict();
// Each exact onset/channel is a chord. Restart at its onset and stop at the
// next chosen chord in that channel, its longest note end, or the region end.
export function arpeggioPlan(region,tempo,values={}){
 const v=options.parse(values);if(!Number.isFinite(tempo)||tempo<20||tempo>300)throw Error('Choose a valid project tempo.');
 const chosen=selectedMidiNotes(region,v);if(!chosen.length)throw Error('Add or select notes to arpeggiate.');
 const ids=new Set(chosen.map(n=>n.id)),channels=new Map();
 // Document order, not click order, defines As played for simultaneous notes.
 for(const note of region.notes){if(!ids.has(note.id))continue;const channel=note.channel??0;if(!channels.has(channel))channels.set(channel,new Map());const groups=channels.get(channel);if(!groups.has(note.start))groups.set(note.start,[]);groups.get(note.start).push(note);}
 const interval=v.rate*60/tempo,notes=[],capacity=20000-(region.notes.length-chosen.length);
 for(const groups of channels.values()){
  const starts=[...groups.keys()].sort((a,b)=>a-b);
  for(let g=0;g<starts.length;g++){
   const start=starts[g],source=groups.get(start),end=Math.min(region.duration,starts[g+1]??Infinity,Math.max(...source.map(n=>n.start+n.duration)));
   if(end<=start)throw Error('Chosen notes must start inside the region.');
   let pattern=Array.from({length:v.octaves},(_,octave)=>source.map(n=>({...n,pitch:n.pitch+octave*12}))).flat();
   if(pattern.some(n=>n.pitch>127))throw Error('The octave range exceeds MIDI pitch 127. Lower the range or transpose the chord.');
   if(v.order!=='asPlayed')pattern.sort((a,b)=>a.pitch-b.pitch);
   if(v.order==='down')pattern.reverse();
   if(v.order==='upDown'&&pattern.length>1)pattern=[...pattern,...pattern.toReversed()];
   const count=Math.max(1,Math.ceil((end-start)/interval-1e-10));
   if(notes.length+count>capacity)throw Error('This pattern would exceed the region’s 20,000-note limit. Choose a slower rate or fewer notes.');
   for(let i=0;i<count;i++){const n=pattern[i%pattern.length],onset=start+i*interval,duration=Math.min(interval*v.gate,end-onset);if(duration>0)notes.push({pitch:n.pitch,channel:n.channel??0,velocity:n.velocity,start:onset,duration});}
  }
 }
 return {removedIds:[...ids],notes};
}
const state=settings=>settings.arpeggio??={rate:.25,gate:80,order:'up',octaves:1,scope:'selected'};
export function arpeggioView(settings){const s=state(settings);return `<details class="daw-arpeggio"><summary>Arpeggiate chords</summary><form data-arpeggio-form class="button-row"><label>Apply to<select name="scope"><option value="selected" ${s.scope==='selected'?'selected':''}>Selected notes</option><option value="region" ${s.scope==='region'?'selected':''}>All notes in region</option></select></label><label>Rate<select name="rate">${[[1,'1/4'],[.5,'1/8'],[.25,'1/16'],[.125,'1/32'],[1/3,'1/8 triplet'],[.75,'Dotted 1/8']].map(([v,label])=>`<option value="${v}" ${s.rate===v?'selected':''}>${label}</option>`).join('')}</select></label><label>Order<select name="order">${[['up','Up'],['down','Down'],['upDown','Up / Down'],['asPlayed','As played']].map(([v,label])=>`<option value="${v}" ${s.order===v?'selected':''}>${label}</option>`).join('')}</select></label><label>Octaves<input name="octaves" type="number" min="1" max="4" step="1" value="${s.octaves}" required></label><label>Note length · % of step<input name="gate" type="number" min="1" max="100" step="any" value="${s.gate}" required></label><button>Apply arpeggio</button></form><div data-arpeggio-chart></div><output data-arpeggio-preview></output><p class="muted">Replaces chosen notes with an editable pattern. Notes starting together on the same channel form a chord. Each chord restarts the pattern, ending at its longest note or the next chosen chord. Up / Down repeats endpoints. As played uses the original note order. Unselected notes and controller events stay unchanged. Undo restores the original chords.</p></details>`;}
export function bindArpeggio(root,{region,tempo,settings,execute,guard}){
 const form=root.querySelector('[data-arpeggio-form]');if(!form)return;const s=state(settings),button=form.querySelector('button'),preview=root.querySelector('[data-arpeggio-preview]'),chart=root.querySelector('[data-arpeggio-chart]');
 const values=()=>({rate:s.rate,gate:s.gate/100,order:s.order,octaves:s.octaves,...(s.scope==='selected'?{noteIds:(settings.selectedIds||[]).join(',')}:{})});
 const update=()=>{for(const key of ['rate','gate','octaves'])s[key]=form.elements[key].value===''?NaN:Number(form.elements[key].value);for(const key of ['scope','order'])s[key]=form.elements[key].value;try{if(s.scope==='selected'&&!settings.selectedIds?.length)throw Error('Select notes in the piano roll first.');const plan=arpeggioPlan(region,tempo,values());preview.textContent=`Replace ${plan.removedIds.length} notes with ${plan.notes.length} pattern notes.`;const start=Math.min(...plan.notes.map(n=>n.start)),end=Math.max(...plan.notes.map(n=>n.start+n.duration)),low=Math.min(...plan.notes.map(n=>n.pitch)),high=Math.max(...plan.notes.map(n=>n.pitch));chart.innerHTML=`<svg viewBox="0 0 600 100" role="img" aria-label="Arpeggio note preview" style="width:100%;max-width:600px;height:100px;color:var(--accent)">${plan.notes.slice(0,1000).map(n=>`<rect x="${(n.start-start)/(end-start)*590}" y="${84-(n.pitch-low)/Math.max(1,high-low)*80}" width="${Math.max(1,n.duration/(end-start)*590)}" height="4" fill="currentColor"/>`).join('')}</svg>`;if(plan.notes.length>1000)preview.textContent+=' Preview shows the first 1,000 notes.';button.disabled=false;}catch(e){preview.textContent=e.message;chart.innerHTML='';button.disabled=true;}};
 form.oninput=update;form.onchange=update;form.onsubmit=guard(e=>{e.preventDefault();update();if(!button.disabled)execute([{op:'notes.arpeggiate',target:region.id,values:values()}],'Arpeggiated MIDI notes');});update();
}
