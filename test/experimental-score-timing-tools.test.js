import test from 'node:test';import assert from 'node:assert/strict';
import {SessionHistory} from '../src/experimental/session.js';import {scoreTimingCommand} from '../src/experimental/score-timing-tools.js';
const setup=()=>{const h=new SessionHistory();h.execute([{op:'tempo.add',values:{beat:8,bpm:60}},{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',start:4,duration:8}},{op:'note.add',target:'r',values:{id:'a',pitch:60,start:.3,duration:.25,velocity:.7}},{op:'note.add',target:'r',values:{id:'b',pitch:64,start:1.3,duration:.25,velocity:.8}},{op:'note.add',target:'r',values:{id:'c',pitch:67,start:2.3,duration:.25,velocity:.9}}]);return h;};
test('score quantize respects destination tempo, selected notes, strength and swing without mutating before execution',()=>{
 const h=setup(),r=h.session.tracks[0].regions[0],before=structuredClone(r),command=scoreTimingCommand(h.session,r,['a','b'],'quantize',{grid:.5,strength:.5,swing:.5});assert.deepEqual(r,before);h.execute([command]);const after=h.session.tracks[0].regions[0];assert.ok(Math.abs(after.notes[0].start-.15)<1e-9);assert.ok(Math.abs(after.notes[1].start-1.15)<1e-9);assert.deepEqual(after.notes[2],before.notes[2]);assert.equal(after.notes[0].duration,.25);h.undo();assert.deepEqual(h.session.tracks[0].regions[0],before);
});
test('score humanize is reproducible after Undo and preserves unselected notes',()=>{
 const h=setup(),r=h.session.tracks[0].regions[0],command=scoreTimingCommand(h.session,r,['a','b'],'humanize',{timing:.02,duration:.01,velocity:.05,seed:123});h.execute([command]);const first=structuredClone(h.session.tracks[0].regions[0]);assert.deepEqual(first.notes[2],r.notes[2]);assert.ok(Math.abs(first.notes[0].start-r.notes[0].start)<=.02);h.undo();h.execute([command]);assert.deepEqual(h.session.tracks[0].regions[0],first);
});
test('score timing rejects missing selection and invalid parameters',()=>{
 const h=setup(),r=h.session.tracks[0].regions[0];for(const ids of [[],['missing'],['a','a']])assert.throws(()=>scoreTimingCommand(h.session,r,ids,'quantize',{grid:.25}));
 for(const options of [{grid:0},{grid:.25,strength:1.1},{grid:.25,swing:-1}])assert.throws(()=>scoreTimingCommand(h.session,r,['a'],'quantize',options));
 assert.throws(()=>scoreTimingCommand(h.session,r,['a'],'humanize',{timing:2,seed:1}));assert.throws(()=>scoreTimingCommand(h.session,r,['a'],'humanize',{seed:1.5}));
});
