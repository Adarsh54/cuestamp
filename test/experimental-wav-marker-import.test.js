import test from 'node:test';import assert from 'node:assert/strict';
import {encodeWav} from '../src/experimental/wav.js';import {readWavMarkers} from '../src/experimental/wav-marker-import.js';import {SessionHistory} from '../src/experimental/session.js';import {mediaImportPlan} from '../src/experimental/media-import-plan.js';
const audio={numberOfChannels:1,length:48000,sampleRate:48000,getChannelData:()=>new Float32Array(48000)};
const markers=[{name:'Opening 🎵',time:0},{name:'Change',time:.5}];
test('WAV cue import round-trips PCM/float, reads labels before cue chunks and avoids PCM reads',async()=>{
 for(const bitDepth of [16,24,32]){const file=encodeWav(audio,{markers,bitDepth});let bytes=0;const source={size:file.size,slice:(start,end)=>{bytes+=end-start;return file.slice(start,end);}};assert.deepEqual(await readWavMarkers(source),markers);assert.ok(bytes<1000);}
 const raw=new Uint8Array(await encodeWav(audio,{markers}).arrayBuffer()),start=44+48000*2,cueEnd=start+12+24*2;
 const swapped=new Blob([raw.subarray(0,start),raw.subarray(cueEnd),raw.subarray(start,cueEnd)]);assert.deepEqual(await readWavMarkers(swapped),markers);
 assert.deepEqual(await readWavMarkers(new Blob(['not wave'])),[]);assert.deepEqual(await readWavMarkers(encodeWav(audio)),[]);
});
test('WAV cue reader rejects truncated chunks, duplicate IDs, invalid addressing and outside positions',async()=>{
 const raw=await encodeWav(audio,{markers}).arrayBuffer(),cue=44+48000*2;
 for(const mutate of [v=>v.setUint32(4,raw.byteLength+10,true),v=>v.setUint32(cue+8,1001,true),v=>v.setUint32(cue+12+24,1,true),v=>v.setUint32(cue+24,1,true),v=>v.setUint32(cue+32,48000,true)]){const copy=raw.slice(0);mutate(new DataView(copy));await assert.rejects(readWavMarkers(new Blob([copy])));}
});
test('audio import and offset cue markers share atomic validation and Undo',async()=>{
 const h=new SessionHistory(),before=structuredClone(h.session),cues=await readWavMarkers(encodeWav(audio,{markers})),plan=mediaImportPlan(h.session,{assetId:'file',name:'score.wav',start:10,duration:1,markers:cues});h.execute(plan.commands);assert.deepEqual(h.session.markers.map(({name,time})=>({name,time})),[{name:'Opening 🎵',time:10},{name:'Change',time:10.5}]);assert.equal(h.session.tracks[0].regions[0].start,10);h.undo();assert.deepEqual(h.session,{...before,revision:h.session.revision});h.redo();assert.equal(h.session.markers.length,2);
 h.execute([{op:'markers.import',values:{markers:JSON.stringify(cues),start:10}}]);assert.equal(h.session.markers.length,2);
 const saved=structuredClone(h.session);assert.throws(()=>h.execute([{op:'track.add'},{op:'markers.import',values:{markers:JSON.stringify([{name:'Too late',time:1}]),start:86400}}]),/24-hour/);assert.deepEqual(h.session,saved);
});
test('marker list import rejects malformed fields and capacity overflow without partial edits',()=>{
 const h=new SessionHistory();for(const values of [{markers:'invalid'},{markers:'[]',extra:true},{markers:'[{"name":"Cue","time":-1}]'},{markers:JSON.stringify(Array(1001).fill({name:'Cue',time:0}))}])assert.throws(()=>h.execute([{op:'markers.import',values}]));assert.equal(h.session.markers.length,0);
 h.execute([{op:'markers.import',values:{markers:JSON.stringify(Array.from({length:1000},(_,i)=>({name:'Cue '+i,time:i})))}}]);assert.throws(()=>h.execute([{op:'markers.import',values:{markers:'[{"name":"Another","time":0}]'}}]),/limit/);assert.equal(h.session.markers.length,1000);
});
test('agent imports supplied marker lists through the validated shared command',async()=>{
 const {planDawEdit}=await import('../server/daw-agent.js'),h=new SessionHistory();const result=await planDawEdit({session:h.session,instruction:'Import these cues at 10 seconds: Opening at 0, Change at 0.5'},{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'function_call',name:'edit_session',arguments:JSON.stringify({summary:'Imported supplied cues',commands:[{op:'markers.import',values:{markers:JSON.stringify(markers),start:10}}]})}]})})});h.execute(result.commands,result.revision);assert.equal(h.session.markers[1].time,10.5);
});
