import test from 'node:test';import assert from 'node:assert/strict';import {SessionHistory,newSession} from '../src/experimental/session.js';import {timeScaleNotes} from '../src/experimental/note-time-scale.js';import {writeMidi,readMidi} from '../src/experimental/midi.js';
const fixture=()=>{const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:6}},...[{id:'a',start:1,duration:.5,pitch:60,channel:0},{id:'b',start:1,duration:1,pitch:64,channel:0},{id:'c',start:3,duration:2,pitch:67,channel:1}].map(values=>({op:'note.add',target:'r',values})),{op:'event.add',target:'r',values:{id:'cc',type:'controlChange',start:2,parameter:64,value:127,channel:0}}]);return h;};
const r=h=>h.session.tracks[0].regions[0];
test('time scaling preserves chord alignment, note metadata/controllers/tempo and supports undo',()=>{const h=fixture(),before=structuredClone(h.session);h.execute([{op:'notes.timeScale',target:'r',values:{factor:.5}}]);assert.deepEqual(r(h).notes.map(n=>[n.start,n.duration]),[[1,.25],[1,.5],[2,1]]);assert.deepEqual(r(h).events,before.tracks[0].regions[0].events);assert.equal(h.session.tempo,before.tempo);assert.deepEqual(r(h).notes.map(({start,duration,...n})=>n),before.tracks[0].regions[0].notes.map(({start,duration,...n})=>n));h.undo();assert.deepEqual(h.session.tracks,before.tracks);h.redo();assert.equal(r(h).notes[2].start,2);h.execute([{op:'notes.timeScale',target:'r',values:{factor:2}}]);assert.deepEqual(h.session.tracks,before.tracks);});
test('selection, region anchor and onset-only scaling are explicit; extension only grows region',()=>{const h=fixture();h.execute([{op:'notes.timeScale',target:'r',values:{factor:2,anchor:'region',scaleLengths:false,extendRegion:true,noteId:'c'}}]);assert.deepEqual(r(h).notes.map(n=>[n.start,n.duration]),[[1,.5],[1,1],[6,2]]);assert.equal(r(h).duration,8);h.execute([{op:'notes.timeScale',target:'r',values:{factor:.5,anchor:'region',scaleLengths:false,noteId:'c'}}]);assert.equal(r(h).notes[2].start,3);assert.equal(r(h).duration,8);});
test('invalid scaling rejects whole batches without clipping, extending or partial edits',()=>{const h=fixture(),before=structuredClone(h.session);for(const values of [{factor:0},{factor:17},{factor:NaN},{factor:2},{factor:.5,noteIds:''},{factor:.5,noteIds:'a,missing'},{factor:.5,anchor:'bad'},{factor:.5,extra:true}]){assert.throws(()=>h.execute([{op:'session.set',values:{title:'invalid'}},{op:'notes.timeScale',target:'r',values}]));assert.deepEqual(h.session,before);}assert.throws(()=>timeScaleNotes({duration:8000,notes:[{id:'a',start:0,duration:3600}]},{factor:2,extendRegion:true}),/limits/);assert.throws(()=>timeScaleNotes({duration:86400,notes:[{id:'a',start:80000,duration:1}]},{factor:2,anchor:'region',extendRegion:true}),/limits/);});
test('scaled note timings survive MIDI serialization',()=>{const h=fixture();h.execute([{op:'notes.timeScale',target:'r',values:{factor:.5,anchor:'region'}}]);const midi=readMidi(writeMidi(h.session).buffer);const notes=midi.tracks.flatMap(t=>t.notes).sort((a,b)=>a.pitch-b.pitch);assert.deepEqual(notes.map(n=>[n.pitch,n.start,n.duration]),[[60,.5,.25],[64,.5,.5],[67,1.5,1]]);});
test('musical scaling preserves rhythmic ratios across tempo changes, with undo and explicit extension',async()=>{
 const {regionBeatTiming}=await import('../src/experimental/tempo-map.js'),h=fixture();
 h.execute([{op:'tempo.add',values:{beat:8,bpm:60}}]);const before=structuredClone(r(h)),clock=regionBeatTiming(before,h.session),anchor=clock.beatAtTime(1);
 h.execute([{op:'notes.timeScale',target:'r',values:{factor:2,timing:'beats',extendRegion:true}}]);
 assert.deepEqual(r(h).notes.map(n=>[n.start,n.duration]),[[1,1],[1,2],[6,8]]);assert.equal(r(h).duration,14);
 for(let i=0;i<before.notes.length;i++){const a=before.notes[i],b=r(h).notes[i];assert.equal(clock.beatAtTime(b.start)-anchor,2*(clock.beatAtTime(a.start)-anchor));assert.equal(clock.beatsInDuration(b.start,b.duration),2*clock.beatsInDuration(a.start,a.duration));}
 assert.deepEqual(r(h).events,before.events);h.undo();assert.deepEqual(r(h),before);h.redo();
 h.execute([{op:'notes.timeScale',target:'r',values:{factor:.5,timing:'beats'}}]);assert.deepEqual(r(h).notes,before.notes);
});
test('onset-only musical scaling retains beat lengths and selection at an offbeat region origin',async()=>{
 const {regionBeatTiming}=await import('../src/experimental/tempo-map.js'),h=fixture();
 h.execute([{op:'region.move',target:'r',values:{trackId:'t',start:1.25}},{op:'tempo.add',values:{beat:8,bpm:90}}]);
 const before=structuredClone(r(h)),clock=regionBeatTiming(before,h.session),original=before.notes[2];
 h.execute([{op:'notes.timeScale',target:'r',values:{factor:2,timing:'beats',anchor:'region',scaleLengths:false,extendRegion:true,noteId:'c'}}]);
 const changed=r(h).notes[2];assert.ok(Math.abs(clock.beatAtTime(changed.start)-2*clock.beatAtTime(original.start))<1e-9);
 assert.ok(Math.abs(clock.beatsInDuration(changed.start,changed.duration)-clock.beatsInDuration(original.start,original.duration))<1e-9);
 assert.deepEqual(r(h).notes.slice(0,2),before.notes.slice(0,2));
});
test('musical scaling rejects missing timing, invalid units, oversized notes and absolute timeline overflow',()=>{
 const h=fixture(),before=structuredClone(h.session);
 assert.throws(()=>h.execute([{op:'notes.timeScale',target:'r',values:{factor:2,timing:'bad'}}]));assert.deepEqual(h.session,before);
 assert.throws(()=>timeScaleNotes(r(h),{factor:2,timing:'beats'}),/session timing/);
 assert.throws(()=>timeScaleNotes({start:86395,duration:4,notes:[{id:'n',start:1,duration:2}]},{factor:2,extendRegion:true,anchor:'region'},h.session),/maximum region/);
 const long={start:0,duration:15000,notes:[{id:'n',start:2000,duration:1000}]},timing={tempo:120,tempoChanges:[{beat:5000,bpm:20}]};
 assert.throws(()=>timeScaleNotes(long,{factor:2,timing:'beats',anchor:'region',extendRegion:true},timing),/limits/);
});
