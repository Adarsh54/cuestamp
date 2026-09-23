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

test('phaser tempo sync persists and rejects invalid divisions without destroying free automation',()=>{
 const h=new SessionHistory();h.execute([{op:'effect.add',target:h.session.id,values:{id:'p',kind:'phaser'}},{op:'effect.automation.point',target:'p',values:{parameter:'rate',time:0,value:7}}]);
 const original=structuredClone(h.session.masterEffects[0]);assert.equal(original.sync,false);
 h.execute([{op:'effect.set',target:'p',values:{sync:true,beats:.5}}]);assert.equal(h.session.masterEffects[0].beats,.5);assert.deepEqual(h.session.masterEffects[0].automation,original.automation);
 for(const values of [{beats:0},{beats:17},{sync:1}])assert.throws(()=>h.execute([{op:'effect.set',target:'p',values}]));
 h.undo();assert.deepEqual(h.session.masterEffects[0],original);h.redo();assert.equal(h.session.masterEffects[0].sync,true);
});

test('synced phaser disables free-rate capture and readback while keeping depth available',async()=>{
 const {createMixerReadback}=await import('../src/experimental/mixer-readback.js');const {createTouchRecording}=await import('../src/experimental/automation-touch.js');
 const h=new SessionHistory();h.execute([{op:'effect.add',target:h.session.id,values:{id:'p',kind:'phaser',sync:true,rate:2}},{op:'effect.automation.point',target:'p',values:{parameter:'rate',time:0,value:7}}]);
 assert.equal(createMixerReadback(h.session)('p','rate',1),2);
 const calls=[],touch=createTouchRecording({getState:()=>({session:h.session,position:1,epoch:0,playback:{automation:{set:(...v)=>calls.push(v),cancel:()=>{}}}}),commit:()=>{}});
 assert.throws(()=>touch.input('p','rate',3),/tempo sync/);assert.equal(calls.length,0);touch.input('p','depthCents',600);assert.deepEqual(calls,[['p','depthCents',600]]);touch.cancel();
});

test('agent can enable tempo-synced phaser using validated shared commands',async()=>{
 const {planDawEdit}=await import('../server/daw-agent.js');const h=new SessionHistory();
 const commands=[{op:'effect.add',target:h.session.id,values:{id:'p',kind:'phaser',sync:true,beats:2}}];let instruction;
 const result=await planDawEdit({session:h.session,instruction:'Add a half-note phaser on the master'},{key:'test',model:'test',fetchImpl:async(_,options)=>{instruction=JSON.parse(options.body).input[0].content;return {ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Added synced phaser',commands})}]})};}});
 assert.match(instruction,/sync.*project tempo map/);h.execute(result.commands);assert.equal(h.session.masterEffects[0].beats,2);
});
