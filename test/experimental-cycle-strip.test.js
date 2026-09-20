import test from 'node:test';import assert from 'node:assert/strict';
import {cycleGesture} from '../src/experimental/cycle-strip.js';
import {newSession,SessionHistory,applyCommands} from '../src/experimental/session.js';
const s={tempo:120,meter:4,frameRate:24,loopStart:1.1,loopEnd:3.1,loopEnabled:false},relative={grid:'beat',alignment:'relative'},absolute={grid:'beat',alignment:'absolute'};
test('drawing creates an enabled range in either direction with absolute snapping or Shift override',()=>{
 assert.deepEqual(cycleGesture(s,'draw',4.1,6.2,relative),{loopStart:4,loopEnd:6,loopEnabled:true});assert.deepEqual(cycleGesture(s,'draw',6.2,4.1,relative),{loopStart:4,loopEnd:6,loopEnabled:true});assert.deepEqual(cycleGesture(s,'draw',4.1,6.2,relative,true),{loopStart:4.1,loopEnd:6.2,loopEnabled:true});assert.throws(()=>cycleGesture(s,'draw',1.01,1.04,relative));
});
test('move preserves duration and off state, respecting relative/absolute snapping and bounds',()=>{
 const a=cycleGesture(s,'move',1,1.4,relative),b=cycleGesture(s,'move',1,1.4,absolute);assert.equal(a.loopStart,1.6);assert.equal(a.loopEnd,3.6);assert.equal(b.loopStart,1.5);assert.equal(b.loopEnd,3.5);assert.equal(b.loopEnabled,false);const left=cycleGesture(s,'move',1,-9,relative);assert.equal(left.loopStart,0);assert.equal(left.loopEnd,2);const right=cycleGesture(s,'move',1,100000,relative);assert.equal(right.loopEnd,86400);assert.equal(right.loopStart,86398);
});
test('resizing clamps positive lengths and snaps the dragged edge without moving its other end',()=>{
 const left=cycleGesture(s,'start',1.1,1.6,absolute);assert.equal(left.loopStart,1.5);assert.equal(left.loopEnd,3.1);const right=cycleGesture(s,'end',3.1,4.4,absolute);assert.equal(right.loopEnd,4.5);assert.equal(right.loopStart,1.1);assert.ok(Math.abs(cycleGesture(s,'start',1.1,20,relative).loopStart-3.099)<1e-12);assert.ok(Math.abs(cycleGesture(s,'end',3.1,-20,relative).loopEnd-1.101)<1e-12);assert.throws(()=>cycleGesture(s,'other',0,1));assert.throws(()=>cycleGesture(s,'move',NaN,1));
});
test('frame grid and keyboard-sized free changes are precise; commits are one undo without changing regions',()=>{
 const h=new SessionHistory(applyCommands(newSession(),[{op:'track.add',values:{id:'t'}},{op:'region.add',target:'t',values:{id:'r',duration:4}}])),before=structuredClone(h.session),values=cycleGesture(h.session,'draw',1.01,2.99,{grid:'frame',alignment:'absolute'});assert.equal(values.loopStart,1);assert.equal(values.loopEnd,3);h.execute([{op:'session.set',values}]);assert.deepEqual(h.session.tracks,before.tracks);h.undo();assert.equal(h.session.loopEnabled,false);assert.equal(h.session.loopEnd,4);h.redo();assert.equal(h.session.loopEnd,3);const move=cycleGesture(s,'move',0,.01,{grid:'off',alignment:'absolute'});assert.ok(Math.abs(move.loopStart-1.11)<1e-12);
});
