import test from 'node:test';import assert from 'node:assert/strict';
import {effectSchema,effectTail} from '../src/experimental/effects.js';import {SessionHistory} from '../src/experimental/session.js';import {sessionDuration} from '../src/experimental/audio-engine.js';import {createBouncePlan} from '../src/experimental/bounce-plan.js';
const eq=v=>effectSchema.parse({id:'e',kind:'eq',type:'notch',frequency:20,q:20,...v});
test('EQ tail accounts for resonance, frequency, identity settings, bypass and chain cap',()=>{
 const tail=effectTail([eq({})]);assert.ok(tail>5&&tail<6);assert.ok(effectTail([eq({frequency:1000})])<tail);assert.equal(effectTail([eq({enabled:false})]),0);
 for(const type of ['peaking','lowshelf','highshelf'])assert.equal(effectTail([eq({type,gainDb:0})]),0);
 assert.equal(effectTail(Array.from({length:16},()=>eq({}))),30);
 for(const type of ['notch','bandpass','lowpass','highpass','peaking','lowshelf','highshelf'])assert.ok(Number.isFinite(effectTail([eq({type,gainDb:24})])));
});
test('EQ tail considers active automation extrema and respects disabled lanes and parent modes',()=>{
 const e=eq({frequency:1000,automation:[{id:'p',parameter:'frequency',time:1,value:20}]});assert.ok(effectTail([e])>5);assert.ok(effectTail([e],true)<.2);assert.ok(effectTail([{...e,automationMuted:['frequency']}])<.2);assert.ok(effectTail([{...e,automationMode:'off'}])<.2);
});
test('EQ tails flow through tracks buses master and bounce planning; range exports remain exact',()=>{
 const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t'}},{op:'track.add',values:{id:'b',kind:'bus'}},{op:'track.set',target:'t',values:{output:'b'}},{op:'region.add',target:'t',values:{id:'r',duration:1,assetId:'a'}},...['t','b',h.session.id].map((target,i)=>({op:'effect.add',target,values:{...eq({id:'e'+i}),automation:undefined}})).map(c=>{delete c.values.automation;return c;})]);
 const tail=effectTail([eq({})]);assert.ok(Math.abs(sessionDuration(h.session)-(1+3*tail))<1e-9);for(const mode of ['mix','stems','region'])assert.ok(Math.abs(createBouncePlan(h.session,{mode,regionId:'r'}).duration-(1+3*tail))<1e-9);assert.equal(createBouncePlan(h.session,{mode:'range'}).duration,4);
});
