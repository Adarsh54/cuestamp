// MusicXML percentages are relative to MIDI forte velocity 90, not velocity 127.
export function musicxmlDynamics(value){
 const n=Number(value);if(typeof value!=='string'||!value.trim()||!Number.isFinite(n)||n<0)throw Error('MusicXML dynamics must be a nonnegative percentage.');
 return Math.min(1,n*.9/127);
}
export function applyMusicxmlDynamics(notes,points){
 const ordered=[...points].sort((a,b)=>a.start-b.start);
 for(const note of notes){
  if(!note.explicitVelocity){let lo=0,hi=ordered.length;while(lo<hi){const mid=(lo+hi)>>>1;if(ordered[mid].start<=note.start)lo=mid+1;else hi=mid;}note.velocity=lo?ordered[lo-1].velocity:.8;}
  delete note.explicitVelocity;
 }
}
