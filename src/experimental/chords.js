import {z} from 'zod';
export const chordQualities=[
 ['major','Major',[0,4,7]],['minor','Minor',[0,3,7]],['diminished','Diminished',[0,3,6]],['augmented','Augmented',[0,4,8]],
 ['sus2','Suspended 2',[0,2,7]],['sus4','Suspended 4',[0,5,7]],['major7','Major 7',[0,4,7,11]],['minor7','Minor 7',[0,3,7,10]],
 ['dominant7','Dominant 7',[0,4,7,10]],['halfDiminished7','Half-diminished 7',[0,3,6,10]],['diminished7','Diminished 7',[0,3,6,9]],['power','Power fifth',[0,7]],
 ['major6','Major 6',[0,4,7,9]],['minor6','Minor 6',[0,3,7,9]],['minorMajor7','Minor major 7',[0,3,7,11]],
 ['add9','Add 9',[0,4,7,14]],['minorAdd9','Minor add 9',[0,3,7,14]],
 ['dominant9','Dominant 9',[0,4,7,10,14]],['major9','Major 9',[0,4,7,11,14]],['minor9','Minor 9',[0,3,7,10,14]],
 ['dominant11','Dominant 11',[0,4,7,10,14,17]],['minor11','Minor 11',[0,3,7,10,14,17]],
 ['dominant13','Dominant 13',[0,4,7,10,14,17,21]],['major13','Major 13',[0,4,7,11,14,17,21]],['minor13','Minor 13',[0,3,7,10,14,17,21]]
];
export function chordPitches(root,quality,inversion=0){
 const chord=chordQualities.find(([id])=>id===quality);
 if(!chord||!Number.isInteger(root)||root<0||root>127)throw Error('Choose a valid chord type and MIDI root (0–127).');
 if(!Number.isInteger(inversion)||inversion<0||inversion>=chord[2].length)throw Error('Choose an inversion available for this chord.');
 const bass=chord[2][inversion];
 const pitches=chord[2].map((interval,i)=>{if(i<inversion)while(interval<bass)interval+=12;return root+interval;}).sort((a,b)=>a-b);
 if(pitches.some(p=>p>127))throw Error('This chord exceeds MIDI pitch 127. Lower its octave or inversion.');
 return pitches;
}
const chordSchema=z.object({root:z.number().int().min(0).max(127),quality:z.string(),inversion:z.number().int().min(0).default(0),start:z.number().finite().nonnegative(),duration:z.number().finite().positive().max(3600),velocity:z.number().finite().min(0).max(1).default(.8),channel:z.number().int().min(0).max(15).default(0)}).strict();
export function createChordNotes(region,values){
 const v=chordSchema.parse(values),pitches=chordPitches(v.root,v.quality,v.inversion);
 if(v.start+v.duration>region.duration+1e-9)throw Error('The chord must fit inside the MIDI region. Extend the region or shorten the chord.');
 if(region.notes.length+pitches.length>20000)throw Error('This chord would exceed the region’s 20,000-note limit.');
 return pitches.map(pitch=>({id:crypto.randomUUID(),pitch,start:v.start,duration:v.duration,velocity:v.velocity,channel:v.channel}));
}
