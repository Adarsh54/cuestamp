import test from 'node:test';import assert from 'node:assert/strict';
import {scissorsCut} from '../src/experimental/scissors.js';
const session={tempo:120,tracks:[{regions:[{id:'a',start:0,duration:4},{id:'b',start:1,duration:2},{id:'later',start:6,duration:2}]}]};
test('scissors snap to absolute sixteenth-note grid and Shift preserves exact pointer time',()=>{
 assert.equal(scissorsCut(session,'a',[],1.19).time,1.25);assert.equal(scissorsCut(session,'a',[],1.19,{snap:false}).time,1.19);assert.equal(scissorsCut({...session,tempo:60},'a',[],1.19).time,1.25);
});
test('clicking a selection splits its crossing regions; clicking outside scopes to one region',()=>{
 assert.deepEqual(scissorsCut(session,'a',['a','b','later'],2.1),{time:2.125,regionIds:['a','b','later'],count:2});assert.deepEqual(scissorsCut(session,'b',['a'],2.1),{time:2.125,regionIds:['b'],count:1});
});
test('boundaries and snapping outside a short region produce a noncommitting preview',()=>{
 assert.equal(scissorsCut(session,'a',[],0).count,0);assert.equal(scissorsCut(session,'a',[],4).count,0);const short={tempo:120,tracks:[{regions:[{id:'tiny',start:.02,duration:.02}]}]};assert.equal(scissorsCut(short,'tiny',[],.03).count,0);assert.equal(scissorsCut(short,'tiny',[],.03,{snap:false}).count,1);
});
test('invalid times and missing/duplicate selections reject before cutting',()=>{
 for(const time of [-1,NaN,Infinity,86401])assert.throws(()=>scissorsCut(session,'a',[],time));assert.throws(()=>scissorsCut(session,'a',['a','a'],1));assert.throws(()=>scissorsCut(session,'missing',[],1));assert.throws(()=>scissorsCut(session,'a',['a','missing'],1));
});
