import {regionBeatTiming} from './tempo-map.js';
import {musicalNoteShift} from './musical-note-shift.js';
const clamp=(value,min,max)=>0+Math.max(min,Math.min(max,value));
export function musicalNoteDrag(region,session,notes,anchor,{seconds,semitones=0,snap=0,resize=false}){
 if(!notes.length||!notes.some(n=>n.id===anchor.id)||!Number.isFinite(seconds)||!Number.isFinite(semitones)||!Number.isFinite(snap)||snap<0)throw Error('Invalid musical drag.');
 const clock=regionBeatTiming(region,session),edge=anchor.start+(resize?anchor.duration:0),origin=clock.beatAtTime(edge),delta=clock.beatAtTime(edge+seconds)-origin;
 const starts=notes.map(n=>clock.beatAtTime(n.start)),ends=notes.map(n=>clock.beatAtTime(n.start+n.duration)),limit=clock.beatAtTime(region.duration);
 const min=resize?Math.max(...notes.map((n,i)=>clock.beatAtTime(n.start+Math.min(.001,n.duration))-ends[i])):-Math.min(...starts);
 const max=resize?Math.min(...notes.map((n,i)=>clock.beatAtTime(Math.min(region.duration,n.start+3600))-ends[i])):limit-Math.max(...ends);
 const beats=clamp(snap?Math.round(delta/snap)*snap:delta,min,max),pitch=resize?0:clamp(Math.round(semitones),-Math.min(...notes.map(n=>n.pitch)),127-Math.max(...notes.map(n=>n.pitch)));
 const shifted=musicalNoteShift(region,session,notes,beats,{resize,semitones:pitch});
 return {values:resize?{beats}:{beats,semitones:pitch},notes:shifted};
}
