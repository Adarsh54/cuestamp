import test from 'node:test';import assert from 'node:assert/strict';
import {filteredTrackHierarchy,trackHierarchy,visibleTrackSelection} from '../src/experimental/track-hierarchy.js';
const session={tracks:[{id:'bus',name:'Orchestra',kind:'bus',collapsed:true},{id:'sub',name:'Strings',kind:'bus',output:'bus',collapsed:true},{id:'v',name:'Violin',kind:'audio',output:'sub'},{id:'c',name:'Cello',kind:'audio',output:'sub'},{id:'d',name:'Drums',kind:'midi'}]};
test('search reveals nested matches with ancestors without modifying routing or collapse state',()=>{const before=structuredClone(session),rows=filteredTrackHierarchy(session,'  VIOLIN ');assert.deepEqual(rows.map(r=>[r.track.id,r.depth]),[['bus',0],['sub',1],['v',2]]);assert.ok(rows.every(r=>!r.track.collapsed));assert.deepEqual(session,before);assert.deepEqual(filteredTrackHierarchy(session,''),trackHierarchy(session));});
test('bus matches include descendants; type searches and empty results work',()=>{assert.deepEqual(filteredTrackHierarchy(session,'strings').map(r=>r.track.id),['bus','sub','v','c']);assert.deepEqual(filteredTrackHierarchy(session,'midi').map(r=>r.track.id),['d']);assert.deepEqual(filteredTrackHierarchy(session,'missing'),[]);assert.deepEqual(filteredTrackHierarchy(session,'   '),trackHierarchy(session));});

test('filtering removes hidden selections and keeps a visible primary selection',()=>{
 const rows=[{track:{id:'visible',regions:[{id:'r1'},{id:'r2'}]}}];
 assert.deepEqual(visibleTrackSelection(rows,'hidden',['hidden','r1','r2']),{selected:'r2',regionIds:['r1','r2']});
 assert.deepEqual(visibleTrackSelection(rows,'r1',['r1','hidden']),{selected:'r1',regionIds:['r1']});
 assert.deepEqual(visibleTrackSelection(rows,'visible',[]),{selected:'visible',regionIds:[]});
 assert.deepEqual(visibleTrackSelection([], 'hidden',['hidden']),{selected:null,regionIds:[]});
});
