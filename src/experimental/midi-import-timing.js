import {compileTempoMap,retimeMidiTracks,tempoWindow} from './tempo-map.js';
import {tempoFromSeconds} from './tempo-time-edit.js';

// Existing imports preserve the performance in seconds. Explicit modes either
// follow the destination's musical grid or replace its tempo from the insertion.
export function applyMidiImportTiming(session,midi,tracks,start,mode='performance'){
 if(!['performance','follow','adopt'].includes(mode))throw Error('Choose Preserve performance, Follow session tempo or Use file tempo.');
 if(mode==='adopt'){
  const previous={tempo:session.tempo,tempoChanges:structuredClone(session.tempoChanges??[])};
  const destination=compileTempoMap(session),source=compileTempoMap(midi);
  const next=tempoFromSeconds([
   ...destination.points.filter(p=>p.time<start),
   ...source.points.map(p=>({time:start+p.time,bpm:p.bpm,id:crypto.randomUUID()}))
  ]);
  retimeMidiTracks(session.tracks,previous,next);Object.assign(session,next);
 }
 let markers=midi.markers.map(m=>({...m,time:start+m.time}));
 if(mode==='follow'){
  const source=compileTempoMap(midi),destination=compileTempoMap(session),origin=destination.beatAtTime(start);
  markers=midi.markers.map(m=>({...m,time:destination.timeAtBeat(origin+source.beatAtTime(m.time))}));
  // Imported regions are still local to the file here.
  retimeMidiTracks(tracks,midi,tempoWindow(session,start,86400-start));
 }
 for(const track of tracks)for(const region of track.regions){
  region.start+=start;if(region.start+region.duration>86400)throw Error('Imported MIDI exceeds the 24-hour timeline.');
 }
 return markers;
}
