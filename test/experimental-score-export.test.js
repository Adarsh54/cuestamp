import test from 'node:test';import assert from 'node:assert/strict';
import {exportScoreMusicxml,scoreTracks} from '../src/experimental/musicxml.js';
const region=(id,start,pitch)=>({id,start,duration:2,notes:[{start:0,duration:1,pitch,velocity:.8}]});
const fixture=()=>({title:'Duet & Theme',tempo:120,tracks:[{id:'p',kind:'midi',name:'Piano',regions:[region('a',0,60),region('b',.5,64)]},{id:'b',kind:'midi',name:'Bass',scoreClef:'bass',regions:[region('c',2,48)]},{id:'d',kind:'midi',instrument:'drumKit',regions:[region('d',0,36)]}]});
test('score aligns parts, preserves overlapping regions and clefs, without document changes',()=>{const s=fixture(),before=structuredClone(s),xml=exportScoreMusicxml(s);assert.match(xml,/Duet &amp; Theme/);assert.equal((xml.match(/<part id=/g)||[]).length,3);assert.equal((xml.match(/<measure number="2"/g)||[]).length,3);assert.match(xml,/<backup>/);assert.match(xml,/<sign>F<\/sign><line>4/);const bass=xml.split('<part id="P2">')[1];assert.match(bass,/<rest\/><duration>3840/);assert.match(bass,/<step>C<\/step><octave>3/);assert.deepEqual(s,before);});
test('score validates observed parts, supports order, and includes percussion in export and preview',()=>{const s=fixture();assert.deepEqual(scoreTracks(s).map(t=>t.id),['p','b','d']);for(const ids of [[],['missing'],['p','p']])assert.throws(()=>exportScoreMusicxml(s,ids));assert.match(exportScoreMusicxml(s,['d']),/<unpitched>/);const xml=exportScoreMusicxml(s,['b','p']);assert.match(xml,/<score-part id="P1"><part-name>Bass/);});
test('multiple drum parts use unique instrument IDs and preserve requested ordering',()=>{
 const s=fixture();s.tracks.push({...structuredClone(s.tracks[2]),id:'d2',name:'Drum layer 2'});
 const xml=exportScoreMusicxml(s,['d2','p','d']);
 const ids=[...xml.matchAll(/<score-instrument id="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(ids,['P1-D36','P3-D36']);assert.equal(new Set(ids).size,ids.length);
 assert.match(xml,/<part id="P3">[\s\S]*<instrument id="P3-D36"/);
 assert.match(xml,/<score-part id="P1"><part-name>Drum layer 2/);
});
