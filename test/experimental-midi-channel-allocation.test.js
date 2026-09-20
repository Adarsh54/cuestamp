import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {midiChannelAllocation} from '../src/experimental/midi-channel-allocation.js';
const track=(id,channel,extra={})=>[{op:'track.add',values:{id,kind:'midi',...extra}},{op:'region.add',target:id,values:{id:'r'+id,duration:4}},{op:'note.add',target:'r'+id,values:{pitch:60,start:0,duration:1,channel}},{op:'event.add',target:'r'+id,values:{type:'pitchBend',start:0,value:10000,channel}}];
test('allocation preserves unique assignments, resolves collisions and keeps controllers with notes',()=>{
 const h=new SessionHistory(applyCommands(newSession(),[...track('a',0),...track('b',0),...track('c',1)])),before=structuredClone(h.session);
 h.execute([{op:'midi.allocateChannels'}]);assert.deepEqual(h.session.tracks.map(t=>t.regions[0].notes[0].channel),[0,2,1]);assert.deepEqual(h.session.tracks.map(t=>t.regions[0].events[0].channel),[0,2,1]);
 assert.ok(midiChannelAllocation(h.session).every(p=>p.from===p.to));h.undo();assert.deepEqual(h.session,{...before,revision:h.session.revision});
});
test('drum and protected channels remain fixed while muted and controller-only parts are allocated',()=>{
 const s=applyCommands(newSession(),[...track('drums',9,{instrument:'drumKit'}),...track('locked',0),{op:'track.set',target:'locked',values:{protected:true}},...track('muted',0),{op:'track.set',target:'muted',values:{mute:true}},...track('controller',2),{op:'notes.delete',target:'rcontroller',values:{}},{op:'event.add',target:'rmuted',values:{type:'controlChange',parameter:7,value:80,start:0,channel:3}}]);
 const result=applyCommands(s,[{op:'midi.allocateChannels'}]);assert.deepEqual(result.tracks[0],s.tracks[0]);assert.deepEqual(result.tracks[1],s.tracks[1]);assert.equal(result.tracks[2].regions[0].notes[0].channel,1);assert.equal(result.tracks[2].regions[0].events[1].channel,3);assert.equal(result.tracks[3].regions[0].events[0].channel,2);
});
test('capacity and protected collisions reject the entire allocation',()=>{
 const h=new SessionHistory(newSession());for(let i=0;i<16;i++)h.execute(track('t'+i,0));const before=structuredClone(h.session);assert.throws(()=>h.execute([{op:'midi.allocateChannels'}]),/available/);assert.deepEqual(h.session,before);
 const locked=new SessionHistory(applyCommands(newSession(),[...track('a',0),...track('b',0),{op:'track.set',target:'a',values:{protected:true}},{op:'track.set',target:'b',values:{protected:true}}]));assert.throws(()=>locked.execute([{op:'midi.allocateChannels'}]),/protected/);
});
