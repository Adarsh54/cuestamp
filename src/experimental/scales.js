import {projectKeyAtTime} from './key-map.js';
import {z} from 'zod';
import {selectedMidiNotes} from './note-selection.js';
export const scales=[['major','Major',[0,2,4,5,7,9,11]],['minor','Natural minor',[0,2,3,5,7,8,10]],['harmonicMinor','Harmonic minor',[0,2,3,5,7,8,11]],['dorian','Dorian',[0,2,3,5,7,9,10]],['phrygian','Phrygian',[0,1,3,5,7,8,10]],['lydian','Lydian',[0,2,4,6,7,9,11]],['mixolydian','Mixolydian',[0,2,4,5,7,9,10]],['locrian','Locrian',[0,1,3,5,6,8,10]],['majorPentatonic','Major pentatonic',[0,2,4,7,9]],['minorPentatonic','Minor pentatonic',[0,3,5,7,10]],['chromatic','Chromatic',[0,1,2,3,4,5,6,7,8,9,10,11]]];
const options=z.object({root:z.number().int().min(0).max(11).optional(),scale:z.enum([...scales.map(([id])=>id),'custom']).optional(),useProjectKey:z.boolean().default(false),custom:z.string().max(40).optional(),direction:z.enum(['nearest','up','down']).default('nearest'),tie:z.enum(['down','up']).default('down'),noteId:z.string().optional(),noteIds:z.string().max(2020000).optional()}).strict();
export function scaleIntervals(scale,custom){
 if(scale!=='custom'){if(custom!==undefined)throw Error('Custom notes require the Custom scale.');const preset=scales.find(([id])=>id===scale);if(!preset)throw Error('Choose a valid scale.');return preset[2];}
 if(typeof custom!=='string'||!custom.length||custom.length>40)throw Error('Select at least one custom scale note.');
 const parts=custom.split(',');if(parts.some(p=>!/^\d{1,2}$/.test(p)))throw Error('Custom notes must be comma-separated semitone offsets 0–11.');
 const notes=parts.map(Number);if(notes.length>12||notes.some(n=>n>11)||new Set(notes).size!==notes.length)throw Error('Custom scale notes must be distinct offsets from 0 to 11.');return notes.sort((a,b)=>a-b);
}
export function scalePitchClasses(root,scale,custom){const parsed=options.parse({root,scale,custom});if(parsed.root===undefined||parsed.scale===undefined)throw Error('Choose a root and scale.');return new Set(scaleIntervals(parsed.scale,parsed.custom).map(interval=>(interval+root)%12));}
export function scaleNoteEdits(region,values,session){
 const v=options.parse(values);let resolve;
 if(v.useProjectKey){if(v.root!==undefined||v.scale!==undefined||v.custom!==undefined)throw Error('Choose project key or an explicit scale, not both.');resolve=projectKeyAtTime(session);}
 else {if(v.root===undefined||v.scale===undefined)throw Error('Choose a root and scale.');scaleIntervals(v.scale,v.custom);resolve=()=>v;}
 const cache=new Map();
 return selectedMidiNotes(region,v).map(note=>{const key=resolve((region.start??0)+note.start),id=JSON.stringify([key.root,key.scale,key.custom]);let allowed=cache.get(id);if(!allowed){const classes=scalePitchClasses(key.root,key.scale,key.custom);allowed=Array.from({length:128},(_,i)=>i).filter(p=>classes.has(p%12));cache.set(id,allowed);}const candidates=allowed.filter(p=>v.direction==='nearest'||(v.direction==='up'?p>=note.pitch:p<=note.pitch));if(!candidates.length)throw Error('No scale pitch is available in that direction within MIDI 0–127. Choose Nearest or the other direction.');let pitch=candidates[0];for(const p of candidates){const distance=Math.abs(p-note.pitch),best=Math.abs(pitch-note.pitch);if(distance<best||(distance===best&&(v.tie==='up'?p>pitch:p<pitch)))pitch=p;}return {id:note.id,pitch};});
}
