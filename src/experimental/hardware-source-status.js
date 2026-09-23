import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {midiOutputPlan} from './midi-output-plan.js';
// Compare planned MIDI messages, not device state or recorded audio bytes.
export function hardwareMidiFingerprint(plan){return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify({version:1,start:plan.start,end:plan.end,messages:plan.messages.map(m=>[m.time,m.bytes])}))));}
export function hardwareSourceStatus(source,session){
 if(source.tracks.some(t=>!session.tracks.some(current=>current.id===t.id&&current.kind==='midi')))return {state:'missing',label:'A source MIDI track is no longer available.'};
 if(!source.midiFingerprint)return {state:'unknown',label:'This older capture has no MIDI comparison record.'};
 try{const plan=midiOutputPlan(session,source.scope==='track'?source.tracks[0].id:null,source.start,{arrangement:source.scope==='arrangement'});
  return hardwareMidiFingerprint(plan)===source.midiFingerprint?{state:'unchanged',label:'Source MIDI is unchanged since capture.'}:{state:'changed',label:'Source MIDI has changed since capture. Record a new take to hear those edits.'};
 }catch{return {state:'unavailable',label:'Source MIDI cannot currently be played. Check mute, solo and channel assignments.'};}
}

export function hardwareSourceObservations(session,selectedRegionIds=[]){
 const selected=new Set(selectedRegionIds),captures=session.tracks.flatMap(t=>t.regions.filter(r=>r.hardwareRecording).map(r=>({trackId:t.id,region:r})));captures.sort((a,b)=>Number(selected.has(b.region.id))-Number(selected.has(a.region.id)));
 return {total:captures.length,items:captures.slice(0,16).map(({trackId,region})=>({trackId,regionId:region.id,...hardwareSourceStatus(region.hardwareRecording,session)}))};
}
