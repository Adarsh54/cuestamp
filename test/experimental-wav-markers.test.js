import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';import ffmpeg from 'ffmpeg-static';
import {encodeWav} from '../src/experimental/wav.js';import {bounceMarkers} from '../src/experimental/wav-markers.js';
const audio={numberOfChannels:1,length:48000,sampleRate:48000,getChannelData:()=>new Float32Array(48000).fill(.25)};
const chunks=bytes=>{const result=new Map();for(let p=12;p<bytes.length;){const size=bytes.readUInt32LE(p+4);assert.ok(p+8+size<=bytes.length);result.set(bytes.toString('ascii',p,p+4),bytes.subarray(p+8,p+8+size));p+=8+size+size%2;}return result;};
test('WAV cue chunks and labels preserve PCM/float audio and address exact sample frames',async()=>{
 for(const bitDepth of [16,24,32]){
  const markers=[{name:'Intro',time:0},{name:'Café 🎵',time:.50001},{name:'Last',time:.999999}];const bytes=Buffer.from(await encodeWav(audio,{bitDepth,markers}).arrayBuffer()),c=chunks(bytes),plain=chunks(Buffer.from(await encodeWav(audio,{bitDepth}).arrayBuffer()));assert.deepEqual(c.get('data'),plain.get('data'));assert.equal(bytes.readUInt32LE(4),bytes.length-8);
  const cue=c.get('cue ');assert.equal(cue.readUInt32LE(0),3);assert.deepEqual([0,1,2].map(i=>cue.readUInt32LE(24+24*i)),[0,24000,47999]);assert.equal(cue.toString('ascii',12,16),'data');
  const list=c.get('LIST');assert.equal(list.toString('ascii',0,4),'adtl');let p=4;for(let i=0;i<3;i++){assert.equal(list.toString('ascii',p,p+4),'labl');const n=list.readUInt32LE(p+4);assert.equal(list.readUInt32LE(p+8),i+1);assert.equal(list.subarray(p+12,p+8+n-1).toString('utf8'),markers[i].name);assert.equal(list[p+8+n-1],0);p+=8+n+n%2;}assert.equal(p,list.length);
 }
});
test('range exports exclude outside/end markers, rebase starts and validate metadata',()=>{
 const session={markers:[{name:'End',time:4},{name:'Inside',time:3},{name:'Before',time:1},{name:'Start',time:2}]};assert.deepEqual(bounceMarkers(session,2,2),[{name:'Start',time:0},{name:'Inside',time:1}]);assert.equal(session.markers[0].name,'End');
 for(const markers of [[{name:'Bad',time:-1}],[{name:'End',time:1}],[{name:'Bad',time:NaN}],Array(1001).fill({name:'Too many',time:0})])assert.throws(()=>encodeWav(audio,{markers}));
});
test('independent FFmpeg reader recognizes exported marker positions and names',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cuestamp-wav-cues-'));try{const file=join(dir,'markers.wav');await writeFile(file,Buffer.from(await encodeWav(audio,{markers:[{name:'Opening',time:0},{name:'Scene change',time:.5}]}).arrayBuffer()));const result=spawnSync(ffmpeg,['-hide_banner','-i',file,'-f','null','-'],{encoding:'utf8',timeout:10000,killSignal:'SIGKILL'});assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/start 0\.500000/);assert.match(result.stderr,/title\s*:\s*Scene change/);assert.match(result.stderr,/title\s*:\s*Opening/);}finally{await rm(dir,{recursive:true,force:true});}
});
