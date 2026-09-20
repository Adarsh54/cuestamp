import test from 'node:test';import assert from 'node:assert/strict';import {diatonicNoteEdits} from '../src/experimental/diatonic-transpose.js';import {newSession,SessionHistory} from '../src/experimental/session.js';
const region=pitches=>({notes:pitches.map((pitch,i)=>({id:String(i),pitch}))});
test('scale steps move thirds, octaves, minor and chromatic melodies',()=>{
 const apply=(pitches,values)=>diatonicNoteEdits(region(pitches),{root:0,scale:'major',...values}).map(n=>n.pitch);
 assert.deepEqual(apply([60,62,64,65,67,69,71],{steps:2}),[64,65,67,69,71,72,74]);assert.deepEqual(apply([60,62],{steps:-7}),[48,50]);assert.deepEqual(apply([60,63,67],{steps:2,scale:'minor'}),[63,67,70]);assert.deepEqual(apply([60,61],{steps:2,scale:'chromatic'}),[62,63]);
 assert.deepEqual(apply([61],{steps:2}),[65]);assert.throws(()=>apply([61],{steps:2,accidentals:'reject'}));assert.throws(()=>apply([127],{steps:7}));
});
test('project-key transpose preserves note attributes, selection, undo and atomicity',()=>{
 const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},{op:'note.add',target:'r',values:{id:'n',pitch:60,start:1,duration:2,channel:3,velocity:.4}},{op:'key.set',values:{sharps:-3,mode:'minor'}}]);const before=structuredClone(h.session.tracks[0].regions[0].notes[0]);h.execute([{op:'notes.diatonicTranspose',target:'r',values:{steps:2,useProjectKey:true,noteId:'n'}}]);assert.deepEqual(h.session.tracks[0].regions[0].notes[0],{...before,pitch:63});h.undo();assert.deepEqual(h.session.tracks[0].regions[0].notes[0],before);
 for(const values of [{steps:100,useProjectKey:true},{steps:2,useProjectKey:true,root:0},{steps:2,root:0,scale:'major',noteId:'absent'}])assert.throws(()=>h.execute([{op:'notes.diatonicTranspose',target:'r',values}]));
});
