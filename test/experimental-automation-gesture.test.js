import test from 'node:test';import assert from 'node:assert/strict';import {newSession,SessionHistory} from '../src/experimental/session.js';import {curveAutomationValue} from '../src/experimental/automation-curves.js';
const setup=shape=>{const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'automation.point',target:'t',values:{id:'a',parameter:'gainDb',time:0,value:-24,shape}},{op:'automation.point',target:'t',values:{id:'b',parameter:'gainDb',time:10,value:0}},{op:'automation.point',target:'t',values:{id:'pan',parameter:'pan',time:3,value:.5}}]);return h;};
const command={op:'automation.record',target:'t',values:{parameter:'gainDb',samples:JSON.stringify([{time:3,value:-6},{time:4,value:-12}]),returnSeconds:.5}};
test('recorded automation preserves surrounding curves and other parameters with one undo',()=>{
 for(const shape of ['linear','hold','smooth','easeIn','easeOut']){
  const h=setup(shape),before=structuredClone(h.session),original=before.tracks[0].automation;h.execute([command]);const points=h.session.tracks[0].automation;
  for(const t of [0,1,2.9,4.5,5,7,9.9,10,12])assert.ok(Math.abs(curveAutomationValue(points,'gainDb',t,0)-curveAutomationValue(original,'gainDb',t,0))<1e-9,`${shape} at ${t}`);
  assert.equal(curveAutomationValue(points,'gainDb',3,0),-6);assert.equal(curveAutomationValue(points,'gainDb',4,0),-12);assert.deepEqual(points.find(p=>p.id==='pan'),original.find(p=>p.id==='pan'));h.undo();assert.deepEqual(h.session.tracks,before.tracks);
 }
});
test('recording into an empty master lane preserves the prior static value outside the gesture',()=>{
 const h=new SessionHistory(newSession());h.execute([{...command,target:h.session.id}]);const points=h.session.masterAutomation;assert.equal(curveAutomationValue(points,'gainDb',0,0),0);assert.equal(curveAutomationValue(points,'gainDb',5,0),0);
});
test('invalid automation captures reject atomically',()=>{
 const h=setup('linear'),before=structuredClone(h.session);for(const samples of [[{time:3,value:0}], [{time:3,value:0},{time:3,value:1}], [{time:3,value:0},{time:4,value:13}], [{time:86399,value:0},{time:86400,value:0}]])assert.throws(()=>h.execute([{...command,values:{...command.values,samples:JSON.stringify(samples)}}]));assert.deepEqual(h.session,before);
});

test('gesture at an existing curved endpoint retains the preceding rendered curve',()=>{
 const h=setup('smooth'),original=structuredClone(h.session.tracks[0].automation);h.execute([{...command,values:{...command.values,samples:JSON.stringify([{time:10,value:-6},{time:11,value:-12}])}}]);for(const t of [0,2,5,9,9.99])assert.ok(Math.abs(curveAutomationValue(h.session.tracks[0].automation,'gainDb',t,0)-curveAutomationValue(original,'gainDb',t,0))<1e-9);
});
