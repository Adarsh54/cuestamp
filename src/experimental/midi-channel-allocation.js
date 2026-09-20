const items=track=>track.regions.flatMap(r=>[...r.notes,...(r.events||[])]);
export function midiChannelAllocation(session){
 const tracks=session.tracks.filter(t=>t.kind==='midi'),reserved=new Set([9]);
 for(const t of tracks.filter(t=>t.instrument==='drumKit'))for(const item of items(t))reserved.add(item.channel);
 const groups=tracks.filter(t=>t.instrument!=='drumKit').flatMap(track=>[...new Set(items(track).map(item=>item.channel))].sort((a,b)=>a-b).map(from=>({trackId:track.id,name:track.name,from,to:null,protected:Boolean(track.protected)})));
 const used=new Set(reserved);
 for(const group of groups.filter(g=>g.protected)){
  if(used.has(group.from))throw Error('A protected instrument shares a reserved or protected MIDI channel. Reassign or unprotect it first.');
  group.to=group.from;used.add(group.to);
 }
 // Preserve distinct existing assignments before distributing collisions.
 for(const group of groups.filter(g=>!g.protected))if(!used.has(group.from)){group.to=group.from;used.add(group.to);}
 for(const group of groups.filter(g=>g.to===null)){
  const free=Array.from({length:16},(_,i)=>i).find(c=>!used.has(c));
  if(free===undefined)throw Error(`This session needs ${groups.length} independent instrument channels, but only ${16-reserved.size} are available after drum reservations. Export separate groups or combine parts explicitly.`);
  group.to=free;used.add(free);
 }
 return groups;
}
export function allocateMidiChannels(session){
 const plan=midiChannelAllocation(session),byTrack=new Map();
 for(const group of plan){if(!byTrack.has(group.trackId))byTrack.set(group.trackId,new Map());byTrack.get(group.trackId).set(group.from,group.to);}
 for(const track of session.tracks){const map=byTrack.get(track.id);if(map)for(const item of items(track))item.channel=map.get(item.channel);}
 return plan;
}
export function channelAllocationView(session,esc){
 if(!session.tracks.some(t=>t.kind==='midi'))return '';
 let content;try{const plan=midiChannelAllocation(session),changed=plan.filter(p=>p.from!==p.to);content=changed.length?`<ul>${changed.map(p=>`<li>${esc(p.name)} · Channel ${p.from+1} → ${p.to+1}</li>`).join('')}</ul><button type="button" data-allocate-midi-channels>Assign independent channels</button>`:'<p class="muted">Instrument parts already use independent channels.</p>';}catch(error){content=`<p role="status">${esc(error.message)}</p>`;}
 return `<details class="daw-midi-channel-allocation"><summary>Organize MIDI channels for export</summary>${content}<p class="muted">Each original channel on each instrument track gets an independent channel, including muted parts and controller-only streams. Drum tracks stay unchanged; their channels and channel 10 are reserved. Protected tracks stay on their current channels. Notes and controllers move together in one undo step.</p></details>`;
}
export function bindChannelAllocation(root,{execute,guard}){root.querySelector('[data-allocate-midi-channels]')?.addEventListener('click',guard(()=>execute([{op:'midi.allocateChannels'}],'Assigned independent MIDI channels')));}
