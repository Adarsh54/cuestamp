import test from 'node:test';import assert from 'node:assert/strict';import {chordPitches,chordQualities} from '../src/experimental/chords.js';import {analyzeChord} from '../src/experimental/chord-analysis.js';
test('extended chord inversions put the requested tone in the bass and preserve classes',()=>{
 for(const [quality,,intervals] of chordQualities)for(let root=36;root<48;root++)for(let inversion=0;inversion<intervals.length;inversion++){
  const pitches=chordPitches(root,quality,inversion);assert.equal(pitches[0]%12,(root+intervals[inversion])%12);assert.deepEqual([...new Set(pitches.map(p=>p%12))].sort((a,b)=>a-b),[...new Set(intervals.map(i=>(root+i)%12))].sort((a,b)=>a-b));
  const candidate=analyzeChord(pitches.map(pitch=>({pitch,start:0,duration:1}))).candidates.find(c=>c.root===root%12&&c.quality===quality);assert.ok(candidate);assert.equal(candidate.inversion,inversion);
 }
 assert.deepEqual(chordPitches(60,'dominant9',4),[74,76,79,82,84]);assert.deepEqual(chordPitches(60,'major6'),[60,64,67,69]);assert.throws(()=>chordPitches(115,'major13'));
});
test('sixth chords retain their relative-minor seventh interpretation',()=>{
 const a=analyzeChord([60,64,67,69].map(pitch=>({pitch,start:0,duration:1})));assert.ok(a.candidates.some(c=>c.root===0&&c.quality==='major6'));assert.ok(a.candidates.some(c=>c.root===9&&c.quality==='minor7'));
});
