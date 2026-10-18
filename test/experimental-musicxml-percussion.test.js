import test from 'node:test';import assert from 'node:assert/strict';
import {musicxmlPlaybackTracks} from '../src/experimental/musicxml-percussion.js';
import {musicxmlMidi} from '../src/experimental/musicxml-import.js';
import {encodeMidiImport,readMidi} from '../src/experimental/midi.js';
import {SessionHistory} from '../src/experimental/session.js';
const score=()=>({tempos:[],meters:[],keys:[],tracks:[{name:'Mixed',notes:[{pitch:60,start:0,duration:1,velocity:.8},{pitch:36,start:0,duration:.5,velocity:.8,percussion:true},{pitch:38,start:.5,duration:.5,velocity:.7,percussion:true}],events:[]}]});
test('mixed score parts separate pitched notes from drums without source mutation',()=>{
 const s=score(),before=structuredClone(s),tracks=musicxmlPlaybackTracks(s.tracks);
 assert.equal(tracks.length,2);assert.equal(tracks[1].name,'Mixed · Percussion');assert.equal(tracks[1].notes.length,2);assert.deepEqual(s,before);
 const midi=readMidi(musicxmlMidi(s).buffer);assert.equal(midi.tracks.length,2);assert.deepEqual(midi.tracks[1].notes.map(n=>[n.pitch,n.channel]),[[36,9],[38,9]]);assert.equal(midi.tracks[0].notes[0].channel,0);
});
test('percussion import selects a drum instrument and remains undoable',()=>{
 const h=new SessionHistory();h.execute([{op:'midi.import',values:{data:encodeMidiImport(musicxmlMidi(score())),start:0}}]);
 assert.deepEqual(h.session.tracks.map(t=>t.instrument),['triangle','drumKit']);h.undo();assert.equal(h.session.tracks.length,0);
});
test('nested overlapping drum hits preserve each duration in separate editable layers',()=>{
 const s=score();s.tracks[0].notes.push({pitch:36,start:.1,duration:.1,velocity:.8,percussion:true});const before=structuredClone(s);
 const midi=readMidi(musicxmlMidi(s).buffer),drums=midi.tracks.flatMap(t=>t.notes).filter(n=>n.channel===9&&n.pitch===36).sort((a,b)=>a.start-b.start);
 assert.deepEqual(drums.map(n=>[n.start,n.duration]),[[0,.25],[.05,.05]]);
 assert.equal(midi.tracks.length,3);assert.match(midi.tracks[1].name,/Layer 1/);assert.match(midi.tracks[2].name,/Layer 2/);assert.deepEqual(s,before);
 const h=new SessionHistory();h.execute([{op:'midi.import',values:{data:encodeMidiImport(musicxmlMidi(s)),start:0}}]);assert.deepEqual(h.session.tracks.map(t=>t.instrument),['triangle','drumKit','drumKit']);h.undo();assert.equal(h.session.tracks.length,0);
});
test('percussion layers reuse available slots, share different pitches, and honor tick boundaries',()=>{
 const hit=(pitch,start,duration,velocity=.8)=>({pitch,start,duration,velocity,percussion:true});
 const notes=[hit(36,0,2),hit(36,.5,.5),hit(38,.5,1),hit(36,1,.5),hit(36,2,1),hit(36,0,9,0)];
 const layers=musicxmlPlaybackTracks([{name:'Drums',notes}]);assert.equal(layers.length,2);assert.equal(layers.flatMap(t=>t.notes).length,5);
 assert.deepEqual(layers[1].notes.map(n=>n.start),[.5,1]);
 const rounded=musicxmlPlaybackTracks([{name:'Drums',notes:[hit(36,0,1.0001),hit(36,1,1)]}]);assert.equal(rounded.length,1);
});
test('percussion layer expansion rejects above session capacity without modifying input',()=>{
 const notes=Array.from({length:129},()=>({pitch:36,start:0,duration:1,velocity:.8,percussion:true})),tracks=[{name:'Roll',notes}],before=structuredClone(tracks);
 assert.throws(()=>musicxmlPlaybackTracks(tracks),/128-track/);assert.deepEqual(tracks,before);
 const mixed=Array.from({length:65},()=>score().tracks[0]);assert.throws(()=>musicxmlPlaybackTracks(mixed),/128-track/);
});


test('pure percussion keeps its part name and chord hits share the drum channel',()=>{
 const s=score();s.tracks[0].notes=s.tracks[0].notes.filter(n=>n.percussion);s.tracks[0].notes[1].start=0;
 const tracks=musicxmlPlaybackTracks(s.tracks);assert.equal(tracks.length,1);assert.equal(tracks[0].name,'Mixed');
 const imported=readMidi(musicxmlMidi(s).buffer);assert.equal(imported.tracks.length,1);assert.ok(imported.tracks[0].notes.every(n=>n.channel===9&&n.start===0));
});
