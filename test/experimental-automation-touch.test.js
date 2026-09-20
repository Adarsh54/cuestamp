import test from 'node:test';import assert from 'node:assert/strict';
import {createTouchRecording} from '../src/experimental/automation-touch.js';
import {newSession,SessionHistory} from '../src/experimental/session.js';
function setup(){
 const history=new SessionHistory(newSession());history.execute([{op:'track.add',values:{id:'t',kind:'audio'}}]);const calls=[],state={session:history.session,epoch:1,position:1,playback:{automation:Object.fromEntries(['set','replace','release','cancel'].map(name=>[name,(...args)=>calls.push([name,...args])]))}};
 const touch=createTouchRecording({getState:()=>({...state,session:history.session}),commit:(command,revision)=>history.execute([command],revision)});return {touch,history,state,calls};
}
test('Touch commits an undoable gesture, preserves static value and continues playback',()=>{
 const {touch,history,state,calls}=setup(),before=structuredClone(history.session);touch.input('t','gainDb',-6);state.position=2;touch.input('t','gainDb',-12);state.position=3;assert.equal(touch.finish(),true);
 const points=history.session.tracks[0].automation;assert.ok(points.some(p=>p.time===1&&p.value===-6));assert.ok(points.some(p=>p.time===3&&p.value===-12));assert.equal(history.session.tracks[0].gainDb,before.tracks[0].gainDb);assert.equal(calls.at(-1)[0],'release');assert.equal(calls.at(-2)[0],'replace');assert.equal(touch.active,false);history.undo();assert.deepEqual(history.session.tracks,before.tracks);
});
test('Touch cancels empty gestures and explicit cancellation without committing',()=>{
 const {touch,state,history,calls}=setup(),revision=history.session.revision;touch.input('t','pan',.5);assert.equal(touch.finish(),false);assert.equal(history.session.revision,revision);touch.input('t','pan',-.5);state.position=2;touch.cancel();assert.equal(history.session.revision,revision);assert.equal(calls.at(-1)[0],'cancel');
});
test('Touch guards seek, stale edits, cycle playback, protected and disabled lanes',()=>{
 for(const change of [s=>s.epoch++,s=>s.position=0,s=>s.playback={}]){const {touch,state,history}=setup(),revision=history.session.revision;touch.input('t','pan',.5);change(state);if(state.position===0)assert.equal(touch.finish(),false);else assert.throws(()=>touch.finish());assert.equal(touch.active,false);assert.equal(history.session.revision,revision);}
 for(const values of [{mute:true},{protected:true},{automationMode:'off'},{automationMuted:['pan']}]){const {touch,history}=setup();if(values.automationMuted)history.session.tracks[0].automationMuted=values.automationMuted;else history.execute([{op:'track.set',target:'t',values}]);assert.throws(()=>touch.input('t','pan',.5));assert.equal(touch.active,false);}
 const {touch,state}=setup();state.playback.loop=true;assert.throws(()=>touch.input('t','gainDb',0),/Cycle/);
});
test('Touch rejects failed commits and restores audio without partial project changes',()=>{
 const {touch,history,state,calls}=setup();touch.input('t','pan',.5);history.execute([{op:'session.set',values:{title:'New revision'}}]);state.position=2;assert.throws(()=>touch.finish(),/changed/);assert.deepEqual(history.session.tracks[0].automation,[]);assert.equal(calls.at(-1)[0],'cancel');
});
test('Touch can record master and consecutive gestures with refreshed revisions',()=>{
 const {touch,history,state}=setup();touch.input(history.session.id,'pan',.3);state.position=2;touch.finish();touch.input('t','gainDb',-10);state.position=3;touch.finish();assert.ok(history.session.masterAutomation.length);assert.ok(history.session.tracks[0].automation.length);
});
