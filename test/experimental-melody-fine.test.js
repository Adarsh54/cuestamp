import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionHistory} from '../src/experimental/session.js';
import {updateMelodyDraft,melodyDraftNotes} from '../src/experimental/melody-draft.js';
import {melodyRetunePlan} from '../src/experimental/melody-retune-plan.js';
import {melodyGraphLayout} from '../src/experimental/melody-graph.js';
const setup=()=>{const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'region.add',target:'t',values:{id:'r',assetId:'a',duration:2}}]);return {h,a:{token:crypto.randomUUID(),sessionId:h.session.id,revision:h.session.revision,regionId:'r',notes:[{pitch:69,start:.2,duration:1,velocity:.8,cents:20,confidence:.99}]}};};
const edit=values=>({operation:'edit',edits:[{index:0,pitch:null,start:null,duration:null,velocity:null,excluded:null,...values}]});
test('fractional targets affect rendering and graph while preserving measured pitch',()=>{
 const {h,a}=setup(),next=updateMelodyDraft(h.session,a,edit({fineCents:50}));
 assert.ok(Math.abs(melodyRetunePlan(h.session,next).corrections[0].semitones-.3)<1e-10);
 const original=melodyGraphLayout(a.notes,a.notes),fine=melodyGraphLayout(melodyDraftNotes(next),a.notes);
 assert.ok(Math.abs((fine.notes[0].measuredY-fine.notes[0].y)-(original.notes[0].measuredY-original.notes[0].y)-original.rowHeight/2)<1e-10);
 assert.equal(a.notes[0].cents,20);assert.equal(a.edits,undefined);
 for(const values of [{pitch:70},{fineCents:null}])assert.equal(melodyDraftNotes(updateMelodyDraft(h.session,next,edit(values)))[0].fineCents,50);
});
test('fine tuning rejects invalid values and out-of-range effective pitches',()=>{
 const {h,a}=setup();
 for(const fineCents of [-101,101,NaN,Infinity])assert.throws(()=>updateMelodyDraft(h.session,a,edit({fineCents})));
 for(const [pitch,fineCents] of [[0,-1],[127,1]])assert.throws(()=>updateMelodyDraft(h.session,a,edit({pitch,fineCents})),/Fine tuning/);
});
