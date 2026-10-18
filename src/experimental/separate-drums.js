import {duplicateTrack} from './duplicate-track.js';
import {drumRows} from './drums.js';
const key=pitch=>[42,44,46].includes(pitch)?42:pitch;
export function drumTrackGroups(track){
 if(track?.kind!=='midi'||track.instrument!=='drumKit')throw Error('Choose a drum-kit track.');
 const pitches=[...new Set(track.regions.flatMap(r=>r.notes.map(n=>key(n.pitch))))].sort((a,b)=>a-b);
 if(!pitches.length)throw Error('Add drum notes before separating this kit.');
 return pitches.map(pitch=>({key:pitch,name:pitch===42?'Hi-hats':drumRows.find(row=>row.pitch===pitch)?.name||`MIDI ${pitch}`}));
}
export function separateDrumTrack(session,track){
 const groups=drumTrackGroups(track);
 if(session.tracks.length+groups.length>128)throw Error('Separating this kit would exceed the 128-track limit.');
 const remap=new Map(track.regions.map(r=>[r.id,[]]));
 const copies=groups.map(group=>{
  // Keep even silent regions so scene loop lengths and clip assignments survive.
  const source={...track,compAlternatives:[],regions:track.regions.map(r=>({...r,notes:r.notes.filter(n=>key(n.pitch)===group.key),events:r.events.filter(e=>e.type!=='polyPressure'||key(e.parameter)===group.key)}))};
  const copy=duplicateTrack(source,{name:`${track.name.slice(0,160)} · ${group.name}`});
  track.regions.forEach((r,i)=>remap.get(r.id).push(copy.regions[i].id));
  return copy;
 });
 for(const scene of session.scenes||[])scene.cells=scene.cells.flatMap(cell=>remap.has(cell.regionId)?remap.get(cell.regionId).map(regionId=>({...cell,regionId})):cell);
 session.tracks.splice(session.tracks.indexOf(track)+1,0,...copies);track.mute=true;
}
export function separateDrumsView(track){
 if(track?.kind!=='midi'||track.instrument!=='drumKit')return '';
 let summary,disabled=false;try{const groups=drumTrackGroups(track);summary=`${groups.length} tracks: ${groups.map(g=>g.name).join(', ')}.`;}catch{summary='Add drum notes to separate this kit.';disabled=true;}
 return `<details class="daw-separate-drums"><summary>Separate drum kit for mixing</summary><p>${summary}</p><p class="muted">Splits the whole track, keeping open, closed and pedal hats together. Copies routing, automation and effects; updates scene clips. The original track stays muted. Separate effects can change the combined sound. Undo restores the kit.</p><button type="button" data-separate-drums ${disabled?'disabled':''}>Separate drum kit</button></details>`;
}
export function bindSeparateDrums(root,{track,execute,guard}){root.querySelector('[data-separate-drums]')?.addEventListener('click',guard(()=>execute([{op:'track.separateDrums',target:track.id}],'Separated drum sounds into mixing tracks. Original kit muted; Undo restores it.')));}
