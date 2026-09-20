import {pitchBendRangeSchema} from './pitch-bend.js';
import {rpnControllers} from './pitch-bend-state.js';
// MIDI 1.0 sensitivity is expressed in whole semitones plus whole cents.
export function bendRangeEvents(range,channel){
 const hundredths=Math.round(pitchBendRangeSchema.parse(range)*100),semitones=Math.floor(hundredths/100),cents=hundredths%100;
 return [[101,0],[100,0],[6,semitones],[38,cents],[101,127],[100,127]].map(([parameter,value])=>({type:'controlChange',parameter,value,channel,start:0})).concat({type:'pitchBend',parameter:0,value:8192,channel,start:0});
}
export function needsBendInitialization(tracks,includeMuted){return tracks.some(t=>t.kind==='midi'&&(includeMuted||!t.mute)&&t.instrument!=='drumKit'&&((t.pitchBendRange??2)!==2||t.regions.some(r=>(includeMuted||!r.mute)&&(r.events||[]).some(e=>e.type==='controlChange'&&rpnControllers.has(e.parameter)))));}
export function regionBendInitialization(track,region,includeMuted){
 if(track.instrument==='drumKit')return [];
 const channels=new Set([...region.notes.filter(n=>n.velocity>0&&(includeMuted||!n.mute)).map(n=>n.channel??0),...(region.events||[]).map(e=>e.channel??0)]);
 return [...channels].flatMap(channel=>[...bendRangeEvents(track.pitchBendRange,channel),...[[101,0],[100,1],[6,64],[38,0],[101,0],[100,2],[6,64],[101,127],[100,127]].map(([parameter,value])=>({type:'controlChange',parameter,value,channel,start:0}))]);
}
