import test from 'node:test';
import assert from 'node:assert/strict';
import {snapZoneBoundary} from '../src/experimental/sampler-zone-waveform.js';
const make=(channels)=>({sampleRate:1000,length:100,duration:.1,numberOfChannels:channels.length,getChannelData:c=>channels[c]});
const signal=()=>Float32Array.from({length:100},(_,i)=>i<30?-0.5:i<70?0.5:-0.5);
test('zone edge snaps to nearby shared crossing without changing other edge or input',()=>{
 const b=make([signal(),signal()]),r={start:.032,end:.068};
 assert.deepEqual(snapZoneBoundary(b,r,'start'),{start:.03,end:.068});
 assert.deepEqual(snapZoneBoundary(b,r,'end'),{start:.032,end:.07});
 assert.deepEqual(r,{start:.032,end:.068});
});
test('zone crossing search respects source selection, opposite edge and five millisecond radius',()=>{
 const b=make([signal()]);
 assert.throws(()=>snapZoneBoundary(b,{start:.032,end:.068},'start',{start:.031,end:.08}),/No shared/);
 assert.throws(()=>snapZoneBoundary(b,{start:.032,end:.068},'end',{start:0,end:.069}),/No shared/);
 assert.throws(()=>snapZoneBoundary(b,{start:.032,end:.034},'end'),/No shared/);
 assert.throws(()=>snapZoneBoundary(b,{start:.04,end:.08},'start'),/No shared/);
});
test('stereo requires both channels to cross, rejects invalid ranges and preserves failed edits',()=>{
 const b=make([signal(),new Float32Array(100).fill(.5)]),r={start:.032,end:.068};
 assert.throws(()=>snapZoneBoundary(b,r,'start'),/No shared/);
 assert.deepEqual(r,{start:.032,end:.068});
 assert.throws(()=>snapZoneBoundary(b,{start:NaN,end:.06},'start'),/valid boundaries/);
 assert.throws(()=>snapZoneBoundary(b,r,'other'),/valid boundaries/);
});
