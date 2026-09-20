import test from 'node:test';import assert from 'node:assert/strict';import {newSession,SessionHistory} from '../src/experimental/session.js';import {scalePresetsView} from '../src/experimental/scale-presets.js';
test('scale presets normalize, persist, update, delete and undo',()=>{
 const h=new SessionHistory(newSession());h.execute([{op:'scalePreset.add',values:{id:'p',name:' Whole tone ',root:2,custom:'10,0,2,4,6,8'}}]);assert.deepEqual(h.session.scalePresets[0],{id:'p',name:'Whole tone',root:2,custom:'0,2,4,6,8,10'});assert.deepEqual(new SessionHistory(JSON.parse(JSON.stringify(h.session))).session.scalePresets,h.session.scalePresets);
 h.execute([{op:'scalePreset.set',target:'p',values:{name:'Sparse',custom:'0,7'}}]);assert.equal(h.session.scalePresets[0].custom,'0,7');h.execute([{op:'scalePreset.delete',target:'p'}]);assert.equal(h.session.scalePresets.length,0);h.undo();assert.equal(h.session.scalePresets[0].name,'Sparse');
});
test('invalid presets reject atomically and names render as text',()=>{
 const h=new SessionHistory(newSession()),before=structuredClone(h.session);for(const values of [{name:'',root:0,custom:'0'},{name:'Bad',root:12,custom:'0'},{name:'Bad',root:0,custom:'0,0'},{id:h.session.id,name:'Collision',root:0,custom:'0'}])assert.throws(()=>h.execute([{op:'scalePreset.add',values}]));assert.deepEqual(h.session,before);
 assert.ok(scalePresetsView({scalePresets:[{id:'safe',name:'<img onerror="bad">'}]}).includes('&lt;img'));assert.throws(()=>h.execute([{op:'scalePreset.delete',target:'missing'}]));
});
