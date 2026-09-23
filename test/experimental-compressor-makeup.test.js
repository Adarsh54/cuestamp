import test from 'node:test';import assert from 'node:assert/strict';
import {effectSchema} from '../src/experimental/effects.js';import {SessionHistory} from '../src/experimental/session.js';
test('old compressor documents default to unity makeup; bounds and automation validate',()=>{
 const e=effectSchema.parse({id:'c',kind:'compressor'});assert.equal(e.makeupDb,0);
 for(const value of [-25,25,NaN,Infinity])assert.throws(()=>effectSchema.parse({...e,makeupDb:value}));
 assert.throws(()=>effectSchema.parse({...e,automation:[{id:'a',parameter:'makeupDb',time:0,value:25}]}));
 assert.doesNotThrow(()=>effectSchema.parse({...e,automationMuted:['makeupDb'],automation:[{id:'a',parameter:'makeupDb',time:0,value:-12}]}));
});
test('compressor makeup supports shared commands, automation, presets and undo',()=>{
 const h=new SessionHistory();h.execute([{op:'effect.add',target:h.session.id,values:{id:'c',kind:'compressor'}}]);
 h.execute([{op:'effect.set',target:'c',values:{makeupDb:6}},{op:'effect.automation.point',target:'c',values:{parameter:'makeupDb',time:1,value:-6}},{op:'effectPreset.save',target:h.session.id,values:{name:'Compressed',includeAutomation:true}}]);assert.equal(h.session.masterEffects[0].makeupDb,6);assert.equal(h.session.effectPresets[0].effects[0].automation[0].value,-6);h.undo();assert.equal(h.session.masterEffects[0].makeupDb,0);h.redo();assert.equal(h.session.masterEffects[0].makeupDb,6);
});
