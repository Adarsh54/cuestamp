import test from 'node:test';
import assert from 'node:assert/strict';
import {readMidi,writeMidi} from '../src/experimental/midi.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<.00001,`${a} != ${b}`);
test('MIDI conductor preserves tempo points, marker times and notes across changes',()=>{
 const session={tempo:120,tempoChanges:[{beat:8,bpm:60},{beat:12,bpm:180}],markers:[{name:'Before',time:2},{name:'Change',time:4},{name:'After',time:9}],tracks:[{kind:'midi',name:'Piano',regions:[{start:2,notes:[{pitch:60,start:1,duration:3,velocity:.8},{pitch:64,start:5,duration:2,velocity:.5}],events:[{type:'controlChange',channel:0,parameter:11,value:80,start:4}]}]}]};
 const parsed=readMidi(writeMidi(session).buffer);
 assert.equal(parsed.tempo,120);assert.equal(parsed.tempoChanges.length,2);assert.deepEqual(parsed.tempoChanges[0],{beat:8,bpm:60});assert.equal(parsed.tempoChanges[1].bpm,60000000/333333);
 parsed.markers.forEach((marker,i)=>{assert.equal(marker.name,session.markers[i].name);close(marker.time,session.markers[i].time);});
 const [a,b]=parsed.tracks[0].notes;close(a.start,3);close(a.duration,3);close(b.start,7);close(b.duration,2);close(parsed.tracks[0].events[0].start,6);
});
test('flat MIDI files expose an empty map and reject a zero tempo meta event',()=>{
 const bytes=writeMidi({tempo:120,tracks:[]});assert.deepEqual(readMidi(bytes.buffer).tempoChanges,[]);
 const index=bytes.findIndex((v,i)=>v===255&&bytes[i+1]===81&&bytes[i+2]===3);bytes.fill(0,index+3,index+6);
 assert.throws(()=>readMidi(bytes.buffer),/tempo must be positive/);
});
test('MIDI export rejects unrepresentable delta times instead of wrapping them',()=>{
 assert.throws(()=>writeMidi({tempo:120,tracks:[],markers:[{name:'Far away',time:1e9}]}),/file format limit/);
});
