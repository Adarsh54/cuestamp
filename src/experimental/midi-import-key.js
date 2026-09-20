import {validateKeySignature,compileKeyMap} from './key-map.js';
import {compileTempoMap} from './tempo-map.js';

// Called after tempo adoption so seconds and beat-following modes match notes.
export function applyMidiImportKey(session,midi,mode='preserve',start=0,tempoMode='performance'){
 if(!['preserve','opening','adopt'].includes(mode))throw Error('Choose Keep project key, Use file opening key or Use file key changes.');
 if(mode==='preserve')return;
 if(mode==='opening'){
  const opening=midi.keySignatures?.find(p=>p.beat===0);
  if(!opening)throw Error('This MIDI file has no opening key signature. Keep the project key or set it manually.');
  session.keySignature=validateKeySignature(opening);return;
 }
 if(!midi.keySignatures?.length)throw Error('This MIDI file has no key signatures to adopt.');
 const destination=compileTempoMap(session),source=compileTempoMap(midi),origin=destination.beatAtTime(start);
 const imported=midi.keySignatures.map(p=>({id:crypto.randomUUID(),beat:tempoMode==='follow'?origin+p.beat:destination.beatAtTime(start+source.timeAtBeat(p.beat)),...validateKeySignature(p)})).sort((a,b)=>a.beat-b.beat);
 const first=imported[0].beat;
 const opening=imported.find(p=>p.beat===0);
 const next={...session,keySignature:opening?validateKeySignature(opening):session.keySignature,keyChanges:[...(session.keyChanges||[]).filter(p=>p.beat<first),...imported.filter(p=>p.beat>0)]};
 const keys=compileKeyMap(next);if(keys.points.some(p=>destination.timeAtBeat(p.beat)>86400))throw Error('Imported key changes exceed the 24-hour timeline.');
 session.keySignature=next.keySignature;session.keyChanges=next.keyChanges;
}
