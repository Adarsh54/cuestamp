import test from 'node:test';import assert from 'node:assert/strict';import {scorePartsView,scorePartView} from '../src/experimental/score-parts.js';
const fixture=()=>({title:'Score',tempo:120,tracks:[{id:'a',name:'Flute <script>',kind:'midi',regions:[{notes:[]}]},{id:'b',name:'Bass',kind:'midi',regions:[{notes:[]}]},{id:'c',kind:'audio',regions:[]}]});
test('score parts are an independent display filter in arrangement order',()=>{const s=fixture(),before=structuredClone(s);assert.deepEqual(scorePartView(s,['b','a']).tracks.map(t=>t.id),['a','b']);assert.equal(scorePartView(s,['b']).tracks[0],s.tracks[1]);assert.equal(scorePartView(s,null),s);assert.deepEqual(s,before);for(const ids of [[],['missing'],['a','a'],['c']])assert.throws(()=>scorePartView(s,ids));});
test('part labels are escaped and exclude non-notated tracks',()=>{const view=scorePartsView(fixture());assert.match(view,/Flute &lt;script&gt;/);assert.doesNotMatch(view,/<script>/);assert.equal((view.match(/data-score-part value/g)||[]).length,2);});
test('drum parts participate in score selection while mixed pitched/percussion tracks are excluded',()=>{
 const s=fixture();s.tracks.push({id:'drums',name:'Drums',kind:'midi',instrument:'drumKit',regions:[{notes:[{pitch:36,channel:0}]}]},{id:'channel10',name:'Percussion',kind:'midi',regions:[{notes:[{pitch:38,channel:9}]}]},{id:'mixed',kind:'midi',regions:[{notes:[{pitch:60,channel:0},{pitch:38,channel:9}]}]});
 assert.deepEqual(scorePartView(s,['drums','channel10']).tracks.map(t=>t.id),['drums','channel10']);assert.throws(()=>scorePartView(s,['mixed']));
 assert.match(scorePartsView(s),/value="drums"/);assert.match(scorePartsView(s),/value="channel10"/);assert.doesNotMatch(scorePartsView(s),/value="mixed"/);
});
