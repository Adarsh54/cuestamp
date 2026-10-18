import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionHistory} from '../src/experimental/session.js';
import {renderOfflineSession} from '../src/experimental/offline-render.js';
function install({pending=false}={}){
 const previous=globalThis.OfflineAudioContext,instances=[];
 class Context{
  constructor(channels,length,sampleRate){Object.assign(this,{sampleRate,length,currentTime:0,nodes:[]});this.destination=this.node();instances.push(this);}
  node(){const p=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}),node={gain:p(),pan:p(),threshold:p(),ratio:p(),knee:p(),attack:p(),release:p(),connect(n){return n;},disconnect(){this.disconnected=true;}};this.nodes.push(node);return node;}
  createGain(){return this.node();}createStereoPanner(){return this.node();}createDynamicsCompressor(){return this.node();}
  createBuffer(channels,length,sampleRate){const pcm=Array.from({length:channels},()=>new Float32Array(length));return {length,sampleRate,numberOfChannels:channels,duration:length/sampleRate,getChannelData:c=>pcm[c],copyToChannel:(data,c)=>pcm[c].set(data)};}
  startRendering(){this.started=true;this.rendered=this.createBuffer(2,this.length,this.sampleRate);this.rendered.getChannelData(0).forEach((_,i,a)=>{a[i]=i;});if(pending)return new Promise(resolve=>this.finish=()=>resolve(this.rendered));return Promise.resolve(this.rendered);}
 }
 globalThis.OfflineAudioContext=Context;return {instances,restore(){if(previous===undefined)delete globalThis.OfflineAudioContext;else globalThis.OfflineAudioContext=previous;}};
}
test('offline renderer allocates delayed ending, trims only latency and cleans the graph',async()=>{
 const mock=install();try{const h=new SessionHistory();h.execute([{op:'effect.add',target:h.session.id,values:{kind:'compressor'}}]);const result=await renderOfflineSession(h.session,new Map(),{position:1,duration:.1,sampleRate:48000});assert.equal(mock.instances[0].length,5088);assert.equal(result.length,4800);assert.equal(result.getChannelData(0)[0],288);assert.equal(result.getChannelData(0).at(-1),5087);assert.ok(mock.instances[0].nodes.slice(1).every(n=>n.disconnected));}finally{mock.restore();}
});
test('zero-latency renders reuse their native buffer without another allocation',async()=>{
 const mock=install();try{const result=await renderOfflineSession(new SessionHistory().session,new Map(),{duration:.1,sampleRate:48000});assert.equal(result,mock.instances[0].rendered);}finally{mock.restore();}
});
test('cancellation rejects while offline rendering is pending and disconnects graph without returning an artifact',async()=>{
 const mock=install({pending:true});try{const controller=new AbortController(),promise=renderOfflineSession(new SessionHistory().session,new Map(),{duration:1,sampleRate:48000,signal:controller.signal});while(!mock.instances[0]?.started)await new Promise(resolve=>setImmediate(resolve));controller.abort();await assert.rejects(promise,{name:'AbortError'});assert.ok(mock.instances[0].nodes.slice(1).every(n=>n.disconnected));mock.instances[0].finish();}finally{mock.restore();}
});
test('invalid or already canceled offline requests allocate no context',async()=>{
 const mock=install();try{const session=new SessionHistory().session;for(const options of [{duration:601,sampleRate:48000},{duration:0,sampleRate:48000},{duration:1,sampleRate:0},{position:-1,duration:1,sampleRate:48000}])await assert.rejects(renderOfflineSession(session,new Map(),options));const controller=new AbortController();controller.abort();await assert.rejects(renderOfflineSession(session,new Map(),{duration:1,sampleRate:48000,signal:controller.signal}),{name:'AbortError'});assert.equal(mock.instances.length,0);}finally{mock.restore();}
});
