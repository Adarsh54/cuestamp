import test from 'node:test';import assert from 'node:assert/strict';
import {createMixerReadback,updateMixerReadback} from '../src/experimental/mixer-readback.js';
import {newSession,SessionHistory} from '../src/experimental/session.js';
import {curveAutomationValue} from '../src/experimental/automation-curves.js';
function setup(){const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'track.set',target:'t',values:{gainDb:-6,pan:.2}}]);return h;}
test('mixer readback follows the same gain/pan curve and seek positions as rendering',()=>{
 for(const shape of ['linear','hold','smooth','easeIn','easeOut']){
  const h=setup();h.execute([{op:'automation.point',target:'t',values:{parameter:'gainDb',time:0,value:-80,shape}},{op:'automation.point',target:'t',values:{parameter:'gainDb',time:10,value:0}}]);const read=createMixerReadback(h.session);
  for(const time of [0,.5,2,5,8,10,20])assert.equal(read('t','gainDb',time),curveAutomationValue(h.session.tracks[0].automation,'gainDb',time,-6));assert.equal(read('t','pan',2),.2);
 }
});
test('Off and parameter mute use static settings; master follows its own mode',()=>{
 const h=setup();h.session.tracks[0].automation=[{parameter:'pan',time:0,value:-1,shape:'linear'}];h.session.masterAutomation=[{parameter:'gainDb',time:0,value:-20,shape:'linear'}];let read=createMixerReadback(h.session);assert.equal(read('t','pan',1),-1);assert.equal(read(h.session.id,'gainDb',1),-20);
 h.session.tracks[0].automationMuted=['pan'];h.session.masterAutomationMode='off';read=createMixerReadback(h.session);assert.equal(read('t','pan',1),.2);assert.equal(read(h.session.id,'gainDb',1),h.session.masterDb);h.session.tracks[0].automationMuted=[];h.session.tracks[0].automationMode='off';assert.equal(createMixerReadback(h.session)('t','pan',1),.2);
});
test('DOM readback leaves active edits alone, shows live overrides and refreshes after undo',()=>{
 const h=setup(),output={textContent:''},attrs={},input={dataset:{mixGain:'t'},type:'range',value:'-6',ownerDocument:{activeElement:null},parentElement:{querySelector:()=>output},setAttribute:(k,v)=>attrs[k]=v},root={querySelectorAll:()=>[input]};
 updateMixerReadback(root,h.session,2,()=>-12);assert.equal(input.value,'-12');assert.equal(output.textContent,'-12.0 dB');assert.equal(attrs['aria-valuetext'],'-12.0 decibels');
 input.dataset.mixerEditing='true';updateMixerReadback(root,h.session,3);assert.equal(input.value,'-12');delete input.dataset.mixerEditing;
 input.type='number';input.ownerDocument.activeElement=input;input.value='-';updateMixerReadback(root,h.session,3);assert.equal(input.value,'-');input.ownerDocument.activeElement=null;
 h.execute([{op:'track.set',target:'t',values:{gainDb:-30}}]);updateMixerReadback(root,h.session,3);assert.equal(input.value,'-30');h.undo();updateMixerReadback(root,h.session,3);assert.equal(input.value,'-6');
});
