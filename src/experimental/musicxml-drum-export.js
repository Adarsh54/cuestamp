export function isPercussionRegion(track,region){
 return track.instrument==='drumKit'||Boolean(region.notes.length&&region.notes.every(n=>n.channel===9));
}
// Conventional kit positions for the built-in rows; other MIDI drum mappings
// retain an explicit instrument identity at the middle staff line.
const layout={36:['F',4,'Kick'],38:['C',5,'Snare'],42:['G',5,'Closed hi-hat'],46:['G',5,'Open hi-hat'],44:['D',4,'Pedal hi-hat'],41:['F',4,'Low floor tom'],43:['G',4,'High floor tom'],45:['A',4,'Low tom'],47:['D',5,'Low-mid tom'],48:['E',5,'High-mid tom'],50:['F',5,'High tom'],49:['A',5,'Crash'],51:['F',5,'Ride']};
export function drumNotation(pitch){const [step,octave,name]=layout[pitch]??['B',4,`MIDI drum ${pitch}`];return {step,octave,name,cross:[42,44,46,49,51].includes(pitch)};}
export const drumInstrumentId=(pitch,partId='P1')=>`${partId}-D${pitch}`;
export function drumDefinitions(region,partId='P1'){
 const pitches=[...new Set(region.notes.filter(n=>!n.mute&&n.velocity>0).map(n=>n.pitch))].sort((a,b)=>a-b);
 return pitches.map(p=>`<score-instrument id="${drumInstrumentId(p,partId)}"><instrument-name>${drumNotation(p).name}</instrument-name></score-instrument>`).join('')+pitches.map(p=>`<midi-instrument id="${drumInstrumentId(p,partId)}"><midi-channel>10</midi-channel><midi-unpitched>${p+1}</midi-unpitched></midi-instrument>`).join('');
}
