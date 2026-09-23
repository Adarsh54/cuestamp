import {regionBeatTiming} from './tempo-map.js';
export function scoreNoteAction(session,region,note,action){
 if(!note?.id||!region?.notes.some(n=>n.id===note.id))throw Error('Select an existing score note first.');
 if(action==='delete')return {op:'note.delete',target:note.id};
 if(action==='duplicate')return {op:'notes.duplicate',target:region.id,values:{noteIds:note.id,beats:regionBeatTiming(region,session).beatsInDuration(note.start,note.duration)}};
 throw Error('Choose a supported score note action.');
}
