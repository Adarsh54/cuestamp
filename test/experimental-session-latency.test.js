import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionHistory} from '../src/experimental/session.js';
import {scheduleSession} from '../src/experimental/audio-engine.js';
import {sendAutomationTarget} from '../src/experimental/automation-recording-lane.js';
function fixture(){
 const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'wet',kind:'audio'}},{op:'track.add',values:{id:'dry',kind:'audio'}},{op:'track.add',values:{id:'a',kind:'bus'}},{op:'track.add',values:{id:'b',kind:'bus'}},{op:'effect.add',target:'wet',values:{id:'wc',kind:'compressor'}},{op:'effect.add',target:'a',values:{id:'ac',kind:'compressor'}},{op:'effect.add',target:h.session.id,values:{id:'mc',kind:'compressor'}},{op:'track.set',target:'wet',values:{output:'a'}},{op:'send.set',target:'wet',values:{busId:'b',gainDb:0}}]);
 const events=[],nodes=[];
 const param=()=>({value:0,cancelScheduledValues(t){events.push(['cancel',t]);},setValueAtTime(v,t){events.push(['set',v,t]);},linearRampToValueAtTime(v,t){events.push(['linear',v,t]);},exponentialRampToValueAtTime(v,t){events.push(['exp',v,t]);}});
 const node=kind=>{const n={kind,connections:[],disconnected:false,connect(other){this.connections.push(other);return other;},disconnect(){this.disconnected=true;}};for(const key of ['gain','pan','threshold','ratio','attack','release','knee','delayTime'])n[key]=param();nodes.push(n);return n;};
 const context={sampleRate:48000,currentTime:10,createGain:()=>node('gain'),createStereoPanner:()=>node('pan'),createDynamicsCompressor:()=>node('compressor'),createDelay:()=>node('delay'),destination:node('destination')};
 return {h,context,events,nodes};
}
test('session compensation delays summing paths, exposes both clocks and disconnects delay nodes',()=>{
 const {h,context,events,nodes}=fixture(),before=structuredClone(h.session),graph=scheduleSession(context,h.session,new Map(),1,{baseTime:10,compensateLatency:true,endPosition:1.2});
 assert.equal(graph.base,10);assert.equal(graph.outputBase,10.018);assert.equal(graph.latencyFrames,864);
 assert.deepEqual(nodes.filter(n=>n.kind==='delay').map(n=>n.delayTime.value).sort((a,b)=>a-b),[.006,.012]);
 assert.ok(events.some(e=>e[0]==='set'&&e[1]===0&&Math.abs(e[2]-10.218)<1e-12));
 assert.deepEqual(h.session,before);graph.stop();assert.ok(nodes.filter(n=>n.kind==='delay').every(n=>n.disconnected));graph.stop();
});
test('channel, send, master and insert live automation follow their processing locations',()=>{
 const {h,context,events}=fixture(),graph=scheduleSession(context,h.session,new Map(),1,{baseTime:10,compensateLatency:true});context.currentTime=12;
 for(const [id,parameter,value,offset]of [['wet','gainDb',-6,.006],['a','pan',.5,.012],['b','gainDb',-6,.006],['dry','gainDb',-6,0],[sendAutomationTarget('wet','b'),'gainDb',-6,.006],[h.session.id,'gainDb',-6,.018],['mc','threshold',-30,.012],['mc','makeupDb',3,.018]]){
  events.length=0;assert.equal(graph.automation.set(id,parameter,value),3);assert.equal(events[0][0],'cancel');assert.ok(Math.abs(events[0][1]-(12+offset))<1e-12,id);assert.ok(Math.abs(events.at(-1)[2]-(12+offset))<1e-12,id);
 }
 graph.stop();
});
test('uncompensated callers keep timing and calibrated compensation honors an override',()=>{
 const a=fixture(),original=scheduleSession(a.context,a.h.session,new Map(),0,{baseTime:10});assert.equal(original.outputBase,10);assert.equal(original.latencyFrames,0);assert.equal(a.nodes.filter(n=>n.kind==='delay').length,0);original.stop();
 const b=fixture(),calibrated=scheduleSession(b.context,b.h.session,new Map(),0,{baseTime:10,compensateLatency:true,compressorLatencyFrames:300});assert.equal(calibrated.latencyFrames,900);assert.equal(calibrated.outputBase,10.01875);calibrated.stop();
});
