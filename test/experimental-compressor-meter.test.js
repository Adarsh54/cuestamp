import test from 'node:test';import assert from 'node:assert/strict';
import {createEffectMeters,compressorMeterView} from '../src/experimental/compressor-meter.js';
test('effect meters read current reduction and clear references at stop',()=>{
 const m=createEffectMeters(),node={reduction:-6};m.add({id:'c',kind:'compressor'},node);m.add({id:'other',kind:'eq'},node);assert.deepEqual([...m.read()],[['c',{reductionDb:-6}]]);node.reduction=-12;assert.equal(m.read().get('c').reductionDb,-12);node.reduction=NaN;assert.equal(m.read().size,0);node.reduction=1;assert.equal(m.read().get('c').reductionDb,0);m.stop();m.add({id:'c',kind:'compressor'},node);assert.equal(m.read().size,0);
});
test('compressor meters start honestly and do not appear on other effects',()=>{
 assert.match(compressorMeterView({id:'c',kind:'compressor',enabled:true}),/Play to measure/);assert.match(compressorMeterView({id:'c',kind:'compressor',enabled:false}),/Bypassed/);assert.equal(compressorMeterView({kind:'eq'}),'');
});
