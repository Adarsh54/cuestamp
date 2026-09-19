import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
const fixture=()=>applyCommands(newSession(),[
 {op:'track.add',values:{id:'a',kind:'midi',instrument:'sampler',sampleAssetId:'sample',sampleTune:12}},
 {op:'track.add',values:{id:'b',kind:'midi'}},{op:'track.add',values:{id:'bus',kind:'bus'}},
 {op:'region.add',target:'b',values:{id:'r',duration:2}},{op:'note.add',target:'r',values:{pitch:60,start:0,duration:1}},
 {op:'track.set',target:'a',values:{gainDb:-6,pan:.3,output:'bus'}},
 {op:'effect.add',target:'a',values:{id:'eq',kind:'eq',gainDb:4}},
 {op:'effect.automation.point',target:'eq',values:{parameter:'gainDb',time:1,value:2}},
 {op:'automation.point',target:'a',values:{parameter:'pan',time:1,value:.2}},
 {op:'send.set',target:'a',values:{busId:'bus',gainDb:-9}},
 {op:'send.automation.point',target:'a',values:{busId:'bus',time:1,value:-5}}
]);
const command=values=>({op:'track.copySettings',target:'b',values:{sourceId:'a',...values}});
test('channel settings copy preserves destination content, creates independent IDs and supports one undo',()=>{
 const h=new SessionHistory(fixture()),before=structuredClone(h.session),source=before.tracks[0],dest=before.tracks[1];
 h.execute([command({effects:true,mix:true,automation:true,routing:true,instrument:true})]);
 const result=h.session.tracks[1];assert.deepEqual(result.regions,dest.regions);for(const k of ['id','name','kind','mute','solo'])assert.equal(result[k],dest[k]);
 assert.equal(result.sampleAssetId,'sample');assert.equal(result.sampleTune,12);assert.equal(result.gainDb,-6);assert.equal(result.output,'bus');
 for(const [a,b]of [[result.effects[0],source.effects[0]],[result.effects[0].automation[0],source.effects[0].automation[0]],[result.automation[0],source.automation[0]],[result.sends[0].automation[0],source.sends[0].automation[0]]]){assert.notEqual(a.id,b.id);assert.deepEqual({...a,id:null,automation:null},{...b,id:null,automation:null});}
 assert.deepEqual(h.session.tracks[0],source);h.undo();assert.deepEqual(h.session.tracks,before.tracks);h.redo();assert.equal(h.session.tracks[1].sampleTune,12);
 const changed=applyCommands(h.session,[{op:'effect.set',target:result.effects[0].id,values:{gainDb:10}}]);assert.equal(changed.tracks[0].effects[0].gainDb,4);
});
test('category selection replaces only chosen settings and rejects invalid or dangerous operations atomically',()=>{
 const input=fixture(),before=structuredClone(input),result=applyCommands(input,[command({effects:true})]);
 assert.deepEqual({...result.tracks[1],effects:[]},input.tracks[1]);
 for(const values of [{},{mix:'yes'},{sourceId:'b',effects:true},{sourceId:'missing',mix:true},{sourceId:'bus',instrument:true},{effects:true,unknown:true}])assert.throws(()=>applyCommands(input,[command(values)]));
 assert.throws(()=>applyCommands(input,[{op:'track.copySettings',target:'bus',values:{sourceId:'a',routing:true}}]),/feedback/);
 const audio=applyCommands(input,[{op:'track.add',values:{id:'audio'}},{op:'track.add',values:{id:'video',kind:'video'}}]);
 assert.throws(()=>applyCommands(audio,[{op:'track.copySettings',target:'audio',values:{sourceId:'a',instrument:true}}]),/MIDI/);
 assert.throws(()=>applyCommands(audio,[command({sourceId:'video',effects:true})]),/Video/);
 assert.deepEqual(input,before);
});
