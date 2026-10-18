import test from 'node:test';import assert from 'node:assert/strict';
import {exportRegionMusicxml} from '../src/experimental/musicxml.js';
import {scorePreviewDocument} from '../src/experimental/score-preview.js';
const fixture=()=>{const region={id:'r',name:'Drums',start:0,duration:2,notes:[{pitch:36,channel:9,start:0,duration:.5,velocity:.8},{pitch:42,channel:9,start:.5,duration:.5,velocity:.7}]},track={id:'t',kind:'midi',instrument:'drumKit',name:'Drums',scoreInstrument:'bb',regions:[region]},session={title:'Score',tempo:120,meter:4,keySignature:{sharps:3,mode:'major'},tracks:[track]};return {region,track,session};};
test('drum export includes mapped instruments, percussion clef and cymbal heads without pitched transposition',()=>{
 const {session,track,region}=fixture(),before=structuredClone(session),xml=exportRegionMusicxml(session,track,region);
 assert.match(xml,/<sign>percussion<\/sign>/);assert.match(xml,/<midi-unpitched>37<\/midi-unpitched>/);assert.match(xml,/<midi-unpitched>43<\/midi-unpitched>/);assert.match(xml,/<notehead>x<\/notehead>/);
 assert.doesNotMatch(xml,/<pitch>|<transpose>|<key>/);assert.deepEqual(session,before);
 assert.throws(()=>scorePreviewDocument(session,track,region,'region'),/Percussion score editing/);
});
test('channel-10 regions export percussion and muted mappings are excluded',()=>{
 const {session,track,region}=fixture();track.instrument='triangle';region.notes.push({pitch:127,channel:9,start:1,duration:.5,velocity:.8},{pitch:38,channel:9,start:1.5,duration:.5,velocity:.8,mute:true});
 const xml=exportRegionMusicxml(session,track,region);assert.match(xml,/<midi-unpitched>128<\/midi-unpitched>/);assert.doesNotMatch(xml,/<midi-unpitched>39<\/midi-unpitched>/);
 region.notes[0].channel=0;assert.throws(()=>exportRegionMusicxml(session,track,region),/Separate pitched and percussion/);
});
