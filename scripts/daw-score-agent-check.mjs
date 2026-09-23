import {isDeepStrictEqual} from 'node:util';
import {SessionHistory} from '../src/experimental/session.js';
import {conversationTurn} from '../src/experimental/agent-conversation.js';
import {defaultBounceSettings} from '../src/experimental/bounce-settings.js';
import {exportScoreMusicxml} from '../src/experimental/musicxml.js';

export async function checkScoreAgent({plan,config}){
 const history=new SessionHistory();history.execute([{op:'session.set',values:{tempo:120}},{op:'track.add',values:{id:'check-piano',kind:'midi',name:'Check piano'}},{op:'region.add',target:'check-piano',values:{id:'check-piano-region',duration:4}},{op:'note.add',target:'check-piano-region',values:{id:'check-piano-note',pitch:60,duration:2}},{op:'track.add',values:{id:'check-bass',kind:'midi',name:'Check bass'}},{op:'region.add',target:'check-bass',values:{id:'check-bass-region',duration:4}},{op:'note.add',target:'check-bass-region',values:{id:'check-bass-note',pitch:48,start:1,duration:.5}}]);
 const conversation=[];let stage='score selection edit';
 const fail=message=>({ok:false,stage,message});
 try{
  for(const [index,instruction] of ['Move only this selected note up one octave. Keep all timing and other project data unchanged. No audio analysis is needed.','Make that same note a quarter-note triplet in length at the project tempo. Keep its pitch, start and all other project data unchanged. No audio analysis is needed.'].entries()){
   stage=index?'score follow-up edit':'score selection edit';const before=structuredClone(history.session);
   const result=await plan({session:structuredClone(before),instruction,conversation,selection:'check-bass-note',selectedNoteIds:['check-bass-note'],selectedRegionIds:['check-bass-region'],allowAnalysis:false},config);
   if(result.action||result.revision!==before.revision||!result.commands?.length)return fail('The model did not return an applicable score edit.');
   history.execute(result.commands,before.revision);
   const expected=structuredClone(before);expected.revision++;const target=expected.tracks[1].regions[0].notes[0];
   if(index){const actual=history.session.tracks[1].regions[0].notes[0].duration;if(Math.abs(actual-1/3)>1e-7)return fail('The triplet duration did not match the project tempo.');target.duration=actual;}else target.pitch=60;
   if(!isDeepStrictEqual(history.session,expected))return fail('The plan changed the wrong note or altered unrelated session data.');
   conversation.push(conversationTurn({before,after:history.session,instruction,summary:result.summary||'',outcome:'applied'}));
  }
  stage='score export';const before=structuredClone(history.session);
  const result=await plan({session:structuredClone(before),conversation,instruction:'Export both the Check piano and Check bass tracks as a single multi-part MusicXML score, piano first then bass. Do not edit the project.',allowExport:true,allowAnalysis:false,exportContext:{sessionId:before.id,revision:before.revision,regionId:'check-bass-region',settings:defaultBounceSettings}},config);
  if(result.action!=='export_score_musicxml'||result.revision!==before.revision||result.commands?.length||!isDeepStrictEqual(result.trackIds,['check-piano','check-bass']))return fail('The model did not request the specified two-part MusicXML score.');
  const xml=exportScoreMusicxml(before,result.trackIds);
  if((xml.match(/<part id=/g)||[]).length!==2||!isDeepStrictEqual(history.session,before))return fail('The score export did not preserve both parts and session data.');
  return {ok:true,stage:'complete',message:'Three live score requests passed: selected-note octave change, contextual triplet duration, and two-part MusicXML export. Other session data was preserved. No project, media or export file was saved.'};
 }catch{return fail('The score planning request or shared validation failed. Check provider configuration and model access. No project or media was saved.');}
}
