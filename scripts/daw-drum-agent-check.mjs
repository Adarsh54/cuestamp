import {isDeepStrictEqual} from 'node:util';
import {SessionHistory} from '../src/experimental/session.js';
import {conversationTurn} from '../src/experimental/agent-conversation.js';
import {defaultBounceSettings} from '../src/experimental/bounce-settings.js';
import {prepareScoreNotationExport} from '../src/experimental/score-notation-export.js';

export async function checkDrumAgent({plan,config}){
 const history=new SessionHistory();history.execute([
  {op:'track.add',values:{id:'check-piano',name:'Check piano',kind:'midi'}},
  {op:'region.add',target:'check-piano',values:{id:'check-piano-region',duration:4}},
  {op:'note.add',target:'check-piano-region',values:{id:'check-piano-note',pitch:60,duration:1}},
  {op:'track.add',values:{id:'check-drums',name:'Check drums',kind:'midi',instrument:'drumKit'}},
  {op:'region.add',target:'check-drums',values:{id:'check-drum-region',duration:4}},
  {op:'note.add',target:'check-drum-region',values:{id:'check-kick',pitch:36,channel:9,start:0,duration:.5,velocity:.8}},
  {op:'note.add',target:'check-drum-region',values:{id:'check-hat',pitch:42,channel:9,start:1,duration:.25,velocity:.6}}
 ]);
 const conversation=[];let stage='drum selection edit';
 const fail=message=>({ok:false,stage,message});
 try{
  for(const [index,instruction] of [
   'Change only the selected kick hit to a snare (MIDI drum number 38). Keep its channel, timing, velocity and every other project field unchanged. No analysis or playback is needed.',
   'Make that same hit half as loud by halving its MIDI velocity. Keep all other project data unchanged. No analysis or playback is needed.'
  ].entries()){
   stage=index?'drum follow-up edit':'drum selection edit';const before=structuredClone(history.session);
   const result=await plan({session:structuredClone(before),instruction,conversation,selection:'check-kick',selectedNoteIds:['check-kick'],selectedRegionIds:['check-drum-region'],allowAnalysis:false,scoreView:{sessionId:before.id,revision:before.revision,scope:'region',regionId:'check-drum-region',trackIds:['check-drums'],pitchMode:'written'}},config);
   if(result.action||result.revision!==before.revision||!result.commands?.length)return fail('The model did not return an applicable drum edit plan.');
   history.execute(result.commands,before.revision);const expected=structuredClone(before);expected.revision++;
   Object.assign(expected.tracks[1].regions[0].notes[0],index?{velocity:.4}:{pitch:38});
   if(!isDeepStrictEqual(history.session,expected))return fail('The plan did not make the requested drum edit while preserving unrelated data.');
   conversation.push(conversationTurn({before,after:history.session,instruction,summary:result.summary||'',outcome:'applied'}));
  }
  stage='mixed score export';const before=structuredClone(history.session);
  const result=await plan({session:structuredClone(before),conversation,instruction:'Export Check piano followed by Check drums as a single MusicXML score with performed timing. Do not change the project.',allowAnalysis:false,allowExport:true,exportContext:{sessionId:before.id,revision:before.revision,regionId:'check-drum-region',settings:defaultBounceSettings}},config);
  if(result.action!=='export_score_musicxml'||result.revision!==before.revision||result.commands?.length||!isDeepStrictEqual(result.trackIds,['check-piano','check-drums'])||(result.displayGrid??'off')!=='off')return fail('The model did not request the specified mixed score export.');
  const {xml}=prepareScoreNotationExport(before,{trackIds:result.trackIds,pitchMode:result.pitchMode??'written',displayGrid:result.displayGrid??'off'});
  if((xml.match(/<part id=/g)||[]).length!==2||!xml.includes('<midi-unpitched>39</midi-unpitched>')||!xml.includes('<unpitched>'))return fail('The score export lost the edited drum mapping.');
  history.undo();history.undo();
  if(history.session.tracks[1].regions[0].notes[0].pitch!==36||history.session.tracks[1].regions[0].notes[0].velocity!==.8)return fail('Undo did not restore the original drum hit.');
  return {ok:true,stage:'complete',message:'Three drum planning requests passed: selected kick-to-snare mapping, contextual velocity change, and mixed pitched/percussion MusicXML export. Unrelated data was preserved and Undo restored the hit. No project, media or file was saved.'};
 }catch{return fail('Drum planning or shared validation failed. Check provider configuration and model access. No project or media was saved.');}
}
