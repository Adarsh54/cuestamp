import test from 'node:test';import assert from 'node:assert/strict';
import {newSession} from '../src/experimental/session.js';
import {compileTempoMap} from '../src/experimental/tempo-map.js';
import {insertTempoSection} from '../src/experimental/tempo-time-edit.js';
import {transferProjectSection} from '../src/experimental/section-transfer.js';
import {repeatProjectSection} from '../src/experimental/repeat-section.js';
const fixture=()=>({...newSession(),tempo:120,tempoChanges:[{id:'a',beat:8,bpm:60},{id:'b',beat:12,bpm:180}]});
const points=s=>compileTempoMap(s).points.map(p=>[p.time,p.bpm]);
test('copied tempo sections carry internal changes and restore destination tempo',()=>{const s=fixture(),p=insertTempoSection(s,s,3,6,10);assert.deepEqual(points(p),[[0,120],[4,60],[8,180],[10,120],[11,60],[13,180]]);assert.notEqual(p.tempoChanges.find(p=>p.bpm===60&&p.id!=='a')?.id,'a');assert.equal(new Set(p.tempoChanges.map(p=>p.id)).size,p.tempoChanges.length);});
test('copying at zero replaces the base tempo and restores the old beginning afterward',()=>{const s=fixture();transferProjectSection(s,{mode:'copy',start:4,end:6,position:0});assert.deepEqual(points(s),[[0,60],[2,120],[6,60],[10,180]]);});
test('moves close the source gap and preserve surviving source point identities',()=>{const s=fixture();transferProjectSection(s,{mode:'move',start:3,end:6,position:10});assert.deepEqual(points(s),[[0,120],[3,60],[5,180],[7,120],[8,60],[10,180]]);assert.equal(compileTempoMap(s).points.find(p=>p.time===8).id,'a');assert.equal(new Set(s.tempoChanges.map(p=>p.id)).size,s.tempoChanges.length);});
test('repeated sections restart their source tempo on every copy',()=>{const s=fixture();repeatProjectSection(s,{start:3,end:6,count:2});assert.deepEqual(points(s),[[0,120],[4,60],[6,120],[7,60],[9,120],[10,60],[14,180]]);assert.equal(new Set(s.tempoChanges.map(p=>p.id)).size,s.tempoChanges.length);});
test('copying inside the source uses its original tempo snapshot and flat sessions stay flat',()=>{const s=fixture();transferProjectSection(s,{mode:'copy',start:3,end:6,position:4.5});assert.deepEqual(points(s),[[0,120],[4,60],[4.5,120],[5.5,60],[11,180]]);const flat=newSession();repeatProjectSection(flat,{start:0,end:1});assert.equal(flat.tempoChanges,undefined);});

import {swapProjectSections,replaceProjectSection} from '../src/experimental/section-exchange.js';
test('section swap and replace compose tempo edits consistently',()=>{const s=fixture();s.sections=[{id:'left',name:'Verse',start:3,end:6},{id:'right',name:'Chorus',start:8,end:9}];const replace=structuredClone(s);swapProjectSections(s,'left','right');assert.deepEqual(points(s),[[0,120],[3,180],[4,60],[6,120],[7,60],[9,180]]);replaceProjectSection(replace,'left','right');assert.deepEqual(points(replace),[[0,120],[3,180],[4,60],[6,180]]);});
