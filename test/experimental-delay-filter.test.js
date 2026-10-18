import test from 'node:test';import assert from 'node:assert/strict';
import {DelayToneFilter} from '../src/experimental/delay-tone-filter.js';
import {SessionHistory} from '../src/experimental/session.js';
function level(frequency,rate=48000){const filter=new DelayToneFilter(rate,300,3000);let sum=0;for(let i=0;i<rate;i++){const sample=filter.process(Math.sin(2*Math.PI*frequency*i/rate));if(i>rate/2)sum+=sample**2;}return Math.sqrt(sum/(rate/2));}
test('delay tone filter passes its band and attenuates low/high frequencies',()=>{assert.ok(level(1000)>.69);assert.ok(level(30)<.008);assert.ok(level(12000)<.035);assert.ok(Number.isFinite(level(1000,8000)));});
test('delay filter settings use atomic commands, persistence and undo',()=>{const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'effect.add',target:'t',values:{id:'d',kind:'delay',filterEnabled:true,lowCutHz:300,highCutHz:3000}}]);const before=JSON.stringify(h.session);assert.throws(()=>h.execute([{op:'effect.set',target:'d',values:{lowCutHz:4000}}]),/cutoff/);assert.equal(JSON.stringify(h.session),before);h.execute([{op:'effect.set',target:'d',values:{highCutHz:5000}}]);assert.equal(h.session.tracks[0].effects[0].highCutHz,5000);h.undo();assert.deepEqual({...h.session,revision:1},JSON.parse(before));});
test('invalid filter settings fail before DSP allocation',()=>{for(const values of [[48000,500,300],[48000,NaN,3000],[48000,20,Infinity]])assert.throws(()=>new DelayToneFilter(...values));});

import {effectSchema,effectTail} from '../src/experimental/effects.js';
test('filtered delay bounce allows filter decay beyond the final tap',()=>{const effect=effectSchema.parse({id:'d',kind:'delay',time:.01,feedback:0,filterEnabled:true});assert.ok(Math.abs(effectTail([effect])-.21)<1e-10);assert.equal(effectTail([{...effect,filterEnabled:false}]),.01);assert.equal(effectTail([{...effect,mix:0}]),0);});
