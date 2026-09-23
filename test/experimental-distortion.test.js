import test from 'node:test';import assert from 'node:assert/strict';
import {effectSchema,effectTail} from '../src/experimental/effects.js';
import {SessionHistory} from '../src/experimental/session.js';
test('distortion validates controls, automation and render tail',()=>{
 const e=effectSchema.parse({id:'d',kind:'distortion'});assert.equal(e.driveDb,12);assert.equal(e.outputDb,-6);assert.equal(effectTail([e]),.5);assert.equal(effectTail([{...e,mix:0}]),0);assert.equal(effectTail([{...e,enabled:false}]),0);
 for(const values of [{driveDb:-1},{driveDb:37},{toneHz:19},{toneHz:20001},{outputDb:-61},{outputDb:13},{mix:2},{sync:true},{automation:[{id:'a',parameter:'driveDb',time:0,value:37}]},{automationMuted:['rate']}])assert.throws(()=>effectSchema.parse({...e,...values}));
 assert.doesNotThrow(()=>effectSchema.parse({...e,automationMuted:['driveDb'],automation:[{id:'a',parameter:'outputDb',time:0,value:-12}]}));
});
test('distortion supports shared track bus master edits, automation, atomic validation and undo',()=>{
 const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t'}},{op:'track.add',values:{id:'b',kind:'bus'}},...['t','b',h.session.id].map((target,i)=>({op:'effect.add',target,values:{id:'d'+i,kind:'distortion'}}))]);const before=structuredClone(h.session);
 h.execute([{op:'effect.set',target:'d0',values:{driveDb:24}},{op:'effect.automation.point',target:'d0',values:{parameter:'toneHz',time:1,value:2000}}]);const saved=structuredClone(h.session);assert.throws(()=>h.execute([{op:'effect.set',target:'d0',values:{driveDb:36}},{op:'effect.set',target:'d1',values:{driveDb:37}}]));assert.deepEqual(h.session,saved);
 h.undo();assert.deepEqual(h.session.tracks,before.tracks);h.redo();assert.equal(h.session.tracks[0].effects[0].driveDb,24);
});
test('agent creates distortion using validated commands',async()=>{
 const {planDawEdit}=await import('../server/daw-agent.js');const h=new SessionHistory(),commands=[{op:'effect.add',target:h.session.id,values:{id:'d',kind:'distortion',driveDb:18,outputDb:-12}}];
 const result=await planDawEdit({session:h.session,instruction:'Add distortion to the master at 18dB drive and -12dB wet output'},{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Added distortion',commands})}]})})});h.execute(result.commands);assert.equal(h.session.masterEffects[0].driveDb,18);
});
