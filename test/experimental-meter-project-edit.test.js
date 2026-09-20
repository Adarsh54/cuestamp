import test from 'node:test';import assert from 'node:assert/strict';
import {newSession} from '../src/experimental/session.js';
import {insertProjectTime} from '../src/experimental/insert-time.js';
import {deleteProjectTime} from '../src/experimental/delete-time.js';
import {repeatProjectSection} from '../src/experimental/repeat-section.js';
import {transferProjectSection} from '../src/experimental/section-transfer.js';
import {compileTempoMap} from '../src/experimental/tempo-map.js';
import {compileMeterMap} from '../src/experimental/meter-map.js';
const fixture=()=>({...newSession(),tempo:120,meter:4,meterChanges:[{id:'six',bar:3,numerator:6,denominator:8},{id:'three',bar:5,numerator:3,denominator:4}],markers:[{id:'m',name:'Six',time:4}]});
const positions=s=>{const tempo=compileTempoMap(s);return compileMeterMap(s).points.map(p=>[tempo.timeAtBeat(p.beat),p.numerator,p.denominator]);};
test('project insert/delete move markers and signatures together',()=>{
 const s=fixture();insertProjectTime(s,{position:2,duration:2});assert.equal(s.markers[0].time,6);assert.equal(positions(s)[1][0],6);
 deleteProjectTime(s,{start:2,end:4});assert.equal(s.markers[0].time,4);assert.deepEqual(s.meterChanges,fixture().meterChanges);
 const before=structuredClone(s);assert.throws(()=>insertProjectTime(s,{position:2,duration:.5}),/inside a bar/);assert.deepEqual(s,before);
});
test('repeat validates final signatures rather than temporary empty gap',()=>{
 const s=fixture();repeatProjectSection(s,{start:4,end:7,count:2});assert.deepEqual(positions(s),[[0,4,4],[4,6,8],[13,3,4]]);assert.deepEqual(s.markers.map(m=>m.time).sort((a,b)=>a-b),[4,7,10]);
});
test('copy section restores destination meter and moves later signatures',()=>{
 const s=fixture();transferProjectSection(s,{mode:'copy',start:4,end:7,position:2});assert.deepEqual(positions(s),[[0,4,4],[2,6,8],[5,4,4],[7,6,8],[10,3,4]]);assert.deepEqual(s.markers.map(m=>m.time),[7,2]);
});
test('move section retains signature IDs while relocating source material',()=>{
 const s=fixture();transferProjectSection(s,{mode:'move',start:4,end:7,position:2});assert.deepEqual(positions(s),[[0,4,4],[2,6,8],[5,4,4],[7,3,4]]);assert.equal(s.meterChanges[0].id,'six');assert.equal(s.markers[0].time,2);
});
