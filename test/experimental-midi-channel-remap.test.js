import test from 'node:test';import assert from 'node:assert/strict';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {readMidi,writeMidi} from '../src/experimental/midi.js';
const setup=()=>applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'midi'}},...['a','b'].flatMap((id,i)=>[{op:'region.add',target:'t',values:{id,start:i*4,duration:4}},{op:'note.add',target:id,values:{id:`n${id}`,pitch:60,start:0,duration:1,channel:0}},{op:'event.add',target:id,values:{type:'pitchBend',value:16383,start:0,channel:0}},{op:'event.add',target:id,values:{type:'controlChange',parameter:64,value:127,start:0,channel:2}},{op:'event.add',target:id,values:{type:'programChange',value:12,start:0,channel:0}}])]);
test('region reassignment preserves every non-channel field and unrelated regions/controllers with undo',()=>{
 const h=new SessionHistory(setup()),before=structuredClone(h.session);h.execute([{op:'midi.remapChannel',target:'a',values:{from:0,to:5}}]);
 const expected=structuredClone(before);for(const item of [...expected.tracks[0].regions[0].notes,...expected.tracks[0].regions[0].events])if(item.channel===0)item.channel=5;expected.revision++;assert.deepEqual(h.session,expected);
 h.undo();assert.deepEqual(h.session,{...before,revision:h.session.revision});
});
test('track reassignment includes controller-only streams and survives MIDI export',()=>{
 const result=applyCommands(setup(),[{op:'midi.remapChannel',target:'t',values:{from:0,to:7}},{op:'midi.remapChannel',target:'t',values:{from:2,to:8}}]);const midi=readMidi(writeMidi(result).buffer);assert.ok(midi.tracks[0].notes.every(n=>n.channel===7));assert.ok(midi.tracks[0].events.every(e=>e.channel===(e.type==='controlChange'?8:7)));
});
test('merging requires explicit intent; invalid, absent and protected edits are atomic',()=>{
 const h=new SessionHistory(setup()),before=structuredClone(h.session);for(const values of [{from:0,to:2},{from:0,to:0},{from:9,to:1},{from:0,to:16}]){assert.throws(()=>h.execute([{op:'midi.remapChannel',target:'t',values}]));assert.deepEqual(h.session,before);}
 h.execute([{op:'midi.remapChannel',target:'a',values:{from:0,to:2,merge:true}}]);assert.equal(h.session.tracks[0].regions[0].notes[0].channel,2);
 h.execute([{op:'track.set',target:'t',values:{protected:true}}]);const locked=structuredClone(h.session);assert.throws(()=>h.execute([{op:'midi.remapChannel',target:'t',values:{from:0,to:5}}]),/protect/i);assert.deepEqual(h.session,locked);
});
