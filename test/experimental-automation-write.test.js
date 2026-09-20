import test from 'node:test';import assert from 'node:assert/strict';
import {createTouchRecording} from '../src/experimental/automation-touch.js';
import {newSession,SessionHistory} from '../src/experimental/session.js';
import {curveAutomationValue} from '../src/experimental/automation-curves.js';
function setup(){const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'automation.point',target:'t',values:{parameter:'gainDb',time:0,value:-24}},{op:'automation.point',target:'t',values:{parameter:'gainDb',time:10,value:0}}]);const calls=[],state={position:5,epoch:1,playback:{automation:Object.fromEntries(['set','cancel','replace','release'].map(name=>[name,(...args)=>calls.push([name,...args])]))}};const touch=createTouchRecording({getMode:()=> 'write',getState:()=>({...state,session:h.session}),commit:(commands,revision)=>h.execute(commands,revision)});return {h,touch,state,calls};}
test('Write replaces both lanes from playback start without any control movement',()=>{
 const {h,touch,state,calls}=setup(),before=structuredClone(h.session);touch.beginWrite('t');assert.equal(touch.count,2);assert.deepEqual(calls.filter(c=>c[0]==='set').map(c=>c.slice(1)),[['t','gainDb',-12],['t','pan',0]]);state.position=8;touch.finish();const points=h.session.tracks[0].automation;for(const time of [5,6,7,8])assert.equal(curveAutomationValue(points,'gainDb',time,0),-12);for(const time of [1,4,8.1,9,10])assert.ok(Math.abs(curveAutomationValue(points,'gainDb',time,0)-curveAutomationValue(before.tracks[0].automation,'gainDb',time,0))<1e-9);h.undo();assert.deepEqual(h.session.tracks,before.tracks);
});
test('Write holds before and after a movement; selecting another lane cannot silently extend its scope',()=>{
 const {h,touch,state}=setup();touch.beginWrite('t');state.position=7;touch.input('t','gainDb',-3);touch.release('t','gainDb');assert.throws(()=>touch.input(h.session.id,'gainDb',0),/selected/);assert.equal(touch.count,2);state.position=9;touch.finish();const points=h.session.tracks[0].automation;assert.equal(curveAutomationValue(points,'gainDb',6,0),-12);assert.equal(curveAutomationValue(points,'gainDb',8,0),-3);
});
test('Write preparation rolls back live overrides when the second lane is disabled',()=>{
 const {h,touch,calls}=setup();h.session.tracks[0].automationMuted=['pan'];const before=structuredClone(h.session);assert.throws(()=>touch.beginWrite('t'),/Read/);assert.equal(touch.active,false);assert.ok(calls.some(c=>c[0]==='cancel'&&c[2]==='gainDb'));assert.deepEqual(h.session,before);
});
test('Write discard and zero-duration passes do not edit the session; Master is supported',()=>{
 const {h,touch,state}=setup(),revision=h.session.revision;touch.beginWrite(h.session.id);touch.finish();assert.equal(h.session.revision,revision);touch.beginWrite(h.session.id);state.position=7;touch.cancel();assert.equal(h.session.revision,revision);touch.beginWrite(h.session.id);state.position=8;touch.finish();assert.ok(h.session.masterAutomation.length);
});
