import {z} from 'zod';
import {duplicateTrack} from './duplicate-track.js';
const options=z.object({by:z.enum(['pitch','channel']).default('pitch')}).strict();
const pitchName=p=>['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][p%12]+(Math.floor(p/12)-1);
export function midiSeparationGroups(track,region,values={}){
 if(track?.kind!=='midi'||!region||!track.regions.some(r=>r.id===region.id))throw Error('Select a MIDI region to separate.');
 const {by}=options.parse(values),keys=[...new Set(by==='pitch'?region.notes.map(n=>n.pitch):[...region.notes,...region.events].map(e=>e.channel))].sort((a,b)=>a-b);
 if(!keys.length)throw Error(by==='pitch'?'Add notes before separating by pitch.':'Add notes or MIDI events before separating by channel.');
 return keys.map(key=>{
  const notes=region.notes.filter(n=>n[by]===key),channels=new Set(notes.map(n=>n.channel));
  const events=region.events.filter(e=>by==='channel'?e.channel===key:channels.has(e.channel)&&(e.type!=='polyPressure'||e.parameter===key));
  return {key,label:by==='pitch'?`${pitchName(key)} · MIDI ${key}`:`Channel ${key+1}`,notes,events};
 });
}
export function separatedMidiTracks(session,track,region,values){
 const groups=midiSeparationGroups(track,region,values);
 if(session.tracks.length+groups.length>128)throw Error(`Separating creates ${groups.length} tracks and would exceed the 128-track limit.`);
 return groups.map(group=>duplicateTrack({...track,regions:[{...region,name:(region.name.slice(0,170)+' · '+group.label).slice(0,200),notes:group.notes,events:group.events}]},{name:(track.name.slice(0,170)+' · '+group.label).slice(0,200)}));
}
export function separateMidiView(){return `<details class="daw-separate-midi"><summary>Separate MIDI into tracks</summary><form data-separate-midi><label>Separate by<select name="by"><option value="pitch">Note pitch · individual drum sounds</option><option value="channel">MIDI channel · separate parts</option></select></label><output data-separate-preview></output><p class="muted">Creates independent tracks immediately below this track. Keeps timing, instrument, routing, automation and effects. The original region stays here, muted. Copied effects process each part separately, which can change the combined sound.</p><button>Separate MIDI</button></form></details>`;}
export function bindSeparateMidi(root,{session,track,region,execute,guard}){
 const form=root.querySelector('[data-separate-midi]');if(!form)return;const button=form.querySelector('button'),preview=root.querySelector('[data-separate-preview]');
 const update=()=>{try{const groups=midiSeparationGroups(track,region,{by:form.elements.by.value});if(session.tracks.length+groups.length>128)throw Error('This split would exceed the 128-track limit.');preview.textContent=`${groups.length} new tracks: ${groups.map(g=>g.label).join(', ')}. The original region will be muted.`;button.disabled=false;}catch(e){preview.textContent=e.message;button.disabled=true;}};
 form.onchange=update;form.onsubmit=guard(e=>{e.preventDefault();update();if(!button.disabled)execute([{op:'region.separateMidi',target:region.id,values:{by:form.elements.by.value}}],'Separated MIDI into independent tracks; original region muted.');});update();
}
