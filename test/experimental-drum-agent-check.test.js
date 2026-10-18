import test from 'node:test';import assert from 'node:assert/strict';
import {checkDawAgent} from '../scripts/daw-agent-check.mjs';
const env={OPENAI_API_KEY:'test-secret',DAW_AGENT_MODEL:'test-model'};
function responder(bodies,{wrongNote=false,wrongFollowup=false,badExport=false,extraEdit=false}={}){return async body=>{
 bodies.push(structuredClone(body));
 if(body.allowExport)return {revision:body.session.revision,action:'export_score_musicxml',commands:[],trackIds:badExport?['check-piano']:['check-piano','check-drums'],pitchMode:'written',displayGrid:'off'};
 return {revision:body.session.revision,commands:[{op:'note.set',target:wrongNote?'check-hat':'check-kick',values:bodies.length===1?{pitch:38}:{velocity:wrongFollowup?.8:.4}},...(extraEdit?[{op:'session.set',values:{title:'unrequested'}}]:[])]};
};}
test('drum diagnostic carries selected score context and conversation through validated edits and export',async()=>{
 const bodies=[],result=await checkDawAgent({env,scenario:'drums',plan:responder(bodies)});assert.equal(result.ok,true);assert.equal(bodies.length,3);assert.deepEqual(bodies[0].scoreView.trackIds,['check-drums']);assert.equal(bodies[1].session.tracks[1].regions[0].notes[0].pitch,38);assert.equal(bodies[1].conversation[0].changes[0].id,'check-kick');assert.equal(bodies[2].session.tracks[1].regions[0].notes[0].velocity,.4);
});
test('drum diagnostic rejects wrong edits/exports, avoids unconfigured requests and redacts failures',async()=>{
 for(const options of [{wrongNote:true},{wrongFollowup:true},{badExport:true},{extraEdit:true}])assert.equal((await checkDawAgent({env,scenario:'drums',plan:responder([],options)})).ok,false);
 const result=await checkDawAgent({env,scenario:'drums',plan:async()=>{throw Error('test-secret private provider payload');}});assert.equal(result.ok,false);assert.ok(!JSON.stringify(result).includes('test-secret'));
 let called=false;assert.equal((await checkDawAgent({env:{},scenario:'drums',plan:async()=>{called=true;}})).stage,'configuration');assert.equal(called,false);
});
