export const DRUM_CHOKE_FADE=.005;
// One built-in kit per track: later open/closed hats stop a ringing open hat.
// Regions may overlap or arrive out of timeline order; muted/silent hits cannot choke.
export function drumChokeLookup(track){
 const hits=track.regions.filter(r=>!r.mute).flatMap(r=>r.notes.filter(n=>!n.mute&&n.velocity>0&&[42,46].includes(n.pitch)).map(n=>({time:r.start+n.start,pitch:n.pitch}))).sort((a,b)=>a.time-b.time);
 const closed=new Set(hits.filter(h=>h.pitch===42).map(h=>h.time));
 return (region,note)=>{
  if(note.pitch!==46)return null;
  const start=region.start+note.start;
  if(closed.has(start))return note.start-DRUM_CHOKE_FADE; // Closed hat wins simultaneous hits.
  let lo=0,hi=hits.length;while(lo<hi){const mid=(lo+hi)>>>1;if(hits[mid].time<=start)lo=mid+1;else hi=mid;}
  return lo<hits.length?hits[lo].time-region.start:null;
 };
}
