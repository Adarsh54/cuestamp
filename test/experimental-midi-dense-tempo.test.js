import test from 'node:test';import assert from 'node:assert/strict';import {readMidi} from '../src/experimental/midi.js';
const int=(n,size)=>Array.from({length:size},(_,i)=>(n>>>((size-i-1)*8))&255),str=s=>[...s].map(c=>c.charCodeAt(0)),vlq=n=>{const bytes=[n&127];while(n>>>=7)bytes.unshift((n&127)|128);return bytes;},chunk=events=>[...str('MTrk'),...int(events.length,4),...events];
test('dense tempo decoding agrees with direct integration and last same-tick tempo wins',()=>{
 const conductor=[],points=[],notes=[];
 for(let i=0;i<2000;i++){const us=i%2?300000:600000;conductor.push(...vlq(i?240:0),255,81,3,...int(us,3));points.push({tick:i*240,us});if(i%10===0){conductor.push(0,255,81,3,...int(450000,3));points.push({tick:i*240,us:450000});}}
 conductor.push(0,255,47,0);
 for(let i=0;i<4000;i++)notes.push(...vlq(i?60:0),144,60,100,...vlq(60),128,60,0);
 notes.push(0,255,47,0);
 const bytes=Uint8Array.from([...str('MThd'),0,0,0,6,0,1,0,2,1,224,...chunk(conductor),...chunk(notes)]),decoded=readMidi(bytes.buffer);
 const seconds=tick=>{let cursor=0,time=0,us=500000;for(const p of points){if(p.tick>tick)break;time+=(p.tick-cursor)*us/480/1e6;cursor=p.tick;us=p.us;}return time+(tick-cursor)*us/480/1e6;};
 assert.equal(decoded.hasTempoEvents,true);assert.equal(decoded.tempo,60000000/450000);assert.equal(decoded.tempoChanges.length,1999);assert.equal(decoded.tracks[0].notes.length,4000);
 for(let i=0;i<4000;i+=17){const n=decoded.tracks[0].notes[i];assert.ok(Math.abs(n.start-seconds(i*120))<1e-9);assert.ok(Math.abs(n.duration-(seconds(i*120+60)-seconds(i*120)))<1e-9);}
});
