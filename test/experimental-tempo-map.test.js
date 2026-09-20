import test from 'node:test';import assert from 'node:assert/strict';
import {compileTempoMap,durationForBeats,retimeMidiTracks} from '../src/experimental/tempo-map.js';
import {newSession,applyCommands,SessionHistory} from '../src/experimental/session.js';
import {formatMusicalPosition,parseMusicalPosition,timelineTicks} from '../src/experimental/timeline-ruler.js';
import {arrangementStep,snapArrangementTime,snapArrangementDelta} from '../src/experimental/arrangement-snap.js';
const timing={tempo:120,meter:4,tempoChanges:[{id:'slow',beat:8,bpm:60},{id:'fast',beat:12,bpm:180}]};
test('piecewise beat/time conversion is continuous, invertible and exact at tempo boundaries',()=>{
 const map=compileTempoMap(timing);assert.deepEqual(map.points.map(p=>[p.beat,p.time,p.bpm]),[[0,0,120],[8,4,60],[12,8,180]]);
 for(const [beat,time]of [[-2,-1],[0,0],[8,4],[9,5],[12,8],[18,10]]){assert.equal(map.timeAtBeat(beat),time);assert.equal(map.beatAtTime(time),beat);}
 assert.equal(map.tempoAtTime(3.999),120);assert.equal(map.tempoAtTime(4),60);assert.equal(map.tempoAtBeat(12),180);assert.equal(map.tempoAtTime(-1),120);
 for(let t=-3;t<86400;t+=31.713)assert.ok(Math.abs(map.timeAtBeat(map.beatAtTime(t))-t)<1e-9);
 assert.equal(durationForBeats(timing,3,4),3);assert.equal(durationForBeats(timing,4,-2),-1);
});
test('maps validate duplicates, limits and precision, and are isolated from mutable source data',()=>{
 for(const input of [{tempo:0},{tempo:301},{tempo:NaN},{tempo:120,tempoChanges:[{beat:0,bpm:60}]},{tempo:120,tempoChanges:[{beat:2,bpm:60},{beat:2,bpm:90}]},{tempo:20,tempoChanges:[{beat:40000,bpm:100}]},{tempo:120,tempoChanges:Array.from({length:257},(_,i)=>({beat:i+1,bpm:100}))}])assert.throws(()=>compileTempoMap(input));
 const source=structuredClone(timing),map=compileTempoMap(source);source.tempoChanges[0].bpm=300;assert.equal(map.tempoAtTime(4),60);assert.throws(()=>{map.points[1].bpm=300;});assert.throws(()=>map.timeAtBeat(Infinity));assert.throws(()=>map.beatAtTime(NaN));assert.equal(compileTempoMap({tempo:90}).hasChanges,false);
});
test('MIDI retiming preserves musical endpoints across changes, including local events and fades',()=>{
 let s=applyCommands(newSession(),[{op:'track.add',values:{id:'m',kind:'midi'}},{op:'region.add',target:'m',values:{id:'r',start:2,duration:4}},{op:'region.set',target:'r',values:{fadeIn:1,fadeOut:1}},{op:'note.add',target:'r',values:{id:'n',start:.5,duration:3}},{op:'event.add',target:'r',values:{id:'e',type:'controlChange',parameter:64,value:127,start:3}},{op:'track.add',values:{id:'a',kind:'audio'}},{op:'region.add',target:'a',values:{duration:6}}]);const original=structuredClone(s.tracks);retimeMidiTracks(s.tracks,{tempo:120},timing);const r=s.tracks[0].regions[0];assert.deepEqual([r.start,r.duration,r.fadeIn,r.fadeOut],[2,6,1,2]);assert.deepEqual([r.notes[0].start,r.notes[0].duration,r.events[0].start],[.5,4.5,4]);assert.equal(r.notes[0].id,'n');assert.deepEqual(s.tracks[1],original[1]);retimeMidiTracks(s.tracks,timing,{tempo:120});assert.deepEqual(s.tracks,original);
});
test('retiming between two maps preserves beats for region and note endpoints',()=>{
 const old=timing,next={tempo:95,tempoChanges:[{beat:4,bpm:240},{beat:15,bpm:75}]},from=compileTempoMap(old),to=compileTempoMap(next);
 const tracks=[{kind:'midi',regions:[{start:3,duration:7,fadeIn:1,fadeOut:.5,notes:Array.from({length:50},(_,i)=>({id:'n'+i,start:i*.1,duration:.7})),events:[{id:'cc',start:2}]}]}],before=structuredClone(tracks);retimeMidiTracks(tracks,old,next);const a=before[0].regions[0],b=tracks[0].regions[0];for(const [x,y]of [[a.start,b.start],[a.start+a.duration,b.start+b.duration],...a.notes.flatMap((n,i)=>[[a.start+n.start,b.start+b.notes[i].start],[a.start+n.start+n.duration,b.start+b.notes[i].start+b.notes[i].duration]])])assert.ok(Math.abs(from.beatAtTime(x)-to.beatAtTime(y))<1e-10);
});
test('existing BPM commands use the shared retimer while preserving protection and undo',()=>{
 const base=applyCommands(newSession(),[{op:'track.add',values:{id:'m',kind:'midi'}},{op:'region.add',target:'m',values:{id:'r',start:2,duration:4}},{op:'note.add',target:'r',values:{id:'n',start:1,duration:2}}]),h=new SessionHistory(base);h.execute([{op:'session.set',values:{tempo:60}}]);assert.deepEqual([h.session.tracks[0].regions[0].start,h.session.tracks[0].regions[0].duration],[4,8]);h.undo();assert.deepEqual(h.session.tracks,base.tracks);
 const protectedSession=applyCommands(base,[{op:'track.set',target:'m',values:{protected:true}}]);assert.throws(()=>applyCommands(protectedSession,[{op:'session.set',values:{tempo:60}}]),/Unprotect/);const tooLong=structuredClone(base);tooLong.tracks[0].regions[0].start=50000;assert.throws(()=>applyCommands(tooLong,[{op:'session.set',values:{tempo:60}}]),/24-hour/);
});
test('musical ruler conversion and tick positions follow compiled tempo changes',()=>{
 assert.equal(formatMusicalPosition(5,timing),'3:2:000');assert.equal(parseMusicalPosition('3:2:000',timing),5);assert.equal(parseMusicalPosition('4:1',timing),8);const ticks=timelineTicks(timing,'musical',100,1200);assert.equal(ticks.find(t=>t.label==='3|1').time,4);assert.equal(ticks.find(t=>t.label==='4|1').time,8);assert.equal(ticks.find(t=>t.label==='5|1').time,8+4/3);assert.ok(timelineTicks(timing,'musical',1,86400).length<=1000);
});
test('musical snapping works in beats across boundaries; frame and seconds grids remain absolute time',()=>{
 assert.equal(arrangementStep(timing,'beat',4),1);assert.ok(Math.abs(snapArrangementDelta(timing,.7,3.8,{grid:'beat',alignment:'relative'})-.8)<1e-9);assert.ok(Math.abs(snapArrangementDelta(timing,1.08,4.1,{grid:'beat',alignment:'absolute'})-.9)<1e-9);assert.equal(snapArrangementTime(timing,4.6,'beat'),5);assert.equal(snapArrangementTime(timing,4.6,'second'),5);assert.equal(snapArrangementTime(timing,4.6,'beat',true),4.6);assert.equal(snapArrangementDelta(timing,.7,3.8,{grid:'beat',alignment:'relative'},true),.7);assert.equal(snapArrangementTime({...timing,frameRate:24},4.11,'frame'),Math.round(4.11*24)/24);
});
