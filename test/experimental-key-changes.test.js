import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {readMidi,writeMidi} from '../src/experimental/midi.js';
import {compileKeyMap} from '../src/experimental/key-map.js';
import {conversationTurn} from '../src/experimental/agent-conversation.js';
const add=(id,beat,sharps=2)=>({op:'keyChange.add',values:{id,beat,sharps,mode:'minor'}});
test('key timeline sorts, persists, edits and deletes with undo; exported MIDI retains modulation',()=>{
 const h=new SessionHistory(newSession()),before=structuredClone(h.session);h.execute([{op:'key.set',values:{sharps:0,mode:'major'}},add('b',12,-3),add('a',4)]);
 assert.deepEqual(h.session.keyChanges.map(p=>p.id),['a','b']);assert.equal(compileKeyMap(h.session).keyAtBeat(5).sharps,2);
 const restored=new SessionHistory(JSON.parse(JSON.stringify(h.session)));assert.deepEqual(restored.session.keyChanges,h.session.keyChanges);
 const midi=readMidi(writeMidi(h.session).buffer);assert.deepEqual(midi.keySignatures.map(p=>[p.beat,p.sharps,p.mode]),[[0,0,'major'],[4,2,'minor'],[12,-3,'minor']]);
 const turn=conversationTurn({before,after:h.session,instruction:'Add modulations',summary:'Done',outcome:'applied'});assert.equal(turn.changes.filter(p=>p.entity==='key change').length,2);
 h.execute([{op:'keyChange.set',target:'a',values:{beat:8,mode:'major'}}]);assert.equal(h.session.keyChanges[0].beat,8);h.execute([{op:'keyChange.delete',target:'a'}]);assert.equal(h.session.keyChanges.length,1);h.undo();assert.equal(h.session.keyChanges.length,2);
});
test('invalid or ambiguous key changes reject whole batches; unknown initial key stays unknown',()=>{
 const h=new SessionHistory(newSession());h.execute([add('a',4)]);const before=structuredClone(h.session);
 for(const command of [add('b',4),add('a',8),add('b',0),add('b',8,8),add('b',432000)]){assert.throws(()=>h.execute([command]));assert.deepEqual(h.session,before);}
 assert.equal(compileKeyMap(h.session).keyAtBeat(0),null);h.execute([{op:'key.clear'}]);assert.equal(h.session.keyChanges.length,1);
});

test('key IDs cannot collide with existing project entities',()=>{
 const s=applyCommands(newSession(),[{op:'track.add',values:{id:'track',kind:'midi'}}]);assert.throws(()=>applyCommands(s,[add('track',4)]),/unique/);
});

test('key-change controls submit validated changes and reject blank positions',async()=>{
 const {bindKeyChanges,keyChangesView}=await import('../src/experimental/key-change-controls.js');const {projectKeys}=await import('../src/experimental/key-controls.js');const h=new SessionHistory(newSession());
 const form={elements:{beat:{value:'8'},key:{value:'-2:minor'}}};const root={querySelectorAll:()=>[],querySelector:()=>form};
 bindKeyChanges(root,{projectKeys,guard:f=>f,execute:commands=>h.execute(commands)});form.onsubmit({preventDefault(){}});assert.equal(h.session.keyChanges[0].beat,8);assert.equal(h.session.keyChanges[0].sharps,-2);
 const view=keyChangesView(h.session,projectKeys);assert.match(view,/Bar 3/);assert.match(view,/4.00 s/);assert.match(view,/data-key-change-delete/);
 const before=structuredClone(h.session);form.elements.beat.value='';assert.throws(()=>form.onsubmit({preventDefault(){}}),/Choose a beat/);assert.deepEqual(h.session,before);
});
