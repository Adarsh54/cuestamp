import test from 'node:test';import assert from 'node:assert/strict';
import {createEffectMeters,compressorMeterView} from '../src/experimental/compressor-meter.js';
test('effect meters read current reduction and clear references at stop',()=>{
 const m=createEffectMeters(),node={reduction:-6};m.add({id:'c',kind:'compressor'},node);m.add({id:'other',kind:'eq'},node);assert.deepEqual([...m.read()],[['c',{reductionDb:-6}]]);node.reduction=-12;assert.equal(m.read().get('c').reductionDb,-12);node.reduction=NaN;assert.equal(m.read().size,0);node.reduction=1;assert.equal(m.read().get('c').reductionDb,0);m.stop();m.add({id:'c',kind:'compressor'},node);assert.equal(m.read().size,0);
});
test('compressor meters start honestly and do not appear on other effects',()=>{
 assert.match(compressorMeterView({id:'c',kind:'compressor',enabled:true}),/Play to measure/);assert.match(compressorMeterView({id:'c',kind:'compressor',enabled:false}),/Bypassed/);assert.equal(compressorMeterView({kind:'eq'}),'');
});

test('gate meters include detector state and have a 96 dB display range',()=>{
 const m=createEffectMeters(),node={reduction:-60,gateOpen:false};m.add({id:'g',kind:'gate'},node);assert.deepEqual(m.read().get('g'),{reductionDb:-60,open:false});node.gateOpen=true;node.reduction=0;assert.deepEqual(m.read().get('g'),{reductionDb:0,open:true});
 assert.match(compressorMeterView({id:'g',kind:'gate',enabled:true}),/max="96"/);m.stop();assert.equal(m.read().size,0);
});
