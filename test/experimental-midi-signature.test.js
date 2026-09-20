import test from 'node:test';import assert from 'node:assert/strict';
import {readMidi,writeMidi} from '../src/experimental/midi.js';
const smf=events=>Uint8Array.from([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,0,0,0,events.length,...events]).buffer;
test('MIDI exports encode the actual quarter-note meter in the conductor track',()=>{
 for(const meter of [1,3,4,7,16]){
  const bytes=writeMidi({tempo:120,meter,tracks:[]});
  assert.deepEqual([...bytes.slice(22,30)],[0,255,88,4,meter,2,24,8]);
  assert.deepEqual(readMidi(bytes.buffer).timeSignatures,[{numerator:meter,denominator:4,clocksPerClick:24,notated32ndsPerQuarter:8,beat:0,time:0}]);
 }
 assert.equal(readMidi(writeMidi({tempo:120,tracks:[]}).buffer).timeSignatures[0].numerator,4);
 for(const meter of [0,17,3.5,NaN])assert.throws(()=>writeMidi({tempo:120,meter,tracks:[]}));
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
