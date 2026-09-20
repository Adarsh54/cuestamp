import {diatonicNoteEdits} from './diatonic-transpose.js';
import {projectKeyScale} from './key-map.js';
import {z} from 'zod';
import {selectedMidiNotes} from './note-selection.js';
import {scales,scaleIntervals} from './scales.js';
const selection={noteId:z.string().optional(),noteIds:z.string().max(2020000).optional()};
const shift=z.number().int().min(-127).max(127);
const options=z.discriminatedUnion('mode',[
 z.object({mode:z.literal('chromatic'),semitones:shift,...selection}).strict(),
 z.object({mode:z.literal('diatonic'),steps:shift,root:z.number().int().min(0).max(11).optional(),scale:z.enum([...scales.map(([id])=>id),'custom']).optional(),custom:z.string().max(40).optional(),useProjectKey:z.boolean().optional(),accidentals:z.enum(['preserve','reject']).default('reject'),...selection}).strict()
]);
export function transposeNoteEdits(region,values,session){
 const v=options.parse({mode:'chromatic',...values}),notes=selectedMidiNotes(region,v);
 if(!notes.length)throw Error('Add or select notes to transpose.');
 if(v.mode==='diatonic'){const {mode,...steps}=v;return diatonicNoteEdits(region,steps,session);}
 return notes.map(n=>{
  const pitch=n.pitch+v.semitones;
  if(!Number.isInteger(pitch)||pitch<0||pitch>127)throw Error('Transposed notes must stay within MIDI 0–127. Use a smaller shift.');
  return {id:n.id,pitch};
 });
}
const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const state=settings=>settings.transposeTools??={scope:'region',mode:'chromatic',amount:0,root:0,scale:'major'};
export function transposeView(settings,session){const s=state(settings);return `<details class="daw-transpose-tools"><summary>Transpose notes</summary><form data-transpose-form class="button-row"><label>Apply to<select name="scope"><option value="region" ${s.scope==='region'?'selected':''}>All notes in region</option><option value="selected" ${s.scope==='selected'?'selected':''}>Selected notes</option></select></label><label>Transpose by<select name="mode"><option value="chromatic" ${s.mode==='chromatic'?'selected':''}>Semitones</option><option value="diatonic" ${s.mode==='diatonic'?'selected':''}>Scale steps</option></select></label><label><span data-transpose-unit>Shift · semitones</span><input name="amount" type="number" min="-127" max="127" step="1" value="${Number.isFinite(s.amount)?s.amount:''}" required></label><label><input type="checkbox" name="followKey" ${s.followKey?'checked':''}>Follow project key changes</label><label data-transpose-key>Key<select name="root">${names.map((name,i)=>`<option value="${i}" ${s.root===i?'selected':''}>${name}</option>`).join('')}</select></label><label data-transpose-key>Scale<select name="scale">${[...scales,['custom','Custom from Key & scale']].map(([id,name])=>`<option value="${id}" ${s.scale===id?'selected':''}>${name}</option>`).join('')}</select></label><label data-transpose-key>Outside-scale notes<select name="accidentals"><option value="reject" ${s.accidentals!=='preserve'?'selected':''}>Reject</option><option value="preserve" ${s.accidentals==='preserve'?'selected':''}>Keep offset above lower scale note</option></select></label><button type="button" data-transpose-project ${session?.keySignature?'':'disabled'}>Load opening key</button><button type="button" data-transpose-current>Use Key &amp; scale choices</button><div class="button-row daw-transpose-actions"><button type="button" data-transpose-octave="-1">− Octave</button><button type="button" data-transpose-octave="1">+ Octave</button><button type="submit">Transpose notes</button></div></form><output data-transpose-preview></output><p class="muted">Follow project key changes uses the key at each note’s onset. Positive shifts raise pitch; negative shifts lower it. One scale step moves to the next note in the chosen scale (C → D in C major). Outside-scale notes can be rejected or retain their semitone offset above the lower scale note. Configure custom notes in Key &amp; scale, then load those choices here. Timing, velocity, channels and controller events stay unchanged. Drum notes also change instrument when transposed.</p></details>`;}
export function bindTranspose(root,{region,settings,session,execute,guard}){
 const form=root.querySelector('[data-transpose-form]');if(!form)return;const f=form.elements,s=state(settings),button=form.querySelector('[type=submit]');
 const values=()=>({...(s.mode==='chromatic'?{semitones:s.amount}:{mode:'diatonic',steps:s.amount,...(s.followKey?{useProjectKey:true}:{root:s.root,scale:s.scale,...(s.scale==='custom'?{custom:s.custom}:{})}),accidentals:s.accidentals??'reject'}),...(s.scope==='selected'?{noteIds:(settings.selectedIds||[]).join(',')}:{})});
 const update=()=>{
  s.followKey=Boolean(f.followKey?.checked);
  for(const key of ['scope','mode','scale','accidentals'])s[key]=f[key].value;s.amount=f.amount.valueAsNumber;s.root=Number(f.root.value);
  const diatonic=s.mode==='diatonic';root.querySelector('[data-transpose-unit]').textContent=diatonic?'Shift · scale steps':'Shift · semitones';
  form.querySelectorAll('[data-transpose-key]').forEach(label=>{label.hidden=!diatonic;label.querySelector('select').disabled=!diatonic;});
  if(f.followKey)f.followKey.disabled=!diatonic;f.root.disabled=!diatonic||s.followKey;f.scale.disabled=!diatonic||s.followKey;
  try{
   if(!Number.isInteger(s.amount)||Math.abs(s.amount)>127)throw Error('Enter a whole-number shift from −127 to 127.');
   if(s.scope==='selected'&&!settings.selectedIds?.length)throw Error('Select notes in the piano roll first.');
   const edits=transposeNoteEdits(region,values(),session),original=new Map(region.notes.map(n=>[n.id,n.pitch])),changed=edits.filter(e=>e.pitch!==original.get(e.id)).length;
   root.querySelector('[data-transpose-preview]').textContent=`${changed} of ${edits.length} notes will change pitch.`;button.disabled=!changed;
  }catch(e){root.querySelector('[data-transpose-preview]').textContent=e.message;button.disabled=true;}
 };
 const load=key=>{if(f.followKey)f.followKey.checked=false;f.mode.value='diatonic';f.root.value=key.root;f.scale.value=key.scale;s.custom=key.custom;update();};
 form.querySelector('[data-transpose-project]').onclick=guard(()=>load(projectKeyScale(session)));
 form.querySelector('[data-transpose-current]').onclick=guard(()=>{const key=settings.scaleTools??{root:0,scale:'major'};load(key);});
 form.oninput=update;form.onchange=update;
 form.querySelectorAll('[data-transpose-octave]').forEach(button=>button.onclick=guard(()=>{f.amount.value=Number(button.dataset.transposeOctave)*(s.mode==='chromatic'?12:s.followKey?7:scaleIntervals(s.scale,s.scale==='custom'?s.custom:undefined).length);update();}));
 form.onsubmit=guard(e=>{e.preventDefault();update();if(!button.disabled)execute([{op:'notes.transpose',target:region.id,values:values()}],'Transposed MIDI notes');});update();
}
