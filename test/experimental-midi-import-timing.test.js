import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {writeMidi,encodeMidiImport} from '../src/experimental/midi.js';
import {compileTempoMap} from '../src/experimental/tempo-map.js';
const source=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'source',kind:'midi'}},{op:'region.add',target:'source',values:{id:'phrase',duration:8}},{op:'note.add',target:'phrase',values:{start:3,duration:2}},{op:'marker.add',values:{name:'Hit',time:5}},{op:'tempo.add',values:{beat:8,bpm:60}}]);
const base=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'existing',kind:'midi'}},{op:'region.add',target:'existing',values:{id:'existingRegion',start:4,duration:4}},{op:'track.add',values:{id:'audio',kind:'audio'}},{op:'region.add',target:'audio',values:{duration:9}}]);
const cmd=(tempoMode,start=0)=>({op:'midi.import',values:{data:encodeMidiImport(writeMidi(source()).buffer),start,...(tempoMode?{tempoMode}:{})}});
test('default preserves performance; following tempo preserves musical endpoints and marker beats',()=>{
 const performance=applyCommands(base(),[cmd(undefined,2)]),follow=applyCommands(base(),[cmd('follow',2)]);
 const a=performance.tracks.at(-1).regions[0],b=follow.tracks.at(-1).regions[0];
 assert.deepEqual([a.start,a.notes[0].start,a.notes[0].duration],[2,3,3]);
 assert.deepEqual([b.start,b.notes[0].start,b.notes[0].duration],[2,3,2]);
 assert.equal(performance.markers[0].time,7);assert.equal(follow.markers[0].time,6.5);
 assert.deepEqual(follow.tempoChanges,[]);assert.deepEqual(follow.tracks[0],base().tracks[0]);
});
test('adoption at playhead preserves prior tempo, replaces following points and retimes existing MIDI once',()=>{
 const initial=applyCommands(base(),[{op:'tempo.add',values:{id:'old',beat:6,bpm:90}},{op:'tempo.add',values:{id:'later',beat:24,bpm:240}}]);
 const history=new SessionHistory(initial),old=compileTempoMap(initial),oldRegion=initial.tracks[0].regions[0],beats=[old.beatAtTime(oldRegion.start),old.beatAtTime(oldRegion.start+oldRegion.duration)];
 history.execute([cmd('adopt',4)]);const s=history.session,map=compileTempoMap(s),r=s.tracks[0].regions[0];
 assert.equal(map.tempoAtTime(3.5),90);assert.equal(map.tempoAtTime(4),120);assert.equal(map.tempoAtTime(8),60);
 assert.equal(s.tempoChanges.some(p=>p.id==='later'),false);assert.ok(s.tempoChanges.some(p=>p.id==='old'));
 assert.deepEqual([map.beatAtTime(r.start),map.beatAtTime(r.start+r.duration)],beats);
 assert.deepEqual(s.tracks[1],initial.tracks[1]);assert.equal(s.tracks.at(-1).regions[0].start,4);
 history.undo();assert.deepEqual(history.session.tracks,initial.tracks);assert.deepEqual(history.session.tempoChanges,initial.tempoChanges);
});
test('adoption at zero replaces the base tempo and survives serialization',()=>{
 const src=source();src.tempo=100;
 const s=applyCommands(base(),[{op:'midi.import',values:{data:encodeMidiImport(writeMidi(src).buffer),tempoMode:'adopt'}}]);
 assert.equal(s.tempo,100);const restored=new SessionHistory(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored.session.tempoChanges,s.tempoChanges);
});
test('invalid modes, overflow and protected retiming reject atomically',()=>{
 const s=base(),copy=structuredClone(s);
 assert.throws(()=>applyCommands(s,[cmd('invalid')]));
 assert.throws(()=>applyCommands(s,[cmd('performance',86399)]),/24-hour/);
 assert.throws(()=>applyCommands(s,[{op:'track.set',target:'existing',values:{protected:true}},cmd('adopt')]),/Unprotect/);
 assert.deepEqual(s,copy);
});
test('follow mode maps into a changing destination tempo at an offbeat playhead',()=>{
 const src=source();src.tracks[0].regions[0].events=[{id:'cc',type:'controlChange',parameter:11,value:80,channel:0,start:5}];
 const dest=applyCommands(base(),[{op:'tempo.add',values:{beat:4,bpm:90}},{op:'tempo.add',values:{beat:12,bpm:180}}]),start=2.5;
 const result=applyCommands(dest,[{op:'midi.import',values:{data:encodeMidiImport(writeMidi(src).buffer),start,tempoMode:'follow'}}]);
 const from=compileTempoMap(src),to=compileTempoMap(dest),origin=to.beatAtTime(start),a=src.tracks[0].regions[0],b=result.tracks.at(-1).regions[0],same=(x,y)=>assert.ok(Math.abs(x-y)<.005);
 same(to.beatAtTime(b.start+b.notes[0].start)-origin,from.beatAtTime(a.notes[0].start));
 same(to.beatAtTime(b.start+b.notes[0].start+b.notes[0].duration)-origin,from.beatAtTime(a.notes[0].start+a.notes[0].duration));
 same(to.beatAtTime(b.start+b.events[0].start)-origin,from.beatAtTime(a.events[0].start));
 assert.deepEqual(result.tempoChanges,dest.tempoChanges);
});
