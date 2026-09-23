import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneObservation} from '../src/experimental/scene-observation.js';
import {validateTransportState} from '../src/experimental/agent-transport.js';
const plan=(sceneId='s',duration=4)=>({sceneId,end:4,sourceCells:[{trackId:'t',regionId:'r',duration}]});
test('scene observations follow audio clock without UI advance and expose one-shot endings',()=>{
 const o=createSceneObservation(plan('s',1));
 assert.equal(o.read(-.1).cells[0].state,'queued');
 assert.equal(o.read(0).cells[0].state,'playing');
 assert.equal(o.read(1).cells[0].state,'finished');
 o.queue(plan('next'),2,1.1);
 assert.equal(o.read(1.5).queuedSceneId,'next');
 assert.equal(o.read(2).currentSceneId,'next');
 assert.equal(o.read(2).queuedSceneId,null);
 assert.equal(o.read(2).cells[0].state,'playing');
});
test('pending launches coexist with playing cells; stop cancels future starts',()=>{
 const o=createSceneObservation(plan());o.launch(plan('other'), 't',2,.2);
 assert.deepEqual(o.read(.3).cells.map(c=>c.state),['playing','queued']);
 o.stop('t',1,.4);
 assert.deepEqual(o.read(.5).cells.map(c=>[c.sceneId,c.end]),[['s',1]]);
 assert.equal(o.read(1).cells[0].state,'finished');
});
test('whole-scene handoff removes launches scheduled beyond its boundary',()=>{
 const o=createSceneObservation(plan());o.launch(plan('other'),'t',3,.1);o.queue(plan('next'),2,.2);
 assert.deepEqual(o.read(1).cells.map(c=>c.sceneId),['s','next']);
 assert.deepEqual(o.read(2).cells.map(c=>c.state),['finished','playing']);
});
test('agent observations validate cell ownership and mode without changing session',()=>{
 const session={id:'session',revision:0,scenes:[{id:'s',cells:[{regionId:'r'}]}],tracks:[{id:'t',regions:[{id:'r'}]}]};
 const state={sessionId:'session',revision:0,epoch:1,position:.5,playing:true,mode:'scene',scene:createSceneObservation(plan()).read(.5)};
 assert.deepEqual(validateTransportState(state,session),state);
 assert.throws(()=>validateTransportState({...state,mode:'arrangement'},session),/require scene/);
 const invalid=structuredClone(state);invalid.scene.cells[0].trackId='other';assert.throws(()=>validateTransportState(invalid,session),/unavailable cell/);
 invalid.scene.cells[0].end=0;assert.throws(()=>validateTransportState(invalid,session),/Cell end/);
 const {scene,...plain}=state;assert.deepEqual(validateTransportState(plain,session),plain);
});

test('back-to-back scene queues do not require a UI read at the handoff',()=>{
 const o=createSceneObservation(plan('first'));o.queue(plan('second'),1,.1);o.queue(plan('third'),3,2);
 assert.equal(o.read(2).currentSceneId,'second');assert.equal(o.read(2).queuedSceneId,'third');
});
