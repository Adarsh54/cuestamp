import test from 'node:test';import assert from 'node:assert/strict';import {newSession,SessionHistory} from '../src/experimental/session.js';import {curveAutomationValue} from '../src/experimental/automation-curves.js';
function setup(shape='linear'){const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'automation.point',target:'t',values:{parameter:'gainDb',time:0,value:-24,shape}},{op:'automation.point',target:'t',values:{parameter:'gainDb',time:10,value:-6}},{op:'automation.point',target:'t',values:{parameter:'pan',time:0,value:.2}}]);return h;}
const trim=(target,parameter,start,end,amount,extras={})=>({op:'automation.trim',target,values:{parameter,start,end,amount,...extras}});
test('range trim preserves rendered curves inside and outside cuts for every shape',()=>{
 for(const shape of ['linear','hold','smooth','easeIn','easeOut'])for(const [start,end]of [[2,8],[0,10],[1,10],[0,5],[10,12]]){
  const h=setup(shape),before=structuredClone(h.session.tracks[0]);h.execute([trim('t','gainDb',start,end,3)]);const after=h.session.tracks[0];
  for(let i=0;i<=1300;i++){const time=i/100,expected=curveAutomationValue(before.automation,'gainDb',time,0)+(time>=start&&time<end?3:0);assert.ok(Math.abs(curveAutomationValue(after.automation,'gainDb',time,0)-expected)<1e-8,`${shape} ${start}..${end} at ${time}`);}
  assert.deepEqual(after.automation.filter(p=>p.parameter==='pan'),before.automation.filter(p=>p.parameter==='pan'));h.undo();assert.deepEqual(h.session.tracks[0],before);
 }
});
test('trim preserves complete interior smooth and hold segments and rejects clipping atomically',()=>{
 const h=setup('smooth');h.execute([{op:'automation.point',target:'t',values:{id:'middle',parameter:'gainDb',time:4,value:-15,shape:'hold'}}]);const original=structuredClone(h.session);h.execute([trim('t','gainDb',0,10,2)]);assert.equal(h.session.tracks[0].automation.find(p=>p.id==='middle').shape,'hold');
 const prior=structuredClone(h.session);assert.throws(()=>h.execute([trim('t','gainDb',1,2,100)]));assert.deepEqual(h.session,prior);h.undo();assert.deepEqual(h.session.tracks,original.tracks);
});
test('empty master, bus sends and effects trim from their static fallback',()=>{
 const h=setup();h.execute([{op:'track.add',values:{id:'bus',kind:'bus'}},{op:'send.set',target:'t',values:{busId:'bus',gainDb:-12}},{op:'effect.add',target:'t',values:{id:'fx',kind:'gain'}}]);
 h.execute([trim(h.session.id,'gainDb',2,4,-3),trim('t','gainDb',2,4,3,{busId:'bus'}),trim('fx','gainDb',2,4,-6)]);
 for(const [points,fallback,expected]of [[h.session.masterAutomation,0,-3],[h.session.tracks[0].sends[0].automation,-12,-9],[h.session.tracks[0].effects[0].automation,0,-6]]){assert.equal(curveAutomationValue(points,'gainDb',1,fallback),fallback);assert.equal(curveAutomationValue(points,'gainDb',3,fallback),expected);assert.equal(curveAutomationValue(points,'gainDb',4,fallback),fallback);}
});
test('invalid ranges, limits and zero trim are handled without partial mutations',()=>{
 const h=setup(),before=structuredClone(h.session);for(const command of [trim('t','pan',1,1,.1),trim('t','pan',3,2,.1),trim('missing','pan',1,2,.1),trim('t','pan',1,2,2),trim('t','gainDb',1,2,NaN)]){assert.throws(()=>h.execute([command]));assert.deepEqual(h.session,before);}
 h.execute([trim('t','gainDb',1,2,0)]);assert.deepEqual(h.session.tracks,before.tracks);h.session.tracks[0].automation=Array.from({length:2000},(_,i)=>({id:'p'+i,parameter:'gainDb',time:100+i,value:-12,shape:'linear'}));const full=structuredClone(h.session);assert.throws(()=>h.execute([trim('t','gainDb',1,2,1)]));assert.deepEqual(h.session,full);
});
test('agent trim command validates and executes through the shared engine',async()=>{
 const {planDawEdit}=await import('../server/daw-agent.js');const h=setup(),before=structuredClone(h.session);let request;
 const commands=[trim('t','gainDb',2,8,3)],plan=await planDawEdit({session:h.session,instruction:'Raise the volume automation three dB from 2 to 8 seconds'},{provider:'openai',key:'test',model:'test',fetchImpl:async(_,init)=>{request=JSON.parse(init.body);return {ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Raised the passage',commands})}]})};}});
 assert.match(request.input[0].content,/automation\.trim/);assert.deepEqual(h.session,before);h.execute(plan.commands,plan.revision);assert.equal(curveAutomationValue(h.session.tracks[0].automation,'gainDb',5,0),-12);h.undo();assert.deepEqual(h.session.tracks,before.tracks);
});
test('legacy points without shape keep their default linear interpolation across trim boundaries',()=>{
 const h=setup();for(const p of h.session.tracks[0].automation)delete p.shape;h.execute([trim('t','gainDb',2,8,3)]);const points=h.session.tracks[0].automation;for(const [time,value]of [[1,-22.2],[5,-12],[9,-7.8]])assert.ok(Math.abs(curveAutomationValue(points,'gainDb',time,0)-value)<1e-8);
});
