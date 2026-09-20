import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {tempoRampPlan} from '../src/experimental/tempo-ramp.js';
import {compileTempoMap} from '../src/experimental/tempo-map.js';
import {writeMidi,readMidi} from '../src/experimental/midi.js';
const values={startBeat:0,endBeat:16,fromBpm:120,toBpm:60,step:1};
test('tempo curves produce explicit hold points with selectable easing and exact boundaries',()=>{
 for(const curve of ['linear','easeIn','easeOut','easeInOut']){
  const plan=tempoRampPlan(newSession(),{...values,curve}),map=compileTempoMap(plan);assert.equal(plan.tempo,120);assert.equal(plan.tempoChanges.length,16);assert.equal(map.tempoAtBeat(16),60);assert.equal(map.tempoAtBeat(20),60);
  const expected=curve==='easeIn'?116.25:curve==='easeOut'?93.75:curve==='easeInOut'?110.625:105;assert.equal(map.tempoAtBeat(4),expected);assert.equal(map.tempoAtBeat(4.5),expected);
  for(let beat=0;beat<24;beat+=.13)assert.ok(Math.abs(map.beatAtTime(map.timeAtBeat(beat))-beat)<1e-10);
 }
});
test('curve replacement preserves earlier/later tempo points and can restore the original end tempo',()=>{
 const source=applyCommands(newSession(),[{op:'tempo.add',values:{id:'before',beat:2,bpm:100}},{op:'tempo.add',values:{id:'inside',beat:6,bpm:90}},{op:'tempo.add',values:{id:'after',beat:20,bpm:150}}]);
 const plan=tempoRampPlan(source,{...values,startBeat:4,endBeat:12,continueAfter:false});assert.equal(plan.tempo,120);assert.equal(plan.tempoChanges[0].id,'before');assert.equal(plan.tempoChanges.at(-1).id,'after');assert.equal(compileTempoMap(plan).tempoAtBeat(12),90);assert.equal(compileTempoMap(plan).tempoAtBeat(20),150);
});
test('tempo curve commands preserve MIDI beats and fixed audio positions, export and undo',()=>{
 const h=new SessionHistory(applyCommands(newSession(),[{op:'track.add',values:{id:'m',kind:'midi'}},{op:'region.add',target:'m',values:{id:'r',start:2,duration:6}},{op:'note.add',target:'r',values:{id:'n',pitch:60,start:1,duration:2}},{op:'event.add',target:'r',values:{type:'controlChange',parameter:11,value:70,start:3}},{op:'track.add',values:{id:'a',kind:'audio'}},{op:'region.add',target:'a',values:{id:'audio',start:2,duration:6}}]));const before=structuredClone(h.session);
 h.execute([{op:'tempo.ramp',values}]);const map=compileTempoMap(h.session),r=h.session.tracks[0].regions[0];assert.ok(Math.abs(map.beatAtTime(r.start+r.notes[0].start)-6)<1e-10);assert.ok(Math.abs(map.beatAtTime(r.start+r.notes[0].start+r.notes[0].duration)-10)<1e-10);assert.equal(h.session.tracks[1].regions[0].start,2);assert.ok(Math.abs(map.beatAtTime(r.start+r.events[0].start)-10)<1e-10);
 const midi=readMidi(writeMidi(h.session).buffer);assert.equal(midi.tempoChanges.length,16);assert.ok(Math.abs(midi.tracks[0].notes[0].start-(r.start+r.notes[0].start))<.00001);
 h.undo();assert.deepEqual(h.session,{...before,revision:h.session.revision});
});
test('invalid tempo ranges and excessive density leave the session unchanged',()=>{
 const h=new SessionHistory(newSession()),before=structuredClone(h.session);for(const patch of [{endBeat:0},{step:0},{step:.001},{toBpm:301},{endBeat:432000,step:432000}]){assert.throws(()=>h.execute([{op:'tempo.ramp',values:{...values,...patch}}]));assert.deepEqual(h.session,before);}
});
