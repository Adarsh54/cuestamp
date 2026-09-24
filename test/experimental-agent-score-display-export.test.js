import test from 'node:test';import assert from 'node:assert/strict';
import {SessionHistory} from '../src/experimental/session.js';import {planDawEdit} from '../server/daw-agent.js';import {defaultBounceSettings} from '../src/experimental/bounce-settings.js';
import {prepareRegionNotationExport,prepareScoreNotationExport} from '../src/experimental/score-notation-export.js';
const setup=()=>{const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'midi',scoreInstrument:'bb'}},{op:'region.add',target:'t',values:{id:'r',duration:2}},{op:'note.add',target:'r',values:{id:'n',pitch:60,start:.125,duration:.5}}]);return h.session;};
test('both agent notation tools advertise display grids and return validated options without editing the performance',async()=>{
 const session=setup(),before=structuredClone(session),input={session,instruction:'Export the displayed score',allowExport:true,exportContext:{sessionId:session.id,revision:session.revision,regionId:'r',settings:defaultBounceSettings}};
 for(const tool of ['export_musicxml','export_score_musicxml']){
  const options={...(tool==='export_musicxml'?{regionId:'r'}:{trackIds:['t']}),pitchMode:'concert',displayGrid:'quarter'};
  const result=await planDawEdit(input,{key:'test',model:'test',fetchImpl:async(_,req)=>{const schema=JSON.parse(req.body).tools.find(t=>t.name===tool).parameters;assert.ok(schema.required.includes('displayGrid'));assert.ok(schema.properties.displayGrid.enum.includes('quarter'));return {ok:true,json:async()=>({output:[{type:'function_call',name:tool,arguments:JSON.stringify(options)}]})};}});
  assert.equal(result.displayGrid,'quarter');assert.equal(result.pitchMode,'concert');assert.deepEqual(result.commands,[]);
 }
 assert.deepEqual(session,before);
});
test('display export changes only XML timing, preserves pitch-mode choice and rejects invalid grids',()=>{
 const s=setup(),before=structuredClone(s),raw=prepareRegionNotationExport(s,{regionId:'r'}),rounded=prepareRegionNotationExport(s,{regionId:'r',displayGrid:'quarter',pitchMode:'concert'});
 assert.notEqual(raw.xml,rounded.xml);assert.match(raw.xml,/<step>D<\/step>/);assert.match(rounded.xml,/<step>C<\/step>/);assert.match(raw.xml,/<rest\/>/);assert.equal(rounded.xml.includes('<duration>240</duration>'),false);
 assert.equal(prepareScoreNotationExport(s,{trackIds:['t'],displayGrid:'eighthTriplet'}).displayGrid,'eighthTriplet');
 assert.throws(()=>prepareRegionNotationExport(s,{regionId:'r',displayGrid:'garbage'}));assert.throws(()=>prepareScoreNotationExport(s,{trackIds:['missing'],displayGrid:'quarter'}));assert.deepEqual(s,before);
});
