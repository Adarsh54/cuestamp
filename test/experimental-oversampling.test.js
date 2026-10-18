import test from 'node:test';import assert from 'node:assert/strict';import {FourTimesInterpolator,FourTimesDecimator,oversamplingLatencyFrames} from '../src/experimental/oversampling.js';
const buffer=n=>[new Float64Array(n),new Float64Array(n)];
function roundtrip(input,block=128){const up=new FourTimesInterpolator(),down=new FourTimesDecimator(),out=buffer(input[0].length);for(let i=0;i<input[0].length;i+=block){const n=Math.min(block,input[0].length-i),high=buffer(n*4);up.process(input.map(c=>c.subarray(i,i+n)),high);down.process(high,out.map(c=>c.subarray(i,i+n)));}return out;}
function amplitude(data,frequency,start=512){let re=0,im=0;const count=data.length-start;for(let i=start;i<data.length;i++){re+=data[i]*Math.cos(2*Math.PI*frequency*i);im+=data[i]*Math.sin(2*Math.PI*frequency*i);}return 2*Math.hypot(re,im)/count;}
test('resampling preserves DC/stereo gain, has 64-frame roundtrip group delay and finite impulse tails',()=>{
 const impulse=buffer(512);impulse[0][0]=1;impulse[1][0]=.25;const out=roundtrip(impulse);const peak=out[0].indexOf(Math.max(...out[0]));assert.equal(peak,oversamplingLatencyFrames);for(let i=0;i<out[0].length;i++){assert.equal(out[1][i],out[0][i]*.25);if(i>128)assert.equal(out[0][i],0);if(i<=128)assert.ok(Math.abs(out[0][i]-out[0][128-i])<1e-14);}
 const dc=roundtrip([new Float64Array(1024).fill(.75),new Float64Array(1024).fill(-.25)]);assert.ok(Math.abs(dc[0].at(-1)-.75)<1e-10);assert.ok(Math.abs(dc[1].at(-1)+.25)<1e-10);
});
test('polyphase interpolation and decimation are invariant to block sizes and reset removes histories',()=>{
 const input=[Float64Array.from({length:4096},(_,i)=>Math.sin(i*.7)*.3),Float64Array.from({length:4096},(_,i)=>Math.cos(i*.17)*.7)],reference=roundtrip(input,4096);for(const block of [1,7,37,128,511])assert.deepEqual(roundtrip(input,block),reference);
 for(const Stage of [FourTimesInterpolator,FourTimesDecimator]){const stage=new Stage(),src=buffer(128),dst=buffer(Stage===FourTimesInterpolator?512:32);src[0].fill(.5);stage.process(src,dst);stage.reset();src[0].fill(0);stage.process(src,dst);assert.ok(dst.flatMap(c=>Array.from(c)).every(v=>v===0));}
});
test('passband and anti-alias rejection meet measured frequency targets',()=>{
 const n=32768,metrics=[];for(const f of [.01,.1,.25,.4,.44]){const input=[Float64Array.from({length:n},(_,i)=>Math.sin(2*Math.PI*f*i)),new Float64Array(n)],out=roundtrip(input),gain=amplitude(out[0],f,1024)/amplitude(input[0],f,1024);metrics.push({f,gainDb:20*Math.log10(gain)});assert.ok(Math.abs(20*Math.log10(gain))<.01,JSON.stringify(metrics));}
 // An unwanted high-rate tone above the base-rate Nyquist would alias without filtering.
 for(const f of [.14,.16,.2,.3,.45]){const high=buffer(n*4),low=buffer(n);for(let i=0;i<high[0].length;i++)high[0][i]=Math.sin(2*Math.PI*f*i);new FourTimesDecimator().process(high,low);const rms=Math.sqrt(low[0].slice(512).reduce((s,v)=>s+v*v,0)/(n-512));assert.ok(20*Math.log10(rms*Math.SQRT2)<-85,`stopband ${f}: ${20*Math.log10(rms*Math.SQRT2)} dB`);}
});
test('bad shapes, aliased buffers and nonfinite blocks reject before altering filter history',()=>{
 for(const Stage of [FourTimesInterpolator,FourTimesDecimator]){const stage=new Stage(1),n=128,m=Stage===FourTimesInterpolator?512:32,input=[new Float64Array(n)],output=[new Float64Array(m)];input[0][0]=1;input[0][127]=NaN;assert.throws(()=>stage.process(input,output),/finite/);assert.ok(stage.history[0].every(v=>v===0));assert.throws(()=>stage.process([new Float32Array(3)],[new Float32Array(2)]),/ratio/);const shared=new ArrayBuffer(4096);assert.throws(()=>stage.process([new Float64Array(shared,0,n)],[new Float64Array(shared,0,m)]),/alias/);assert.throws(()=>new Stage(3));}
});
test('analysis interpolation retains near-Nyquist tones with declared longer delay',()=>{
 const up=new FourTimesInterpolator(1,{quality:'analysis'}),n=12000,input=Float64Array.from({length:n},(_,i)=>Math.sin(2*Math.PI*.49*i)),out=new Float64Array(n*4);up.process([input],[out]);assert.equal(up.latencyFrames,256);const gain=amplitude(out,.49/4,8000)/amplitude(input,.49,2000);assert.ok(Math.abs(20*Math.log10(gain))<.01,String(20*Math.log10(gain)));assert.equal(up.history[0].length,1026);assert.throws(()=>new FourTimesInterpolator(1,{quality:'unknown'}));
});
