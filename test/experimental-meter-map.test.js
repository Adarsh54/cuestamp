import test from 'node:test';import assert from 'node:assert/strict';import {compileMeterMap} from '../src/experimental/meter-map.js';
const source={meter:4,meterChanges:[{id:'compound',bar:3,numerator:6,denominator:8},{id:'odd',bar:5,numerator:7,denominator:4}]};
test('signature maps convert changing bars and notated beats to quarter-note time',()=>{
 const map=compileMeterMap(source);assert.deepEqual(map.points.map(p=>[p.bar,p.beat]),[[1,0],[3,8],[5,14]]);
 assert.equal(map.barStart(4),11);assert.equal(map.barStart(6),21);
 assert.equal(map.beatAtPosition(3,6,.5),10.75);assert.deepEqual(map.positionAtBeat(10.75),{bar:3,beat:6,fraction:.5});
 assert.deepEqual(map.positionAtBeat(14),{bar:5,beat:1,fraction:0});
 for(let beat=0;beat<10000;beat+=.137){const p=map.positionAtBeat(beat);assert.ok(Math.abs(map.beatAtPosition(p.bar,p.beat,p.fraction)-beat)<1e-9);}
});
test('each denominator defines notated beat length without altering quarter-note time',()=>{
 for(const denominator of [1,2,4,8,16,32,64]){const map=compileMeterMap({meter:3,meterDenominator:denominator});assert.equal(map.barStart(2),12/denominator);assert.equal(map.beatAtPosition(1,2),4/denominator);assert.deepEqual(map.positionAtBeat(12/denominator),{bar:2,beat:1,fraction:0});}
});
test('signature maps reject ambiguous positions and detach immutable points',()=>{
 for(const input of [{meter:0},{meterDenominator:3},{meterChanges:[{bar:1,numerator:4,denominator:4}]},{meterChanges:[{bar:2,numerator:4,denominator:4},{bar:2,numerator:3,denominator:4}]},{meterChanges:[{bar:1000000,numerator:4,denominator:4}]}])assert.throws(()=>compileMeterMap(input));
 const s=structuredClone(source),map=compileMeterMap(s);s.meterChanges[0].numerator=3;assert.equal(map.signatureAtBar(3).numerator,6);assert.throws(()=>{map.points[0].numerator=3;});
 for(const args of [[0,1],[3,7],[1,1,1],[1,1,-.1]])assert.throws(()=>map.beatAtPosition(...args));assert.throws(()=>map.positionAtBeat(-1));assert.throws(()=>map.positionAtBeat(Infinity));
});
test('musical position text handles changing signatures together with changing tempo',async()=>{
 const {formatMusicalPosition,parseMusicalPosition}=await import('../src/experimental/timeline-ruler.js');
 const s={...source,tempo:120,tempoChanges:[{beat:8,bpm:60}]};
 assert.equal(formatMusicalPosition(4,s),'3:1:000');assert.equal(parseMusicalPosition('3:6:480',s),6.75);assert.equal(formatMusicalPosition(6.75,s),'3:6:480');
 assert.equal(formatMusicalPosition(10,s),'5:1:000');assert.throws(()=>parseMusicalPosition('3:7:000',s));
 for(const denominator of [1,2,4,8,16,32,64])for(const text of ['1:1:000','2:3:959','200:2:480']){const session={tempo:120,meter:3,meterDenominator:denominator};assert.equal(formatMusicalPosition(parseMusicalPosition(text,session),session),text);}
});
