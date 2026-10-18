import test from 'node:test';import assert from 'node:assert/strict';import {drumBuffer,drumRows} from '../src/experimental/drums.js';import {newSession,applyCommands} from '../src/experimental/session.js';import {readMidi,writeMidi} from '../src/experimental/midi.js';
const context=()=>({sampleRate:48000,createBuffer(ch,length,sampleRate){const pcm=new Float32Array(length);return {duration:length/sampleRate,getChannelData:()=>pcm};}});
test('drum synthesis produces deterministic bounded distinct sounds with decaying tails',()=>{const c=context(),rms=a=>Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length),signatures=[];for(const {pitch}of drumRows){const b=drumBuffer(c,pitch),pcm=b.getChannelData(0);assert.equal(drumBuffer(c,pitch),b);assert.deepEqual(pcm,drumBuffer(context(),pitch).getChannelData(0));assert.ok(pcm.every(Number.isFinite));assert.ok(Math.max(...pcm)<1);assert.ok(rms(pcm.slice(0,4800))>rms(pcm.slice(-4800)));signatures.push(pcm[1000]);}assert.equal(new Set(signatures).size,drumRows.length);});
test('step patterns use ordinary MIDI notes that export on percussion channel',()=>{const s=applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'midi',instrument:'drumKit'}},{op:'region.add',target:'t',values:{id:'r',duration:2}},...[0,.5,1,1.5].map(start=>({op:'note.add',target:'r',values:{pitch:36,channel:9,start,duration:.125,velocity:.8}}))]);const notes=readMidi(writeMidi(s).buffer).tracks[0].notes;assert.equal(notes.length,4);assert.ok(notes.every(n=>n.channel===9&&n.pitch===36));assert.deepEqual(notes.map(n=>n.start),[0,.5,1,1.5]);});
test('synthesized toms have increasing low-frequency fundamentals rather than cymbal noise',()=>{
 const c=context(),pitches=[41,43,45,47,48,50],peaks=[];
 for(const pitch of pitches){const pcm=drumBuffer(c,pitch).getChannelData(0);let best=0,peak=0;
  for(let f=65;f<=210;f++){let real=0,imag=0;for(let i=4800;i<14400;i++){const w=.5-.5*Math.cos(2*Math.PI*(i-4800)/9599);real+=pcm[i]*w*Math.cos(2*Math.PI*f*i/48000);imag+=pcm[i]*w*Math.sin(2*Math.PI*f*i/48000);}const power=real*real+imag*imag;if(power>best){best=power;peak=f;}}
  peaks.push(peak);assert.ok(best>100);
 }
 assert.deepEqual(peaks,[82,98,110,131,147,175]);
});
