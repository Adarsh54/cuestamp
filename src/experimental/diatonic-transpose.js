import {z} from 'zod';
import {scales} from './scales.js';
import {selectedMidiNotes} from './note-selection.js';
import {projectKeyScale} from './key-map.js';
const options=z.object({steps:z.number().int().min(-70).max(70),root:z.number().int().min(0).max(11).optional(),scale:z.enum(scales.map(([id])=>id)).optional(),useProjectKey:z.boolean().default(false),accidentals:z.enum(['preserve','reject']).default('preserve'),noteId:z.string().optional(),noteIds:z.string().max(2020000).optional()}).strict();
export function diatonicNoteEdits(region,values,session){
 const v=options.parse(values);let key;
 if(v.useProjectKey){if(v.root!==undefined||v.scale!==undefined)throw Error('Choose project key or an explicit scale, not both.');key=projectKeyScale(session);}
 else {if(v.root===undefined||v.scale===undefined)throw Error('Choose a root and scale.');key=v;}
 const intervals=scales.find(([id])=>id===key.scale)[2],size=intervals.length;
 return selectedMidiNotes(region,v).map(note=>{
  const relative=note.pitch-key.root,octave=Math.floor(relative/12),within=((relative%12)+12)%12,index=intervals.findLastIndex(p=>p<=within),alteration=within-intervals[index];
  if(alteration&&v.accidentals==='reject')throw Error('The selection contains notes outside the chosen scale.');
  const degree=octave*size+index+v.steps,targetOctave=Math.floor(degree/size),targetIndex=((degree%size)+size)%size,pitch=key.root+12*targetOctave+intervals[targetIndex]+alteration;
  if(pitch<0||pitch>127)throw Error('Scale-step transposition exceeds MIDI pitch 0–127.');
  return {id:note.id,pitch};
 });
}
