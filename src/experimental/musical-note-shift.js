import {regionBeatTiming} from './tempo-map.js';
// Move both endpoints to retain musical lengths; resize moves only the end.
export function musicalNoteShift(region,session,notes,beats,{resize=false,semitones=0}={}){
 if(!Number.isFinite(beats)||Math.abs(beats)>432000||!Number.isInteger(semitones))throw Error('Use finite beats within the timeline and whole semitones.');
 const clock=regionBeatTiming(region,session),mapped=Boolean(session.tempoChanges?.length),seconds=beats*60/session.tempo;
 return notes.map(note=>{
  const start=resize?note.start:mapped?clock.timeAtBeat(clock.beatAtTime(note.start)+beats):note.start+seconds;
  const end=mapped?clock.timeAtBeat(clock.beatAtTime(note.start+note.duration)+beats):start+note.duration+(resize?seconds:0),duration=end-start,pitch=note.pitch+semitones;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>region.duration+1e-9||duration<=0||duration>3600||end<=start||pitch<0||pitch>127)throw Error('The musical edit would move notes outside the region or create invalid notes.');
  return {...note,start,duration:mapped?duration:note.duration+(resize?seconds:0),pitch};
 });
}
