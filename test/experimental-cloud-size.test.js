import test from 'node:test';import assert from 'node:assert/strict';
import {createDawCloud} from '../src/experimental/cloud.js';
import {newSession,applyCommands,sessionSchema} from '../src/experimental/session.js';
test('oversized valid account documents fail before reserving or uploading media',async()=>{
 const base=applyCommands(newSession(),[{op:'track.add',values:{id:'t'}},{op:'region.add',target:'t',values:{id:'r',assetId:'source',duration:1,name:'x'.repeat(100)}}]);
 const session=sessionSchema.parse({...base,tracks:Array.from({length:64},(_,i)=>({...base.tracks[0],id:`t${i}`,regions:Array.from({length:100},(_,j)=>({...base.tracks[0].regions[0],id:`r${i}_${j}`}))}))});assert.ok(JSON.stringify(session).length>1024*1024);
 let requests=0,uploads=0;const cloud=createDawCloud({key:'size-test',request:async()=>{requests++;throw Error('unexpected request');},uploadFile:async()=>{uploads++;}});
 await assert.rejects(()=>cloud.save(session,new Map([['source',new File(['audio'],'source.wav')]]),()=>{}),/1 MB/);assert.equal(requests,0);assert.equal(uploads,0);
});
