import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {sectionGesture} from '../src/experimental/section-gestures.js';
const fixture=()=>applyCommands(newSession(),[{op:'section.add',values:{id:'a',name:'Verse',start:0,end:4}},{op:'section.add',values:{id:'b',name:'Chorus',start:4,end:8}},{op:'section.add',values:{id:'c',name:'Outro',start:10,end:12}},{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{duration:12}}]);
test('body drags use original destinations while previews show final move positions',()=>{
 const s=fixture(),plan=sectionGesture(s,'a','move',8.1,{grid:'beat',alignment:'relative'});assert.equal(plan.position,8);assert.equal(plan.start,4);const out=applyCommands(s,plan.commands);assert.equal(out.sections.find(s=>s.id==='a').start,4);
 const copy=sectionGesture(s,'a','copy',2.1,{grid:'beat',alignment:'relative'});assert.equal(copy.start,2);assert.equal(copy.commands[0].values.action,'copy');assert.equal(applyCommands(s,copy.commands).sections.length,5);
 assert.throws(()=>sectionGesture(s,'a','move',2),/Move outside/);assert.deepEqual(sectionGesture(s,'a','move',4).commands,[]);assert.deepEqual(sectionGesture(s,'a','move',0).commands,[]);
});
test('shared boundary resize edits both labels without changing musical content',()=>{
 const s=fixture(),h=new SessionHistory(s),plan=sectionGesture(s,'b','start',.8,{grid:'beat',alignment:'relative'});assert.equal(plan.position,5);assert.equal(plan.commands.length,2);h.execute(plan.commands);assert.deepEqual(h.session.sections.slice(0,2).map(s=>[s.start,s.end]),[[0,5],[5,8]]);assert.deepEqual(h.session.tracks,s.tracks);h.undo();assert.deepEqual(h.session.sections,s.sections);
 const opposite=sectionGesture(s,'a','end',1,{grid:'off',alignment:'relative'});assert.deepEqual(opposite.preview.map(s=>[s.id,s.start,s.end]),[['a',0,5],['b',5,8]]);
});
test('resize clamps to neighboring bounds and keeps shared sections positive',()=>{
 const s=fixture();assert.equal(sectionGesture(s,'b','end',50).position,10);assert.equal(sectionGesture(s,'b','start',-50).position,.001);assert.equal(sectionGesture(s,'b','start',50).position,7.999);assert.equal(sectionGesture(s,'a','start',-50).position,0);assert.equal(sectionGesture(s,'c','end',100000).position,86400);
 for(const edge of ['start','end'])assert.doesNotThrow(()=>applyCommands(s,sectionGesture(s,'b',edge,100).commands));
});
test('relative/absolute snapping, Shift, frame grids and timeline limits',()=>{
 const s=fixture();s.sections[1].start=4.13;s.sections[1].end=8.13;
 assert.equal(sectionGesture(s,'b','copy',1.2,{grid:'second',alignment:'relative'}).position,5.13);assert.equal(sectionGesture(s,'b','copy',1.2,{grid:'second',alignment:'absolute'}).position,5);assert.equal(sectionGesture(s,'b','copy',1.2,{grid:'second',alignment:'absolute'},true).position,5.33);
 const frame=sectionGesture(s,'b','copy',.03,{grid:'frame',alignment:'absolute'});assert.ok(Math.abs(frame.position*24-Math.round(frame.position*24))<1e-9);assert.equal(sectionGesture(s,'b','copy',100000).position,86400-4);assert.equal(sectionGesture(s,'b','move',100000).end,86400);
 assert.throws(()=>sectionGesture(s,'missing','move',1));assert.throws(()=>sectionGesture(s,'a','bad',1));assert.throws(()=>sectionGesture(s,'a','move',NaN));
});
test('drag command batches retain protection, atomic undo and revision checks',()=>{
 const s=fixture(),h=new SessionHistory(s),plan=sectionGesture(s,'b','move',-4);h.execute(plan.commands,s.revision);assert.equal(h.session.sections.find(s=>s.id==='b').start,0);h.undo();assert.deepEqual(h.session.tracks,s.tracks);assert.throws(()=>h.execute(plan.commands,s.revision),/session changed/);
 const locked=applyCommands(s,[{op:'track.set',target:'t',values:{protected:true}}]);assert.throws(()=>applyCommands(locked,plan.commands),/Unprotect/);assert.doesNotThrow(()=>applyCommands(locked,sectionGesture(locked,'b','start',.5).commands));
});
