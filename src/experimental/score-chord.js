import {compileTempoMap} from './tempo-map.js';
import {compileKeyMap} from './key-map.js';
import {scorePitchStep} from './score-pitch-drag.js';
// A chord draft is local UI state. It never inserts a note until the user applies it.
export function scoreChordDraft(session,region,note){
 const source=region?.notes.find(n=>n.id===note?.id);
 if(!source)throw Error('Select an existing score note first.');
 const key=compileKeyMap(session).keyAtBeat(compileTempoMap(session).beatAtTime(region.start+source.start));
 let pitch;try{pitch=scorePitchStep(source.pitch,2,key);}catch{pitch=scorePitchStep(source.pitch,-2,key);}
 const {id,...values}=source;
 return {regionId:region.id,chord:true,note:{...values,pitch}};
}
export function scoreChordCommand(region,draft,values){
 const note={...draft,...values,id:crypto.randomUUID()};
 if(region.notes.some(n=>n.pitch===note.pitch&&Math.abs(n.start-note.start)<1e-9&&Math.abs(n.duration-note.duration)<1e-9))throw Error('That pitch is already in this chord. Choose another pitch.');
 return {op:'notes.addMany',target:region.id,values:{notes:JSON.stringify([note])}};
}
