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
test('overlapping same-pitch drum gates reject instead of corrupting MIDI note pairing',()=>{
 const s=score();s.tracks[0].notes.push({pitch:36,start:.1,duration:.1,velocity:.8,percussion:true});assert.throws(()=>musicxmlMidi(s),/Overlapping/);
});

test('pure percussion keeps its part name and chord hits share the drum channel',()=>{
 const s=score();s.tracks[0].notes=s.tracks[0].notes.filter(n=>n.percussion);s.tracks[0].notes[1].start=0;
 const tracks=musicxmlPlaybackTracks(s.tracks);assert.equal(tracks.length,1);assert.equal(tracks[0].name,'Mixed');
 const imported=readMidi(musicxmlMidi(s).buffer);assert.equal(imported.tracks.length,1);assert.ok(imported.tracks[0].notes.every(n=>n.channel===9&&n.start===0));
});
