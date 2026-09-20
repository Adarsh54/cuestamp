import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,SessionHistory} from '../src/experimental/session.js';
import {curveAutomationValue,orderedAutomationValue} from '../src/experimental/automation-curves.js';
const samples=[{time:2,value:1},{time:4,value:4},{time:6,value:-2}];
function setup(shape='linear'){const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'automation.point',target:'t',values:{parameter:'gainDb',time:0,value:-24,shape}},{op:'automation.point',target:'t',values:{parameter:'gainDb',time:5,value:-10,shape}},{op:'automation.point',target:'t',values:{parameter:'gainDb',time:10,value:-5}},{op:'automation.point',target:'t',values:{parameter:'pan',time:0,value:.2}}]);return h;}
const command=(target='t',parameter='gainDb',offsets=samples,returnSeconds=1)=>({op:'automation.trimRecord',target,values:{parameter,samples:JSON.stringify(offsets),returnSeconds}});
test('changing trim follows the underlying curve during capture and return for every shape',()=>{
 for(const shape of ['linear','hold','smooth','easeIn','easeOut']){
  const h=setup(shape),before=structuredClone(h.session);h.execute([command()]);const actual=h.session.tracks[0].automation,original=before.tracks[0].automation;
  for(let i=0;i<=1100;i++){
   const t=i/100,offset=t<2||t>=7?0:orderedAutomationValue([...samples,{time:7,value:0}],t,0),expected=curveAutomationValue(original,'gainDb',t,0)+offset;
   assert.ok(Math.abs(curveAutomationValue(actual,'gainDb',t,0)-expected)<1e-8,`${shape} at ${t}`);
  }
  assert.deepEqual(actual.filter(p=>p.parameter==='pan'),original.filter(p=>p.parameter==='pan'));h.undo();assert.deepEqual(h.session.tracks,before.tracks);
 }
});
test('Master pan trim starts from the static value and leaves other master data untouched',()=>{
 const h=new SessionHistory(newSession());h.execute([{op:'session.set',values:{masterPan:.2,masterDb:-6}}]);h.execute([command(h.session.id,'pan',[{time:1,value:.1},{time:2,value:.3}],1)]);assert.ok(Math.abs(curveAutomationValue(h.session.masterAutomation,'pan',1.5,.2)-.4)<1e-9);assert.equal(curveAutomationValue(h.session.masterAutomation,'pan',3,.2),.2);assert.equal(h.session.masterDb,-6);
});
test('invalid offsets, timeline overflow and clipping reject the entire batch',()=>{
 const h=setup(),before=structuredClone(h.session);for(const c of [command('t','gainDb',[{time:2,value:100},{time:4,value:100}]),command('t','pan',[{time:1,value:0},{time:2,value:1}]),command('t','gainDb',[{time:2,value:1},{time:2,value:2}]),command('t','gainDb',[{time:86399,value:1},{time:86400,value:1}]),command('missing')]){assert.throws(()=>h.execute([{op:'session.set',values:{title:'No partial edit'}},c]));assert.deepEqual(h.session,before);}
});
test('trim retains untouched Read/Off settings and rejects expanded point overflow',()=>{
 const h=setup('smooth');h.execute([{op:'track.set',target:'t',values:{automationMode:'off'}}]);h.execute([command()]);assert.equal(h.session.tracks[0].automationMode,'off');
 h.session.tracks[0].automation=Array.from({length:40},(_,i)=>({id:'p'+i,time:i,parameter:'gainDb',value:i%2?-12:-24,shape:'smooth'}));const before=structuredClone(h.session);assert.throws(()=>h.execute([command('t','gainDb',[{time:0,value:1},{time:39,value:1}],0)]),/2,000/);assert.deepEqual(h.session,before);
});
test('agent can plan the shared trim gesture command without mutating its input',async()=>{
 const {planDawEdit}=await import('../server/daw-agent.js');const h=setup(),before=structuredClone(h.session);let request;const plan=await planDawEdit({session:h.session,instruction:'Gradually offset the volume curve over this passage'},{provider:'openai',key:'test',model:'test',fetchImpl:async(_,init)=>{request=JSON.parse(init.body);return {ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Trimmed volume',commands:[command()]})}]})};}});assert.match(request.input[0].content,/automation\.trimRecord/);assert.deepEqual(h.session,before);h.execute(plan.commands,plan.revision);assert.equal(curveAutomationValue(h.session.tracks[0].automation,'gainDb',4,0),-8.8);
});
