// Tempo changes are anchored to zero-based quarter-note beats. Conversion is
// piecewise linear: each point's BPM holds until the next point. Negative input
// extrapolates the initial tempo for count-in; document positions validate later.
export function compileTempoMap({tempo=120,tempoChanges=[]}={}){
 const validTempo=value=>typeof value==='number'&&Number.isFinite(value)&&value>=20&&value<=300;
 if(!validTempo(tempo)||!Array.isArray(tempoChanges)||tempoChanges.length>256)throw Error('Use a tempo from 20–300 BPM and at most 256 tempo changes.');
 const changes=tempoChanges.map(p=>{if(!p||!Number.isFinite(p.beat)||p.beat<=0||p.beat>432000||!validTempo(p.bpm))throw Error('Tempo changes need a positive beat position and 20–300 BPM.');return {beat:p.beat,bpm:p.bpm,...(p.id===undefined?{}:{id:p.id})};}).sort((a,b)=>a.beat-b.beat);
 const points=[{beat:0,time:0,bpm:tempo}];for(const change of changes){const previous=points.at(-1);if(change.beat===previous.beat)throw Error('Only one tempo change can occupy a beat.');const time=previous.time+(change.beat-previous.beat)*60/previous.bpm;if(!Number.isFinite(time)||time>86400)throw Error('Tempo changes must lie within the 24-hour timeline.');points.push({...change,time});}
 for(const point of points)Object.freeze(point);Object.freeze(points);
 const find=(value,key)=>{if(!Number.isFinite(value))throw Error('Choose a finite musical position.');let left=0,right=points.length;while(left<right){const mid=(left+right)>>1;if(points[mid][key]<=value)left=mid+1;else right=mid;}return points[Math.max(0,left-1)];};
 const finite=value=>{if(!Number.isFinite(value))throw Error('Musical position exceeds numeric precision.');return value;};
 return Object.freeze({points,hasChanges:points.length>1,timeAtBeat(beat){const p=find(beat,'beat');return finite(p.time+(beat-p.beat)*60/p.bpm);},beatAtTime(time){const p=find(time,'time');return finite(p.beat+(time-p.time)*p.bpm/60);},tempoAtTime(time){return find(time,'time').bpm;},tempoAtBeat(beat){return find(beat,'beat').bpm;}});
}
export function durationForBeats(session,position,beats){const map=compileTempoMap(session);return map.timeAtBeat(map.beatAtTime(position)+beats)-position;}
// Called on the command engine's cloned document. Audio/video, automation and
// markers retain absolute time; MIDI regions, notes and events retain beats.
export function retimeMidiTracks(tracks,previousTiming,nextTiming){
 const from=compileTempoMap(previousTiming),to=compileTempoMap(nextTiming);
 if(from.points.length===to.points.length&&from.points.every((p,i)=>p.beat===to.points[i].beat&&p.bpm===to.points[i].bpm))return;
 const remap=time=>to.timeAtBeat(from.beatAtTime(time)),positive=value=>{if(!(value>0))throw Error('Tempo change collapses a MIDI interval below timeline precision.');return value;};
 for(const track of tracks){if(track.kind!=='midi')continue;for(const region of track.regions){
  // Keep existing constant-tempo arithmetic exactly, including tiny local notes.
  if(!from.hasChanges&&!to.hasChanges){const ratio=from.points[0].bpm/to.points[0].bpm;if((region.start+region.duration)*ratio>86400)throw Error('Tempo change moves MIDI beyond the 24-hour timeline.');region.start*=ratio;region.duration*=ratio;region.fadeIn*=ratio;region.fadeOut*=ratio;for(const note of region.notes){note.start*=ratio;note.duration*=ratio;}for(const event of region.events||[])event.start*=ratio;continue;}
  const start=region.start,end=start+region.duration,newStart=remap(start),newEnd=remap(end);if(newEnd>86400)throw Error('Tempo change moves MIDI beyond the 24-hour timeline.');
  for(const note of region.notes){const a=remap(start+note.start),b=remap(start+note.start+note.duration);note.start=a-newStart;note.duration=positive(b-a);}
  for(const event of region.events||[])event.start=remap(start+event.start)-newStart;
  region.fadeIn=region.fadeIn?remap(start+region.fadeIn)-newStart:0;region.fadeOut=region.fadeOut?newEnd-remap(end-region.fadeOut):0;
  region.start=newStart;region.duration=positive(newEnd-newStart);
  if(region.fadeIn+region.fadeOut>region.duration&&region.fadeIn+region.fadeOut-region.duration<=1e-9)region.fadeOut=Math.max(0,region.duration-region.fadeIn);
 }}
}

// Region editor fields count beats from the region start, which need not itself
// land on a global beat. Durations must be measured at their own start position.
export function regionBeatTiming(region,timing){
 const map=compileTempoMap(typeof timing==='number'?{tempo:timing}:timing),start=region.start??0,origin=map.beatAtTime(start);
 if(!map.hasChanges){const secondsPerBeat=60/map.points[0].bpm;return {timeAtBeat:beat=>beat*secondsPerBeat,beatAtTime:time=>time/secondsPerBeat,durationAtBeat:(beat,length)=>length*secondsPerBeat,beatsInDuration:(time,duration)=>duration/secondsPerBeat};}
 const timeAtBeat=beat=>map.timeAtBeat(origin+beat)-start,beatAtTime=time=>map.beatAtTime(start+time)-origin;
 return {timeAtBeat,beatAtTime,durationAtBeat:(beat,length)=>timeAtBeat(beat+length)-timeAtBeat(beat),beatsInDuration:(time,duration)=>beatAtTime(time+duration)-beatAtTime(time)};
}
