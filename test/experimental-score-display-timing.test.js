import test from 'node:test';import assert from 'node:assert/strict';
import {scoreDisplayTiming} from '../src/experimental/score-display-timing.js';
import {SessionHistory} from '../src/experimental/session.js';
const setup=()=>{const h=new SessionHistory();h.execute([{op:'tempo.add',values:{beat:8,bpm:60}},{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',start:4,duration:4.1}},{op:'note.add',target:'r',values:{id:'a',pitch:60,start:.12,duration:.84}},{op:'note.add',target:'r',values:{id:'b',pitch:64,start:3.98,duration:.1}}]);return h.session;};
test('display grid quantizes starts and ends through tempo mapping without changing the session or identities',()=>{
 const session=setup(),before=structuredClone(session),view=scoreDisplayTiming(session,'quarter'),notes=view.tracks[0].regions[0].notes;
 assert.deepEqual(notes.map(n=>[n.id,n.pitch,n.start,Math.round(n.duration*100)]),[['a',60,0,100],['b',64,4,10]]);assert.deepEqual(session,before);assert.equal(view.revision,session.revision);assert.notEqual(view.tracks[0].regions[0],session.tracks[0].regions[0]);assert.equal(scoreDisplayTiming(session),session);
});
test('display grids handle triplets and short boundary notes without moving outside regions',()=>{
 const session=setup();for(const mode of ['eighth','sixteenth','thirtysecond','eighthTriplet','sixteenthTriplet']){const region=scoreDisplayTiming(session,mode).tracks[0].regions[0];assert.ok(region.notes.every(n=>n.start>=0&&n.duration>0&&n.start+n.duration<=region.duration+1e-9));}
 const tiny=structuredClone(session);tiny.tracks[0].regions[0].duration=.01;tiny.tracks[0].regions[0].notes=[{id:'tiny',start:0,duration:.001,pitch:60}];assert.ok(scoreDisplayTiming(tiny,'quarter').tracks[0].regions[0].notes[0].duration<=.01+1e-9);assert.throws(()=>scoreDisplayTiming(session,'invalid'));
});
