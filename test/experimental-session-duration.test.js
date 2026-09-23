import test from 'node:test';import assert from 'node:assert/strict';
import {sessionDuration} from '../src/experimental/audio-engine.js';import {routedTail} from '../src/experimental/routing.js';import {effectTail,effectSchema} from '../src/experimental/effects.js';
const oldDuration=session=>Math.max(1,...session.tracks.flatMap(t=>t.regions.map(r=>r.start+r.duration+routedTail(session,t))))+effectTail(session.masterEffects,session.masterAutomationMode==='off');
const fixture=()=>{
 const eq=effectSchema.parse({id:'eq',kind:'eq',type:'notch',frequency:50,q:15});
 return {tracks:[{id:'a',kind:'audio',effects:[eq],output:'b',sends:[{busId:'c'}],regions:[{start:10,duration:1},{start:0,duration:20}]},{id:'other',kind:'audio',effects:[],output:'b',sends:[],regions:[{start:1,duration:2}]},{id:'b',kind:'bus',effects:[eq],output:'c',sends:[],regions:[]},{id:'c',kind:'bus',effects:[eq],output:null,sends:[],regions:[]}],masterEffects:[eq]};
};
test('duration preserves longest region and shared routing tails without mutating the session',()=>{
 const s=fixture(),before=structuredClone(s);assert.equal(sessionDuration(s),oldDuration(s));assert.deepEqual(s,before);
 s.tracks[0].regions.reverse();assert.equal(sessionDuration(s),oldDuration(s));
});
test('duration memoization is discarded between edits and skips unused empty tracks',()=>{
 const s=fixture(),before=sessionDuration(s);s.tracks[2].effects=[];assert.ok(sessionDuration(s)<before);assert.equal(sessionDuration(s),oldDuration(s));
 assert.equal(sessionDuration({tracks:[],masterEffects:[]}),1);assert.equal(sessionDuration({tracks:[{...s.tracks[0],regions:[]}],masterEffects:[]}),1);
});
test('large arrangements do not depend on spread-argument limits',()=>{
 const track={id:'t',kind:'audio',effects:[],sends:[],output:null,regions:Array.from({length:1000},(_,i)=>({start:i,duration:1}))},s={tracks:Array.from({length:128},(_,i)=>({...track,id:'t'+i})),masterEffects:[]};assert.equal(sessionDuration(s),1000);
});
