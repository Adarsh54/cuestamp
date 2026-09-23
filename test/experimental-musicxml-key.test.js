import test from 'node:test';
import assert from 'node:assert/strict';
import {exportRegionMusicxml} from '../src/experimental/musicxml.js';
function fixture(keySignature,pitch=70){const region={id:'r',start:0,duration:4,notes:[{pitch,start:0,duration:3,velocity:1}]},track={kind:'midi',name:'Piano',regions:[region]},session={tempo:120,keySignature};return {region,track,session};}
test('score uses flat, sharp and extreme diatonic spellings without transposing MIDI',()=>{
 for(const [sharps,pitch,step,alter,octave] of [[-1,70,'B',-1,4],[1,66,'F',1,4],[-7,59,'C',-1,4],[7,60,'B',1,3]]){
  const f=fixture({sharps,mode:'major'},pitch),before=structuredClone(f),xml=exportRegionMusicxml(f.session,f.track,f.region);
  assert.match(xml,new RegExp(`<fifths>${sharps}</fifths><mode>major</mode>`));
  assert.ok(xml.includes(`<step>${step}</step><alter>${alter}</alter><octave>${octave}</octave>`));assert.deepEqual(f,before);
 }
});
test('unknown key is omitted; excerpt uses active minor key at its start',()=>{
 const f=fixture(undefined);assert.doesNotMatch(exportRegionMusicxml(f.session,f.track,f.region),/<key>/);
 f.session.keyChanges=[{beat:2,sharps:-2,mode:'minor'}];f.region.start=2;
 const xml=exportRegionMusicxml(f.session,f.track,f.region);assert.match(xml,/<fifths>-2<\/fifths><mode>minor<\/mode>/);
});
test('mid-bar changes split sustained notation with ties and preserve its onset spelling',()=>{
 const f=fixture({sharps:-1,mode:'major'});f.session.keyChanges=[{beat:2,sharps:1,mode:'major'},{beat:4,sharps:-2,mode:'minor'}];
 f.region.notes.push({pitch:66,start:1,duration:.5,velocity:.8});
 const before=structuredClone(f),xml=exportRegionMusicxml(f.session,f.track,f.region);
 assert.match(xml,/<duration>1920<\/duration><tie type="start"/);
 assert.match(xml,/<attributes><key><fifths>1/);
 assert.equal((xml.match(/<step>B<\/step><alter>-1<\/alter>/g)||[]).length,3);
 assert.equal((xml.match(/<tie type="start"/g)||[]).length,2);
 assert.equal((xml.match(/<tie type="stop"/g)||[]).length,2);
 assert.match(xml,/<step>F<\/step><alter>1<\/alter>/);assert.deepEqual(f,before);
});
import {validateScorePreviewKeys} from '../src/experimental/score-preview.js';
test('preview refuses inaccurate mid-bar changes but allows bar boundaries and excerpt initial keys',()=>{
 const f=fixture({sharps:-1,mode:'major'});f.session.keyChanges=[{beat:2,sharps:1,mode:'major'}];
 assert.throws(()=>validateScorePreviewKeys(f.session,f.region),/mid-bar/);
 f.region.start=1;assert.doesNotThrow(()=>validateScorePreviewKeys(f.session,f.region));
 f.region.start=0;f.session.keyChanges[0].beat=4;assert.doesNotThrow(()=>validateScorePreviewKeys(f.session,f.region));
});
