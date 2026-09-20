import test from 'node:test';import assert from 'node:assert/strict';import {analyzeChord,selectedChordContext} from '../src/experimental/chord-analysis.js';
const notes=pitches=>pitches.map(pitch=>({pitch,start:0,duration:1}));
test('chord identification handles inversion, doubling, spelling and ambiguous roots',()=>{
 const root=analyzeChord(notes([60,64,67,72]));assert.equal(root.candidates[0].label,'C major');assert.equal(root.candidates[0].inversion,0);
 const inversion=analyzeChord(notes([64,67,72]));assert.equal(inversion.candidates[0].label,'C major / E');assert.equal(inversion.candidates[0].inversion,1);
 const augmented=analyzeChord(notes([60,64,68]));assert.equal(augmented.candidates.length,3);assert.ok(augmented.candidates.some(c=>c.root===4));
 assert.equal(analyzeChord(notes([61,65,68]),{sharps:-5,mode:'major'}).candidates[0].label,'D♭ major');assert.equal(analyzeChord(notes([60,61,62])).candidates.length,0);
});
test('analysis distinguishes pitch sets from simultaneous sounding chords',()=>{
 const n=notes([60,64,67]);n[1].start=1;n[2].mute=true;const a=analyzeChord(n);assert.equal(a.simultaneous,false);assert.equal(a.mutedCount,1);assert.equal(a.candidates[0].quality,'major');assert.deepEqual(analyzeChord([]).candidates,[]);assert.throws(()=>analyzeChord(notes([128])));
});
test('agent chord context resolves selected notes across absolute region positions',()=>{
 const session={tracks:[{kind:'midi',regions:[{start:0,notes:[{id:'a',pitch:60,start:0,duration:2}]},{start:3,notes:[{id:'b',pitch:64,start:0,duration:1},{id:'c',pitch:67,start:0,duration:1}]}]}]};
 const a=selectedChordContext(session,['a','b','c']);assert.equal(a.simultaneous,false);assert.equal(a.candidates[0].label,'C major');assert.equal(selectedChordContext(session,['a']),null);
});
