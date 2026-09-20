import {validateKeySignature} from './key-map.js';

// The project currently stores a single key, so adoption is explicitly limited
// to the source's opening key and never silently transposes the performance.
export function applyMidiImportKey(session,midi,mode='preserve'){
 if(!['preserve','opening'].includes(mode))throw Error('Choose Keep project key or Use file opening key.');
 if(mode==='preserve')return;
 const opening=midi.keySignatures?.find(p=>p.beat===0);
 if(!opening)throw Error('This MIDI file has no opening key signature. Keep the project key or set it manually.');
 session.keySignature=validateKeySignature(opening);
}
