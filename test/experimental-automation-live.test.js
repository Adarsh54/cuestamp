import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveAutomation} from '../src/experimental/automation-live.js';
import {curveAutomationValue} from '../src/experimental/automation-curves.js';
function setup(parameter='gainDb',shape='linear'){
 const events=[],param={cancelScheduledValues:t=>events.push(['cancel',t]),setValueAtTime:(v,t)=>events.push(['set',v,t]),linearRampToValueAtTime:(v,t)=>events.push(['linear',v,t]),exponentialRampToValueAtTime:(v,t)=>events.push(['exp',v,t])};
 const points=[{parameter,time:0,value:parameter==='pan'?-1:-24,shape},{parameter,time:10,value:0,shape:'hold'},{parameter,time:12,value:parameter==='pan'?1:6}];
 const context={currentTime:102},control=createLiveAutomation({context,base:100,position:2,lanes:new Map([[`t:${parameter}`,{param,points,fallback:0}]])});return {events,points,context,control};
}
test('live gain takes over scheduled automation and returns to original curve at transport position',()=>{
 const {control,events,context}=setup();assert.equal(control.set('t','gainDb',-6),4);
 assert.deepEqual(events,[['cancel',102],['set',10**(-6/20),102]]);
 context.currentTime=103;events.length=0;control.release('t','gainDb',1);
 assert.deepEqual(events,[['cancel',103],['set',10**(-6/20),103],['exp',10**(-9.6/20),104],['exp',1,108],['set',10**(6/20),110]]);
});
test('release resumes every supported curve and preserves subsequent hold transitions',()=>{
 for(const parameter of ['gainDb','pan'])for(const shape of ['linear','hold','smooth','easeIn','easeOut']){
  const {control,events,points,context}=setup(parameter,shape);const original=structuredClone(points);
  control.set('t',parameter,parameter==='pan'?.7:-5);context.currentTime=103;events.length=0;control.release('t',parameter,.5);
  const expected=curveAutomationValue(points,parameter,5.5,0),ramp=events[2];assert.equal(ramp[0],parameter==='pan'?'linear':'exp');assert.equal(ramp[2],103.5);assert.ok(Math.abs(ramp[1]-(parameter==='pan'?expected:10**(expected/20)))<1e-10);assert.deepEqual(points,original);assert.equal(events.at(-1)[0],'set');
 }
});
test('cancel restores saved automation immediately, repeated release does nothing, stop rejects stale callbacks',()=>{
 const {control,events,context}=setup('pan');control.set('t','pan',1);context.currentTime=104;events.length=0;control.cancel('t','pan');assert.equal(events[0][0],'cancel');assert.ok(Math.abs(events[1][1]+.4)<1e-10);const count=events.length;control.release('t','pan');assert.equal(events.length,count);control.stop();assert.throws(()=>control.set('t','pan',0),/stopped/);assert.throws(()=>control.release('t','pan'),/stopped/);
});
test('invalid targets and values reject without touching the audio schedule',()=>{
 const {control,events}=setup();for(const args of [['missing','gainDb',0],['t','frequency',1],['t','gainDb',NaN],['t','gainDb',13]])assert.throws(()=>control.set(...args));assert.equal(events.length,0);control.set('t','gainDb',0);const count=events.length;assert.throws(()=>control.release('t','gainDb',-1));assert.equal(events.length,count);
});
test('events before playback begins clamp to the scheduled start',()=>{
 const {control,context,events}=setup();context.currentTime=99;assert.equal(control.set('t','gainDb',0),2);assert.equal(events[0][1],100);
});

test('session scheduler exposes master and audible channels, respects Off and mute, and disposes overrides',async()=>{
 const {scheduleSession}=await import('../src/experimental/audio-engine.js');
 const {newSession,SessionHistory}=await import('../src/experimental/session.js');
 const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'track.add',values:{id:'muted',kind:'audio'}},{op:'track.set',target:'muted',values:{mute:true}},{op:'automation.point',target:'t',values:{parameter:'gainDb',time:0,value:-24}},{op:'track.set',target:'t',values:{automationMode:'off',gainDb:-6}}]);
 const events=[],param=()=>({value:0,cancelScheduledValues(){},setValueAtTime(v,t){events.push([v,t]);},linearRampToValueAtTime(v,t){events.push([v,t]);},exponentialRampToValueAtTime(v,t){events.push([v,t]);}});
 const node=()=>({gain:param(),pan:param(),connect(other){return other;},disconnect(){}});
 const context={currentTime:0,destination:node(),createGain:node,createStereoPanner:node};
 const playback=scheduleSession(context,h.session,new Map(),0,{baseTime:0});
 playback.automation.set('t','gainDb',0);context.currentTime=1;playback.automation.release('t','gainDb',.1);assert.deepEqual(events.at(-1),[10**(-6/20),1.1]);
 assert.throws(()=>playback.automation.set('muted','gainDb',0));playback.automation.set(h.session.id,'pan',.5);playback.stop();assert.throws(()=>playback.automation.set(h.session.id,'pan',0),/stopped/);
});

test('live trim follows future automation instead of holding an absolute fader value',()=>{
 const {control,context,events}=setup();assert.equal(control.trim('t','gainDb',3),4);
 assert.deepEqual(events,[['cancel',102],['set',10**(-11.4/20),102],['exp',10**(3/20),108],['set',10**(9/20),110]]);
 context.currentTime=103;events.length=0;control.trim('t','gainDb',-3);assert.ok(Math.abs(events[1][1]-10**(-15/20))<1e-12);assert.throws(()=>control.release('t','gainDb'),/resume/);
 control.cancel('t','gainDb');assert.equal(events.at(-1)[1],10**(6/20));
});
test('trim validates current and future bounds before changing a live schedule',()=>{
 const {control,events}=setup();for(const offset of [NaN,Infinity,109,7,-97])assert.throws(()=>control.trim('t','gainDb',offset));assert.equal(events.length,0);
});
test('trim curve segments are expanded once and committed playback resumes exactly',()=>{
 const {control,events,points,context}=setup('gainDb','smooth');control.trim('t','gainDb',1);
 // There are fewer than 64 remaining linearized base intervals, not 64 squared.
 assert.ok(events.length<70);context.currentTime=103;events.length=0;
 const committed=[...points,{parameter:'gainDb',time:5,value:-6,shape:'linear'},{parameter:'gainDb',time:6,value:-12,shape:'hold'}];control.replace('t','gainDb',committed,0);control.resume('t','gainDb');assert.equal(events[1][1],10**(-6/20));assert.ok(events.some(e=>e[0]==='exp'&&e[1]===10**(-12/20)&&e[2]===104));const length=events.length;control.cancel('t','gainDb');assert.equal(events.length,length);control.stop();assert.throws(()=>control.trim('t','gainDb',0),/stopped/);
});
