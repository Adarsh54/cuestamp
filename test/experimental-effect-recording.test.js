import test from 'node:test';import assert from 'node:assert/strict';import {newSession,SessionHistory} from '../src/experimental/session.js';import {effectParameters} from '../src/experimental/effect-automation.js';import {curveAutomationValue} from '../src/experimental/automation-curves.js';
function setup(kind,master=false){const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'effect.add',target:master?h.session.id:'t',values:{id:'effect',kind}}]);return h;}
const cmd=(op,parameter,a,b)=>({op,target:'effect',values:{parameter,samples:JSON.stringify([{time:2,value:a},{time:4,value:b}]),returnSeconds:1}});
test('all supported effect parameters record in their own units and ranges with undo',()=>{
 for(const [kind,parameters]of Object.entries(effectParameters))for(const [parameter,spec]of Object.entries(parameters)){
  const h=setup(kind),before=structuredClone(h.session),a=spec.min+(spec.max-spec.min)*.25,b=spec.min+(spec.max-spec.min)*.75;h.execute([cmd('automation.record',parameter,a,b)]);const effect=h.session.tracks[0].effects[0];assert.ok(Math.abs(curveAutomationValue(effect.automation,parameter,3,effect[parameter])-(a+b)/2)<1e-8,`${kind}.${parameter}`);assert.equal(effect[parameter],before.tracks[0].effects[0][parameter]);assert.deepEqual(h.session.tracks[0].automation,[]);h.undo();assert.deepEqual(h.session.tracks,before.tracks);
 }
});
test('effect trim offsets the underlying curve without using channel gain limits',()=>{
 for(const [kind,parameter,a,b,amount]of [['eq','frequency',1000,3000,500],['eq','gainDb',10,20,3],['gain','gainDb',10,20,3],['compressor','threshold',-40,-20,5],['delay','time',.2,.8,.1]]){
  const h=setup(kind,true);h.execute([{op:'effect.automation.point',target:'effect',values:{parameter,time:0,value:a,shape:'smooth'}},{op:'effect.automation.point',target:'effect',values:{parameter,time:10,value:b}}]);const before=structuredClone(h.session.masterEffects[0]);h.execute([cmd('automation.trimRecord',parameter,amount,amount)]);const effect=h.session.masterEffects[0];for(const time of [0,1,3,5,8])assert.ok(Math.abs(curveAutomationValue(effect.automation,parameter,time,effect[parameter])-curveAutomationValue(before.automation,parameter,time,before[parameter])-(time===3?amount:0))<1e-8);h.undo();assert.deepEqual(h.session.masterEffects[0],before);
 }
});
test('static controls, unsupported parameters, send scope and out-of-range results fail atomically',()=>{
 const h=setup('eq'),before=structuredClone(h.session);for(const c of [cmd('automation.record','frequency',19,100),cmd('automation.record','gainDb',0,25),cmd('automation.record','type',0,1),cmd('automation.record','__proto__',0,1),cmd('automation.trimRecord','frequency',20000,20000),{...cmd('automation.record','q',1,2),values:{...cmd('automation.record','q',1,2).values,busId:'t'}}]){assert.throws(()=>h.execute([c]));assert.deepEqual(h.session,before);}
});
test('effect capture retains bypass and automation playback settings',()=>{
 const h=setup('reverb');h.execute([{op:'effect.set',target:'effect',values:{enabled:false,automationMode:'off'}}]);h.execute([cmd('automation.record','mix',.2,.8)]);const effect=h.session.tracks[0].effects[0];assert.equal(effect.enabled,false);assert.equal(effect.automationMode,'off');
});
test('agent effect recording is validated through the shared engine',async()=>{
 const {planDawEdit}=await import('../server/daw-agent.js');const h=setup('eq'),before=structuredClone(h.session);const plan=await planDawEdit({session:h.session,instruction:'Sweep the EQ frequency from 500 to 2000 Hz over this passage'},{provider:'openai',key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'EQ sweep',commands:[cmd('automation.record','frequency',500,2000)]})}]})})});assert.deepEqual(h.session,before);h.execute(plan.commands,plan.revision);assert.equal(curveAutomationValue(h.session.tracks[0].effects[0].automation,'frequency',3,0),1250);
});
