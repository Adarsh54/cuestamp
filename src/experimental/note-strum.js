import {z} from 'zod';
import {selectedMidiNotes} from './note-selection.js';
const options=z.object({direction:z.enum(['up','down']).default('up'),interval:z.number().finite().min(0).max(1).default(.02),tolerance:z.number().finite().min(0).max(.1).default(.01),noteId:z.string().min(1).max(100).optional(),noteIds:z.string().max(2020000).optional()}).strict();
export function strumNotes(region,values){
 const settings=options.parse(values),notes=[...selectedMidiNotes(region,settings)].sort((a,b)=>a.start-b.start||a.pitch-b.pitch||(a.id<b.id?-1:a.id>b.id?1:0)),groups=[];
 // Anchor each cluster at its first onset, avoiding chains that merge separate chords.
 for(const note of notes){const previous=groups.at(-1);if(!previous||note.start-previous[0].start>settings.tolerance+1e-9)groups.push([note]);else previous.push(note);}
 const edits=[];
 for(const group of groups){if(group.length<2)continue;const start=group[0].start;group.sort((a,b)=>(settings.direction==='up'?a.pitch-b.pitch:b.pitch-a.pitch)||a.start-b.start||(a.id<b.id?-1:a.id>b.id?1:0));
  group.forEach((note,index)=>{const next=start+index*settings.interval,end=note.start+note.duration;if(end-next<.001-1e-9)throw Error('Strum spacing exceeds a note ending. Reduce spacing or lengthen the chord first.');edits.push({note,start:next,duration:end-next});});
 }
 for(const edit of edits){edit.note.start=edit.start;edit.note.duration=edit.duration;}
}
