import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {writeMidi,encodeMidiImport} from '../src/experimental/midi.js';
const source={...newSession(),tempo:60,meter:6,meterDenominator:8,meterChanges:[{id:'seven',bar:3,numerator:7,denominator:4}]};
const command=(extra={})=>({op:'midi.import',values:{data:encodeMidiImport(writeMidi(source).buffer),tempoMode:'follow',meterMode:'adopt',...extra}});
test('signature-only files adopt base and changing meters with undo and persistence',()=>{
 const h=new SessionHistory(newSession());h.execute([command()]);assert.equal(h.session.meter,6);assert.equal(h.session.meterDenominator,8);assert.equal(h.session.meterChanges[0].bar,3);assert.equal(h.session.tracks.length,0);assert.equal(new SessionHistory(JSON.parse(JSON.stringify(h.session))).session.meterChanges[0].numerator,7);h.undo();assert.equal(h.session.meter,4);
});
test('nonzero signature import retains preceding map and replaces later changes',()=>{
 const base=applyCommands(newSession(),[{op:'meter.add',values:{bar:8,numerator:3,denominator:4}}]);const result=applyCommands(base,[command({start:2})]);assert.equal(result.meter,4);assert.deepEqual(result.meterChanges.map(p=>[p.bar,p.numerator,p.denominator]),[[2,6,8],[4,7,4]]);
});
test('tempo adoption and signature adoption combine without changing bar lengths',()=>{
 const result=applyCommands(newSession(),[command({tempoMode:'adopt'})]);assert.equal(result.tempo,60);assert.equal(result.meterChanges[0].bar,3);
});
test('unsupported import boundary and meter mode reject the full command',()=>{
 const h=new SessionHistory(newSession()),before=structuredClone(h.session);assert.throws(()=>h.execute([command({start:.5})]),/bar boundary/);assert.throws(()=>h.execute([command({meterMode:'bad',tempoMode:'adopt'})]),/signatures/);assert.deepEqual(h.session,before);
});
