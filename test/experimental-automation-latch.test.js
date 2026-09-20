import test from 'node:test';import assert from 'node:assert/strict';
import {createTouchRecording} from '../src/experimental/automation-touch.js';
import {newSession,SessionHistory} from '../src/experimental/session.js';
import {curveAutomationValue} from '../src/experimental/automation-curves.js';
function setup(){
 const history=new SessionHistory(newSession());history.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'track.add',values:{id:'b',kind:'bus'}}]);const calls=[],state={epoch:1,position:1,playback:{automation:Object.fromEntries(['set','replace','release','cancel'].map(name=>[name,(...args)=>calls.push([name,...args])]))}};let mode='latch';
 const touch=createTouchRecording({getMode:()=>mode,getState:()=>({...state,session:history.session}),commit:(commands,revision)=>history.execute(commands,revision)});return {touch,history,state,calls,setMode:v=>mode=v};
}
test('Latch holds on release, records several lanes through stop, and undoes as one pass',()=>{
 const {touch,history,state,calls}=setup(),before=structuredClone(history.session);touch.input('t','gainDb',-12);state.position=2;assert.equal(touch.release('t','gainDb'),false);assert.equal(history.session.revision,before.revision);assert.equal(calls.some(c=>c[0]==='release'),false);
 state.position=3;touch.input('b','pan',.6);state.position=4;touch.release('b','pan');touch.beforePaint();assert.equal(touch.count,2);state.position=8;touch.finish();
 assert.equal(history.session.revision,before.revision+1);assert.equal(curveAutomationValue(history.session.tracks[0].automation,'gainDb',7,0),-12);assert.equal(curveAutomationValue(history.session.tracks[1].automation,'pan',7,0),.6);assert.equal(touch.active,false);history.undo();assert.deepEqual(history.session.tracks,before.tracks);
});
test('moving a released Latch again preserves its intervening constant value',()=>{
 const {touch,history,state}=setup();touch.input('t','gainDb',-12);state.position=2;touch.release('t','gainDb');state.position=6;touch.input('t','gainDb',-3);state.position=7;touch.release('t','gainDb');state.position=8;touch.finish();const points=history.session.tracks[0].automation;
 for(const time of [2,3,4,5,5.99])assert.equal(curveAutomationValue(points,'gainDb',time,0),-12);assert.equal(curveAutomationValue(points,'gainDb',6,0),-3);assert.equal(curveAutomationValue(points,'gainDb',7.9,0),-3);
});
test('discard restores every latched parameter without a document edit',()=>{
 const {touch,history,state,calls}=setup(),revision=history.session.revision;touch.input('t','gainDb',-10);touch.input('t','pan',.4);touch.input(history.session.id,'pan',-.4);state.position=4;touch.cancel();assert.equal(touch.count,0);assert.equal(calls.filter(c=>c[0]==='cancel').length,3);assert.equal(history.session.revision,revision);
});
test('Latch pass is atomic when a lane would overflow its owner point capacity',()=>{
 const {touch,history,state,calls}=setup();history.session.tracks[1].automation=Array.from({length:2000},(_,i)=>({id:'p'+i,parameter:'pan',time:100+i,value:0,shape:'linear'}));const before=structuredClone(history.session);touch.input('t','gainDb',-10);touch.input('b','pan',.4);state.position=4;assert.throws(()=>touch.finish());assert.deepEqual(history.session,before);assert.equal(calls.filter(c=>c[0]==='cancel').length,2);assert.equal(touch.active,false);
});
test('Latch rejects stale playback even when another channel is touched',()=>{
 const {touch,state,history}=setup(),revision=history.session.revision;touch.input('t','gainDb',-10);state.epoch++;assert.throws(()=>touch.input('b','pan',.5));assert.equal(touch.active,false);assert.equal(history.session.revision,revision);
});
