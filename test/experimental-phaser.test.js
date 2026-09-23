import test from 'node:test';
import assert from 'node:assert/strict';
import {effectSchema,effectTail} from '../src/experimental/effects.js';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
test('phaser validates static and automation controls and reserves filter decay',()=>{
 const e=effectSchema.parse({id:'p',kind:'phaser'});
 assert.equal(e.depthCents,1200);assert.equal(e.frequency,1000);assert.equal(effectTail([e]),2);
 assert.equal(effectTail([{...e,mix:0}]),0);assert.equal(effectTail([{...e,enabled:false}]),0);
 assert.equal(effectTail([{...e,mix:0,automation:[{id:'a',parameter:'mix',time:1,value:1}]}]),2);
 for(const values of [{rate:0},{rate:11},{frequency:4001},{frequency:19},{depthCents:-1},{depthCents:2401},{mix:2},{stereoPhase:181},{feedback:.3},{automation:[{id:'a',parameter:'depthCents',time:0,value:2401}]},{automation:[{id:'a',parameter:'stereoPhase',time:0,value:90}]},{automationMuted:['depthMs']}])assert.throws(()=>effectSchema.parse({...e,...values}));
 assert.deepEqual(effectSchema.parse({...e,automationMuted:['depthCents']}).automationMuted,['depthCents']);
});
test('phaser supports track bus and master commands, parameter automation, undo and document roundtrip',()=>{
 let s=newSession();s=applyCommands(s,[{op:'track.add',values:{id:'t'}},{op:'track.add',values:{id:'bus',kind:'bus'}},...['t','bus',s.id].map((target,i)=>({op:'effect.add',target,values:{id:'p'+i,kind:'phaser'}}))]);
 const h=new SessionHistory(s);h.execute([{op:'effect.set',target:'p0',values:{rate:2,depthCents:600}},{op:'effect.automation.point',target:'p0',values:{parameter:'frequency',time:1,value:2000}},{op:'effect.automation.point',target:'p0',values:{parameter:'depthCents',time:1,value:1800}}]);
 assert.equal(h.session.tracks[0].effects[0].rate,2);h.undo();assert.deepEqual(h.session.tracks,s.tracks);h.redo();assert.equal(h.session.tracks[0].effects[0].automation.length,2);
 assert.deepEqual(applyCommands(JSON.parse(JSON.stringify(h.session)),[{op:'effect.set',target:'p0',values:{enabled:false}}]).tracks[0].effects[0].enabled,false);
});
