import test from 'node:test';import assert from 'node:assert/strict';import {scalePitchClasses,scaleNoteEdits} from '../src/experimental/scales.js';import {diatonicNoteEdits} from '../src/experimental/diatonic-transpose.js';
const region={notes:[{id:'n',pitch:61}]};
test('custom scales correct pitches and transpose through the selected offsets',()=>{
 assert.deepEqual([...scalePitchClasses(2,'custom','0,4,7')],[2,6,9]);assert.equal(scaleNoteEdits(region,{root:0,scale:'custom',custom:'0,2,4,6,8,10'})[0].pitch,60);
 assert.equal(diatonicNoteEdits({notes:[{id:'n',pitch:60}]},{root:0,scale:'custom',custom:'0,2,4,6,8,10',steps:2})[0].pitch,64);
 assert.equal(diatonicNoteEdits({notes:[{id:'n',pitch:60}]},{root:0,scale:'custom',custom:'2,7',steps:1})[0].pitch,67);
 assert.equal(diatonicNoteEdits(region,{root:0,scale:'custom',custom:'1',steps:-1})[0].pitch,49);
});
test('custom scales reject malformed or empty definitions and ambiguous inputs',()=>{
 for(const custom of ['', '0,0','12','-1','0,','0,2.5',' '])assert.throws(()=>scalePitchClasses(0,'custom',custom));assert.throws(()=>scalePitchClasses(0,'major','0,2'));
 assert.throws(()=>diatonicNoteEdits(region,{useProjectKey:true,custom:'0,2',steps:1},{keySignature:{sharps:0,mode:'major'}}));
});
