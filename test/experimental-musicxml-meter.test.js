import test from 'node:test';
import assert from 'node:assert/strict';
import {musicxmlMeter} from '../src/experimental/musicxml-meter.js';
const pair=(beats,denominator)=>({beats,denominator});
test('MusicXML additive and mixed-denominator meters retain their measure duration',()=>{
 assert.deepEqual(musicxmlMeter([pair('3 + 2','8')]),{beats:5,denominator:8});
 assert.deepEqual(musicxmlMeter([pair('2','4'),pair('3','8')]),{beats:7,denominator:8});
 assert.deepEqual(musicxmlMeter([pair('3+3+2','8')]),{beats:8,denominator:8});
 assert.deepEqual(musicxmlMeter([pair('6','8')]),{beats:6,denominator:8});
 assert.deepEqual(musicxmlMeter([pair('2','2'),pair('2','4')]),{beats:6,denominator:4});
});
test('MusicXML meters reject invalid terms and session-incompatible totals',()=>{
 for(const beats of ['','0','-1','3-2','2++3','2+','+2','2.5','Infinity','1e1','0x10','2+0','33'])assert.throws(()=>musicxmlMeter([pair(beats,8)]));
 for(const denominator of [0,3,64,'',null,'0x8','8e0','8.0'])assert.throws(()=>musicxmlMeter([pair('4',denominator)]));
 assert.throws(()=>musicxmlMeter([pair('32',4),pair('1',8)]),/32 beats/);
 assert.throws(()=>musicxmlMeter([]));
});
