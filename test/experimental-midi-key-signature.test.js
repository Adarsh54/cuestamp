import test from 'node:test';import assert from 'node:assert/strict';
import {writeMidi,readMidi} from '../src/experimental/midi.js';
import {compileKeyMap,keySignatureName} from '../src/experimental/key-map.js';
const base={tempo:120,meter:4,tracks:[],markers:[]};
test('all standard major/minor signatures survive MIDI signed-byte encoding',()=>{
 for(let sharps=-7;sharps<=7;sharps++)for(const mode of ['major','minor']){
  const result=readMidi(writeMidi({...base,keySignature:{sharps,mode}}).buffer);assert.deepEqual(result.keySignatures,[{sharps,mode,beat:0,time:0}]);
 }
 assert.equal(keySignatureName({sharps:-7,mode:'major'}),'Cb major');assert.equal(keySignatureName({sharps:0,mode:'minor'}),'A minor');
});
test('key changes use musical timing across a tempo map without inferred defaults',()=>{
 const session={...base,tempoChanges:[{beat:4,bpm:60}],keyChanges:[{beat:8,sharps:-3,mode:'minor'}]},map=compileKeyMap(session);
 assert.equal(map.keyAtBeat(0),null);assert.equal(map.keyAtBeat(8).mode,'minor');assert.equal(readMidi(writeMidi(base).buffer).keySignatures.length,0);
 assert.deepEqual(readMidi(writeMidi(session).buffer).keySignatures,[{sharps:-3,mode:'minor',beat:8,time:6}]);
});
test('malformed signature bytes, invalid maps and duplicate beats reject',()=>{
 const good=writeMidi({...base,keySignature:{sharps:0,mode:'major'}}),index=good.findIndex((v,i)=>v===255&&good[i+1]===89);
 for(const [offset,value] of [[3,8],[3,248],[4,2],[2,1]]){const bad=good.slice();bad[index+offset]=value;assert.throws(()=>readMidi(bad.buffer));}
 assert.throws(()=>compileKeyMap({keyChanges:[{beat:1,sharps:0,mode:'major'},{beat:1,sharps:1,mode:'major'}]}));assert.throws(()=>compileKeyMap({keySignature:{sharps:0,mode:'dorian'}}));
});
