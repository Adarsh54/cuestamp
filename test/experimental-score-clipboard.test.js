import test from 'node:test';import assert from 'node:assert/strict';
import {SessionHistory} from '../src/experimental/session.js';
import {copyScoreNotes,pasteScoreNotes} from '../src/experimental/score-clipboard.js';
const setup=()=>{const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},{op:'note.add',target:'r',values:{id:'a',pitch:60,start:0,duration:.5,velocity:.7}},{op:'note.add',target:'r',values:{id:'b',pitch:64,start:.5,duration:.5,velocity:.9}},{op:'region.add',target:'t',values:{id:'d',start:4,duration:.5}},{op:'tempo.add',values:{beat:8,bpm:60}}]);return h;};
test('score clipboard snapshots notes and preserves beats at a different tempo with atomic extension and Undo',()=>{
 const h=setup(),source=h.session.tracks[0].regions[0],clip=copyScoreNotes(h.session,source,['a','b']);
 h.execute([{op:'note.delete',target:'a'}]);const before=structuredClone(h.session.tracks);
 const commands=pasteScoreNotes(h.session,clip,{regionId:'d',beat:1,extend:true});h.execute(commands);
 const dest=h.session.tracks[0].regions[1];assert.deepEqual(dest.notes.map(n=>[n.pitch,n.start,n.duration,n.velocity]),[[60,1,1,.7],[64,2,1,.9]]);assert.equal(dest.duration,3);assert.ok(dest.notes.every(n=>!['a','b'].includes(n.id)));h.undo();assert.deepEqual(h.session.tracks,before);
});
test('score paste supports seconds and same-region copies with independent IDs',()=>{
 const h=setup(),r=h.session.tracks[0].regions[0],clip=copyScoreNotes(h.session,r,['a','b']);
 h.execute(pasteScoreNotes(h.session,clip,{regionId:'d',beat:0,timing:'seconds',extend:true}));assert.deepEqual(h.session.tracks[0].regions[1].notes.map(n=>[n.start,n.duration]),[[0,.5],[.5,.5]]);
 h.execute(pasteScoreNotes(h.session,clip,{regionId:'r',beat:4}));assert.deepEqual(h.session.tracks[0].regions[0].notes.slice(2).map(n=>n.start),[2,2.5]);
});
test('score paste rejects missing destinations, project changes, bad timing and insufficient space',()=>{
 const h=setup(),clip=copyScoreNotes(h.session,h.session.tracks[0].regions[0],['a','b']);
 for(const options of [{regionId:'missing'},{regionId:'d'},{regionId:'r',beat:NaN},{regionId:'r',beat:-1},{regionId:'r',timing:'invalid'}])assert.throws(()=>pasteScoreNotes(h.session,clip,options));
 assert.throws(()=>pasteScoreNotes({...h.session,id:'another'},clip,{regionId:'r'}));assert.throws(()=>copyScoreNotes(h.session,h.session.tracks[0].regions[0],['missing']));
});
