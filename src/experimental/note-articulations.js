import {z} from 'zod';
import {selectedMidiNotes} from './note-selection.js';
export function assignNoteArticulation(track,region,values){
 const v=z.object({id:z.string().min(1).max(100).nullable(),noteIds:z.string().min(1).max(2020000)}).strict().parse(values);
 if(track?.kind!=='midi'||!region)throw Error('Choose a MIDI region.');const notes=selectedMidiNotes(region,{noteIds:v.noteIds}),preset=v.id===null?null:track.midiSwitches?.find(p=>p.id===v.id);if(v.id!==null&&!preset)throw Error('Choose an existing MIDI switch.');
 for(const note of notes){if(preset)note.articulation=structuredClone(preset);else delete note.articulation;}
}
// Inputs are the notes actually sounding at/after a seek, with region-relative onsets.
export function articulationMessages(notes,{end=Infinity}={}){
 const switches=new Map();
 for(const note of notes){const a=note.articulation;if(!a)continue;const key=note.start+':'+a.channel,old=switches.get(key),signature=JSON.stringify([a.type,a.parameter,a.value,a.duration]);if(old&&old.signature!==signature)throw Error('Simultaneous notes request different articulations on the same switch channel.');switches.set(key,{start:note.start,a,signature});}
 const ordered=[...switches.values()].sort((a,b)=>a.start-b.start),messages=[],nextByPitch=new Map(),notesByPitch=new Map();
 for(let i=ordered.length-1;i>=0;i--){const item=ordered[i],a=item.a;if(a.type==='keyswitch'){const key=a.channel+':'+a.parameter;item.nextStart=nextByPitch.get(key)??Infinity;nextByPitch.set(key,item.start);}}
 for(const n of notes){const key=(n.channel??0)+':'+n.pitch;if(!notesByPitch.has(key))notesByPitch.set(key,[]);notesByPitch.get(key).push(n);}
 for(const list of notesByPitch.values()){list.sort((a,b)=>a.start-b.start);let last=-Infinity;for(let i=0;i<list.length;i++){const n=list[i];last=Math.max(last,n.start+n.duration);list[i]={start:n.start,end:last};}}
 const overlaps=(key,start,stop)=>{const list=notesByPitch.get(key)||[];let lo=0,hi=list.length;while(lo<hi){const mid=(lo+hi)>>1;if(list[mid].start<stop)lo=mid+1;else hi=mid;}return lo>0&&list[lo-1].end>start;};
 for(let i=0;i<ordered.length;i++){
  const {start,a}=ordered[i];if(a.type==='keyswitch'){
   const stop=Math.min(end,start+a.duration,ordered[i].nextStart);
   if(overlaps(a.channel+':'+a.parameter,start,stop))throw Error('An articulation keyswitch overlaps a musical note of the same pitch and channel.');
   messages.push({time:start,bytes:[0x90|a.channel,a.parameter,a.value],priority:5.2},{time:stop,noteOnTime:start,bytes:[0x80|a.channel,a.parameter,0],priority:5.1});
  }else messages.push({time:start,bytes:a.type==='programChange'?[0xc0|a.channel,a.value]:[0xb0|a.channel,a.parameter,a.value],priority:5.2});
 }
 return messages;
}
