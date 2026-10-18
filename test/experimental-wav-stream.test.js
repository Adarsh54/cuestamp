import test from 'node:test';import assert from 'node:assert/strict';
import {writeWavStream,wavStreamLayout} from '../src/experimental/wav-stream.js';import {encodeWav} from '../src/experimental/wav.js';
const rng=()=>{let state=456;return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);};
function memorySink(){const parts=[];return {parts,closed:false,aborted:null,async write(bytes){parts.push(bytes.slice());},async close(){this.closed=true;},async abort(error){this.aborted=error;},bytes(){return Buffer.concat(parts);}};}
const split=(pcm,sizes)=>{let offset=0,index=0;return { *[Symbol.iterator](){while(offset<pcm[0].length){const end=Math.min(pcm[0].length,offset+sizes[index++%sizes.length]);yield pcm.map(channel=>channel.subarray(offset,end));offset=end;}}};};
test('streamed PCM is byte-identical across arbitrary chunk seams, formats, dither and cue labels',async()=>{
 for(const bitDepth of [16,24,32])for(const channels of [1,2])for(const dither of ['none','tpdf']){
  const frames=32771,pcm=Array.from({length:channels},(_,c)=>Float32Array.from({length:frames},(_,i)=>i%113===0?NaN:i%97===0?Infinity:1.5*Math.sin((i+c)*.13))),format={frames,channels,sampleRate:48000},markers=[{name:'Intro 🎵',time:0},{name:'Cut',time:.25}],options={bitDepth,dither,markers},sink=memorySink();
  const result=await writeWavStream(format,split(pcm,[1,127,4096,20001]),sink,{...options,random:rng()}),reference=await encodeWav({numberOfChannels:channels,length:frames,sampleRate:48000,getChannelData:c=>pcm[c]},{...options,random:rng()}).arrayBuffer();
  assert.deepEqual(sink.bytes(),Buffer.from(reference));assert.equal(result.bytes,reference.byteLength);assert.ok(sink.closed);assert.equal(sink.aborted,null);
 }
});
test('writer bounds encoded chunks and does not pull input while disk write is pending',async()=>{
 const format={channels:2,sampleRate:48000,frames:50000},pcm=[new Float32Array(50000),new Float32Array(50000)];let release,writeCount=0,pulls=0,maximum=0;
 const sink={async write(bytes){maximum=Math.max(maximum,bytes.length);if(++writeCount===2)await new Promise(resolve=>release=resolve);},async close(){},async abort(){}};
 const chunks={async *[Symbol.asyncIterator](){pulls++;yield pcm;pulls++;}},promise=writeWavStream(format,chunks,sink,{bitDepth:32});
 while(!release)await new Promise(resolve=>setImmediate(resolve));assert.equal(pulls,1);assert.equal(writeCount,2);release();await promise;assert.equal(pulls,2);assert.ok(maximum<=16384*2*4);
});
test('large headers are accurate without allocating their payload and reject RIFF overflow',async()=>{
 const layout=wavStreamLayout({channels:2,sampleRate:48000,frames:48000*3600},{bitDepth:24}),header=new DataView((await layout.header()).buffer);assert.equal(header.getUint32(40,true),48000*3600*6);assert.equal(header.getUint32(4,true),layout.totalBytes-8);assert.throws(()=>wavStreamLayout({channels:2,sampleRate:96000,frames:96000*7200},{bitDepth:32}),/size limit/);
 for(const invalid of [{channels:0},{sampleRate:0},{frames:0},{frames:Infinity}])assert.throws(()=>wavStreamLayout({channels:2,sampleRate:48000,frames:100,...invalid}));
});
test('short, long, malformed and failed streams abort their destination without closing',async()=>{
 const format={channels:1,sampleRate:48000,frames:3};for(const chunks of [[[new Float32Array(2)]],[[new Float32Array(4)]],[[new Float32Array(3),new Float32Array(3)]],[[[0,0,0]]]]){const sink=memorySink();await assert.rejects(writeWavStream(format,chunks,sink));assert.ok(sink.aborted);assert.equal(sink.closed,false);}
 const sink=memorySink(),error=Error('Disk full');sink.write=async()=>{throw error;};await assert.rejects(writeWavStream(format,[[new Float32Array(3)]],sink),error);assert.equal(sink.aborted,error);
});
test('abort interrupts an idle producer and returns its iterator',async()=>{
 const controller=new AbortController(),sink=memorySink();let returned=false,requested=false;const chunks={[Symbol.asyncIterator](){return {next(){requested=true;return new Promise(()=>{});},return(){returned=true;return {done:true};}};}};
 const promise=writeWavStream({channels:1,sampleRate:48000,frames:100},chunks,sink,{signal:controller.signal});while(!requested)await new Promise(resolve=>setImmediate(resolve));controller.abort();await assert.rejects(promise,{name:'AbortError'});assert.ok(returned);assert.equal(sink.closed,false);assert.equal(sink.aborted.name,'AbortError');
});
test('cancellation during a pending write stops progress and preserves the cancellation reason',async()=>{
 const controller=new AbortController();let writes=0,aborted,closed=false,progress=0,release;
 const sink={async write(){if(++writes===2)await new Promise(resolve=>release=resolve);},async close(){closed=true;},async abort(error){aborted=error;release?.();}};
 const pending=writeWavStream({channels:1,sampleRate:48000,frames:10},[[new Float32Array(10)]],sink,{signal:controller.signal,onProgress:()=>progress++});while(!release)await new Promise(resolve=>setImmediate(resolve));controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(aborted,controller.signal.reason);assert.equal(closed,false);assert.equal(progress,0);assert.equal(writes,2);
});
