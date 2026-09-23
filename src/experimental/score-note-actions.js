import {regionBeatTiming} from './tempo-map.js';
export function scoreNoteAction(session,region,note,action){
 if(!note?.id||!region?.notes.some(n=>n.id===note.id))throw Error('Select an existing score note first.');
 if(action==='delete')return {op:'note.delete',target:note.id};
 if(action==='duplicate')return {op:'notes.duplicate',target:region.id,values:{noteIds:note.id,beats:regionBeatTiming(region,session).beatsInDuration(note.start,note.duration)}};
 throw Error('Choose a supported score note action.');
}
export function scoreNoteGroupAction(session,region,noteIds,action){
 if(!Array.isArray(noteIds)||!noteIds.length||new Set(noteIds).size!==noteIds.length)throw Error('Select distinct score notes first.');
 const notes=noteIds.map(id=>region?.notes.find(n=>n.id===id));if(notes.some(n=>!n))throw Error('Select notes in one existing MIDI region.');
 if(action==='delete')return {op:'notes.delete',target:region.id,values:{noteIds:noteIds.join(',')}};
 if(action==='duplicate'){
  const start=Math.min(...notes.map(n=>n.start)),end=Math.max(...notes.map(n=>n.start+n.duration));
  return {op:'notes.duplicate',target:region.id,values:{noteIds:noteIds.join(','),beats:regionBeatTiming(region,session).beatsInDuration(start,end-start)}};
 }
 throw Error('Choose a supported score note action.');
}
