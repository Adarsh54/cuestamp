import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {compileKeyMap} from '../src/experimental/key-map.js';
import {compileTempoMap} from '../src/experimental/tempo-map.js';
const source=()=>applyCommands(newSession(),[{op:'key.set',values:{sharps:0,mode:'major'}},...[4,8,12,16,24].map((beat,i)=>({op:'keyChange.add',values:{id:`k${i}`,beat,sharps:i+1,mode:'major'}}))]);
const at=(s,time)=>{const key=compileKeyMap(s).keyAtBeat(compileTempoMap(s).beatAtTime(time));return key?`${key.sharps}:${key.mode}`:null;};
function compare(result,original,mapping,end=20){for(let t=0;t<end;t+=.125)assert.equal(at(result,t),at(original,mapping(t)),`time ${t}`);}
test('insertion and deletion preserve the key of surviving passages across tempo changes',()=>{
 for(const tempoChanges of [[],[{id:'tempo',beat:8,bpm:60}]]){
  const s={...source(),tempoChanges};
  const inserted=applyCommands(s,[{op:'session.insertTime',values:{position:2,duration:2}}]);compare(inserted,s,t=>t<2?t:t<4?1.999:t-2);
  const deleted=applyCommands(s,[{op:'session.deleteTime',values:{start:2,end:6}}]);compare(deleted,s,t=>t<2?t:t+4);
  const beginning=applyCommands(s,[{op:'session.deleteTime',values:{start:0,end:2}}]);compare(beginning,s,t=>t+2);assert.equal(beginning.keySignature.sharps,1);
 }
});
test('repeat and copy carry key changes and restore destination harmony at the end',()=>{
 const s=source();
 const repeated=applyCommands(s,[{op:'session.repeatSection',values:{start:2,end:6,count:2}}]);compare(repeated,s,t=>t<6?t:t<14?2+(t-6)%4:t-8,24);
 for(const position of [0,4,10]){
  const copy=applyCommands(s,[{op:'session.transferSection',values:{mode:'copy',start:2,end:6,position}}]);compare(copy,s,t=>t<position?t:t<position+4?2+t-position:t-4,24);
 }
});
test('moving sections follows the source harmony and closes the original gap',()=>{
 const s=source();
 const moved=applyCommands(s,[{op:'session.transferSection',values:{mode:'move',start:2,end:6,position:12}}]);compare(moved,s,t=>t<2?t:t<8?t+4:t<12?t-6:t);
 const early=applyCommands(s,[{op:'session.transferSection',values:{mode:'move',start:8,end:12,position:2}}]);compare(early,s,t=>t<2?t:t<6?t+6:t<12?t-4:t);
});
test('unknown opening remains unknown; unsupported interior unknown transitions reject atomically',()=>{
 const h=new SessionHistory(source());h.execute([{op:'key.clear'}]);const s=structuredClone(h.session);
 h.execute([{op:'session.insertTime',values:{position:0,duration:2}}]);assert.equal(at(h.session,3),null);assert.equal(at(h.session,4),'1:major');h.undo();assert.deepEqual(h.session,{...s,revision:h.session.revision});
 const before=structuredClone(h.session);assert.throws(()=>h.execute([{op:'session.transferSection',values:{mode:'copy',start:0,end:2,position:8}}]),/unknown key/);assert.deepEqual(h.session,before);
});
test('overflow in key metadata rejects the entire time edit',()=>{
 const h=new SessionHistory(applyCommands(newSession(),[{op:'keyChange.add',values:{id:'last',beat:172799,sharps:1,mode:'major'}}])),before=structuredClone(h.session);
 assert.throws(()=>h.execute([{op:'session.insertTime',values:{position:0,duration:2}}]),/24-hour/);assert.deepEqual(h.session,before);
});

test('section transfers with changing tempo keep key changes aligned in seconds',()=>{
 const s={...source(),tempoChanges:[{id:'slower',beat:8,bpm:60}]};
 const result=applyCommands(s,[{op:'session.transferSection',values:{mode:'copy',start:2,end:6,position:10}}]);compare(result,s,t=>t<10?t:t<14?t-8:t-4,24);
});
test('named section swap and replacement carry harmonic labels',()=>{
 const s=applyCommands(source(),[{op:'section.add',values:{id:'left',name:'A',start:2,end:6}},{op:'section.add',values:{id:'right',name:'B',start:8,end:10}}]);
 const swapped=applyCommands(s,[{op:'section.editContent',target:'left',values:{action:'swap',otherId:'right'}}]);compare(swapped,s,t=>t<2?t:t<4?t+6:t<6?t+2:t<10?t-4:t);
 const replaced=applyCommands(s,[{op:'section.editContent',target:'left',values:{action:'replace',otherId:'right'}}]);compare(replaced,s,t=>t<2?t:t<4?t+6:t+2);
});
