import test from 'node:test';import assert from 'node:assert/strict';
import {readMidi,writeMidi} from '../src/experimental/midi.js';
const smf=events=>Uint8Array.from([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,0,0,0,events.length,...events]).buffer;
test('MIDI exports encode the actual quarter-note meter in the conductor track',()=>{
 for(const meter of [1,3,4,7,16,32]){
  const bytes=writeMidi({tempo:120,meter,tracks:[]});
  assert.deepEqual([...bytes.slice(22,30)],[0,255,88,4,meter,2,24,8]);
  assert.deepEqual(readMidi(bytes.buffer).timeSignatures,[{numerator:meter,denominator:4,clocksPerClick:24,notated32ndsPerQuarter:8,beat:0,time:0}]);
 }
 assert.equal(readMidi(writeMidi({tempo:120,tracks:[]}).buffer).timeSignatures[0].numerator,4);
 for(const meter of [0,33,3.5,NaN])assert.throws(()=>writeMidi({tempo:120,meter,tracks:[]}));
});
test('signature decoding preserves compound meters, changing signatures and last same-tick event',()=>{
 const events=[0,255,88,4,4,2,24,8,0,255,88,4,6,3,36,8,0x83,0x60,255,81,3,15,66,64,0x83,0x60,255,88,4,7,3,12,8,0,255,47,0];
 const midi=readMidi(smf(events));
 assert.deepEqual(midi.timeSignatures,[{numerator:6,denominator:8,clocksPerClick:36,notated32ndsPerQuarter:8,beat:0,time:0},{numerator:7,denominator:8,clocksPerClick:12,notated32ndsPerQuarter:8,beat:2,time:1.5}]);
});
test('malformed signature events reject and files without signatures remain valid',()=>{
 for(const events of [[0,255,88,3,4,2,24],[0,255,88,4,0,2,24,8],[0,255,88,4,4,31,24,8],[0,255,88,4,4,2,24,0]])assert.throws(()=>readMidi(smf([...events,0,255,47,0])),/signature/);
 assert.deepEqual(readMidi(smf([0,255,47,0])).timeSignatures,[]);
});
test('changing signatures export at musical bar boundaries alongside tempo changes and roundtrip',async()=>{
 const {meterFromMidi}=await import('../src/experimental/midi-meter-map.js'),{compileMeterMap}=await import('../src/experimental/meter-map.js');
 const s={tempo:120,meter:4,meterChanges:[{bar:3,numerator:6,denominator:8},{bar:5,numerator:7,denominator:4}],tempoChanges:[{beat:8,bpm:60}],tracks:[]},decoded=readMidi(writeMidi(s).buffer);
 assert.deepEqual(decoded.timeSignatures.map(p=>[p.beat,p.time,p.numerator,p.denominator]),[[0,0,4,4],[8,4,6,8],[14,10,7,4]]);
 const restored=meterFromMidi(decoded.timeSignatures);assert.deepEqual(compileMeterMap(restored).points.map(({id,...p})=>p),compileMeterMap(s).points);
 assert.throws(()=>writeMidi({...s,tempo:20,tempoChanges:[],meterChanges:[{bar:10000,numerator:3,denominator:4}]}),/24-hour/);
});
test('signature adoption conversion rejects mid-bar changes and unusual notation rather than rounding',async()=>{
 const {meterFromMidi}=await import('../src/experimental/midi-meter-map.js');
 assert.deepEqual(meterFromMidi([]),{meter:4,meterDenominator:4,meterChanges:[]});
 assert.equal(meterFromMidi([{beat:8,numerator:3,denominator:4}]).meterChanges[0].bar,3);
 assert.throws(()=>meterFromMidi([{beat:3,numerator:3,denominator:4}]),/inside a bar/);
 assert.throws(()=>meterFromMidi([{beat:0,numerator:4,denominator:4,notated32ndsPerQuarter:16}]),/notation/);
 const s=meterFromMidi([{beat:0,numerator:3,denominator:4},{beat:0,numerator:6,denominator:8},{beat:1,numerator:6,denominator:8},{beat:6,numerator:4,denominator:4}]);
 assert.equal(s.meter,6);assert.equal(s.meterChanges[0].bar,3);
});
