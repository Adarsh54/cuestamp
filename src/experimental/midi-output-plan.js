import {audibleSources} from './routing.js';
import {eventBytes,chasedEvents} from './midi-events.js';
import {regionBendInitialization} from './midi-bend-export.js';
import {compileMidiControllers} from './midi-controller-timeline.js';
export function midiOutputPlan(session,trackId,start=0,{arrangement=false}={}){
 if(!Number.isFinite(start)||start<0||start>86400)throw Error('Choose a valid playback position.');
 const selected=session.tracks.find(t=>t.id===trackId&&t.kind==='midi');
 if(!arrangement){if(!selected)throw Error('Choose an instrument track.');if(selected.mute)throw Error('Unmute this track before playing it on the device.');}
 const tracks=arrangement?audibleSources(session).filter(t=>t.kind==='midi'):[selected];
 if(!tracks.length)throw Error('No audible MIDI tracks. Check mute and solo settings.');
 const messages=[],spans=new Map();let end=start;
 const add=(time,bytes,priority)=>{if(messages.length>=200000)throw Error('This playback has too many MIDI messages for one playback.');messages.push({time,bytes,priority});};
 for(const track of tracks)for(const region of track.regions.filter(r=>!r.mute&&r.start+r.duration>start)){
  const relative=Math.max(0,start-region.start),at=region.start+relative,limit=region.start+region.duration,notes=region.notes.filter(n=>!n.mute&&n.velocity>0),channels=new Set([...notes.map(n=>n.channel??0),...region.events.map(e=>e.channel??0)]);end=Math.max(end,limit);
  for(const channel of channels){const prior=spans.get(channel)||[];if(prior.some(([a,b])=>at<b&&limit>a))throw Error(`Overlapping regions share a MIDI channel (${channel+1}). Assign separate channels before hardware playback.`);prior.push([at,limit]);spans.set(channel,prior);
   for(const [cc,value] of [[121,0],[7,127],[10,64],[11,127],[64,0]])add(at,[0xb0|channel,cc,value],1);
  }
  for(const event of regionBendInitialization(track,region,false))add(at,eventBytes(event),2);
  for(const event of chasedEvents(region.events,relative))add(at,eventBytes(event),3);
  for(const event of region.events)if(event.start>=relative&&event.start<region.duration)add(region.start+event.start,eventBytes(event),4);
  const controllers=new Map([...channels].map(c=>[c,compileMidiControllers(region.events.filter(e=>(e.channel??0)===c),track.pitchBendRange)]));
  for(const note of notes){const channel=note.channel??0,nominalEnd=Math.min(region.duration,note.start+note.duration),heldEnd=controllers.get(channel).sustainedEnd(note,region.duration);if(heldEnd<=relative||note.start>=region.duration)continue;add(region.start+Math.max(relative,note.start),[0x90|channel,note.pitch,Math.max(1,Math.round(note.velocity*127))],6);add(region.start+Math.max(relative,nominalEnd),[0x80|channel,note.pitch,0],nominalEnd<=relative?7:5);}
  for(const channel of channels){add(limit,[0xb0|channel,64,0],0);add(limit,[0xb0|channel,123,0],0);}
 }
 if(!messages.length)throw Error('No MIDI notes or events remain after the playhead.');
 messages.sort((a,b)=>a.time-b.time||a.priority-b.priority);return {trackId:arrangement?null:trackId,trackIds:tracks.map(t=>t.id),start,end,messages};
}
