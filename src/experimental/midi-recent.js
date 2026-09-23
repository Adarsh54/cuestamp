import {createMidiCapture} from './midi-capture.js';
import {trimmedMidiRegion} from './region-edit.js';
export function createRecentMidi(startedAt,{maxSeconds=600,maxMessages=20000,windowSeconds=60}={}){
 const messages=[];let stoppedAt=null;
 return {
  get count(){return messages.length;},
  expired(now){return now-startedAt>=maxSeconds*1000||messages.length>=maxMessages;},
  push(data,time){if(stoppedAt!==null)return false;if(!Number.isFinite(time)||time<startedAt)return true;const type=data?.[0]>>4,length=type===12||type===13?2:3;if(type<8||type>14||data.length!==length||[...data].slice(1).some(v=>!Number.isInteger(v)||v<0||v>127))return true;if(time-startedAt>=maxSeconds*1000||messages.length>=maxMessages)return false;if(messages.length&&time<messages.at(-1).time)return true;messages.push({data:[...data],time});return true;},
  stop(now){stoppedAt=Math.min(now,startedAt+maxSeconds*1000);},
  snapshot(now){if(!messages.length)throw Error('No recent MIDI notes or controllers to capture.');const start=messages[0].time,end=Math.min(stoppedAt??now,startedAt+maxSeconds*1000),duration=Math.max(.001,(end-start)/1000),capture=createMidiCapture(start,{maxSeconds:maxSeconds+.001});for(const m of messages)capture.push(m.data,m.time);const take=capture.finish(Math.max(start+1,end)),trimmed=trimmedMidiRegion({start:0,duration,fadeIn:0,fadeOut:0,...take},Math.max(0,duration-windowSeconds),duration);if(!trimmed.notes.length&&!trimmed.events.length)throw Error('No MIDI remains in the most recent minute.');return {notes:trimmed.notes,events:trimmed.events,duration:trimmed.duration,name:'Recent MIDI'};}
 };
}
