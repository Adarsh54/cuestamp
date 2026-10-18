import test from 'node:test';import assert from 'node:assert/strict';
import {musicxmlTimingOffset,applyMusicxmlTiming} from '../src/experimental/musicxml-timing.js';
test('MusicXML performance offsets use active divisions and accept decimal signed values',()=>{
 assert.equal(musicxmlTimingOffset(null,4),0);
 assert.equal(musicxmlTimingOffset('-2',4),-.5);
 assert.equal(musicxmlTimingOffset('+1.5',3),.5);
 for(const v of ['', 'NaN','Infinity','0x10','1e2'])assert.throws(()=>musicxmlTimingOffset(v,4));
 assert.throws(()=>musicxmlTimingOffset('1',0));
});
test('independent attack and release timing preserves unmodified notes and removes transient metadata',()=>{
 const notes=[{start:2,duration:4,attackOffset:-.5,releaseOffset:.25},{start:6,duration:1,attackOffset:.25,releaseOffset:-.25},{start:8,duration:2}];
 applyMusicxmlTiming(notes);
 assert.deepEqual(notes,[{start:1.5,duration:4.75},{start:6.25,duration:.5},{start:8,duration:2}]);
});
test('performance timing rejects negative onsets, collapsed durations and out-of-range endings',()=>{
 for(const note of [{start:0,duration:1,attackOffset:-.1},{start:0,duration:1,attackOffset:1},{start:2,duration:1,releaseOffset:-1},{start:431999,duration:1,releaseOffset:1}])assert.throws(()=>applyMusicxmlTiming([note]),/inside the timeline/);
});
