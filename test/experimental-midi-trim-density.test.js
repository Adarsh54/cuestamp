import test from 'node:test';
import assert from 'node:assert/strict';
import {trimmedMidiRegion} from '../src/experimental/region-edit.js';
import {SessionHistory} from '../src/experimental/session.js';
const fixture=size=>({start:0,duration:100,fadeIn:0,fadeOut:0,notes:Array.from({length:size},(_,i)=>({id:'n'+i,start:i/size*90,duration:.2,channel:i%4,pitch:60,velocity:1})),events:Array.from({length:size},(_,i)=>({id:'e'+i,start:i/size*100,channel:i%4,type:'controlChange',parameter:64,value:i%8<4?127:0}))});
test('dense MIDI trim visits controller channels a bounded number of times',()=>{
 const region=fixture(20000);let reads=0;
 for(const event of region.events){const channel=event.channel;Object.defineProperty(event,'channel',{enumerable:true,get(){reads++;return channel;}});}
 const result=trimmedMidiRegion(region,25,75);
 assert.equal(result.notes.length,11155);assert.ok(result.notes.every(n=>n.start>=0&&n.start+n.duration<=50+1e-9));
 // Detect a per-note scan without a machine-dependent timing threshold.
 assert.ok(reads<region.events.length*20,`Repeated controller scans: ${reads}`);
});
test('channel-isolated crop retains pedal-held notes and respects resets',()=>{
 const events=[{id:'on',start:0,channel:0,type:'controlChange',parameter:64,value:127},{id:'reset',start:3,channel:0,type:'controlChange',parameter:121,value:0}];
 const region={start:0,duration:5,fadeIn:0,fadeOut:0,events,notes:[{id:'a',start:0,duration:1,channel:0},{id:'b',start:0,duration:1,channel:1}]};
 const result=trimmedMidiRegion(region,2,5);assert.deepEqual(result.notes.map(n=>[n.id,n.start,n.duration]),[['a',0,1]]);assert.equal(trimmedMidiRegion(region,3.5,5).notes.length,0);
});
test('dense shared trim command is undoable and invalid batches remain atomic',()=>{
 const seed=new SessionHistory();seed.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:100}}]);
 Object.assign(seed.session.tracks[0].regions[0],fixture(2000));const h=new SessionHistory(seed.session),before=structuredClone(h.session);
 h.execute([{op:'region.trim',target:'r',values:{start:25,end:75}}]);assert.equal(h.session.tracks[0].regions[0].duration,50);h.undo();assert.deepEqual(h.session.tracks,before.tracks);
 assert.throws(()=>h.execute([{op:'region.trim',target:'r',values:{start:25,end:75}},{op:'region.trim',target:'r',values:{start:0,end:100}}]));assert.deepEqual(h.session.tracks,before.tracks);
});
