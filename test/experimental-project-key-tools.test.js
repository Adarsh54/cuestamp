import test from 'node:test';import assert from 'node:assert/strict';
import {projectKeyScale} from '../src/experimental/key-map.js';import {newSession,SessionHistory} from '../src/experimental/session.js';
test('project keys resolve enharmonic tonics and natural minor scales',()=>{
 for(const [sharps,mode,root] of [[-7,'major',11],[7,'major',1],[0,'minor',9],[-3,'minor',0],[7,'minor',10]])assert.deepEqual(projectKeyScale({keySignature:{sharps,mode}}),{root,scale:mode});assert.throws(()=>projectKeyScale({}),/Set a project key/);
});
test('project scale command respects selection, preserves timing and supports undo',()=>{
 const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},{op:'note.add',target:'r',values:{id:'n',pitch:61,start:1,duration:1}},{op:'note.add',target:'r',values:{id:'other',pitch:61,start:2,duration:1}},{op:'key.set',values:{sharps:-3,mode:'minor'}}]);
 const original=structuredClone(h.session.tracks);h.execute([{op:'notes.scale',target:'r',values:{useProjectKey:true,noteId:'n'}}]);const notes=h.session.tracks[0].regions[0].notes;assert.equal(notes[0].pitch,60);assert.equal(notes[1].pitch,61);assert.equal(notes[0].start,1);h.undo();assert.deepEqual(h.session.tracks,original);
 for(const values of [{useProjectKey:true,root:0},{useProjectKey:'true'}])assert.throws(()=>h.execute([{op:'notes.scale',target:'r',values}]));h.execute([{op:'key.clear'}]);assert.throws(()=>h.execute([{op:'notes.scale',target:'r',values:{useProjectKey:true}}]),/Set a project key/);
});
