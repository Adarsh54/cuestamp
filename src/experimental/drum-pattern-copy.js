import {patternBar} from './pattern-bars.js';
import {regionBeatTiming} from './tempo-map.js';

// Copy musical offsets rather than seconds so a tempo change keeps the groove.
export function copyDrumBar(region,session,bar){
 if(!Number.isInteger(bar)||bar<0)throw Error('Choose a valid source bar.');
 const source=patternBar(region,session,bar);
 if(source.index+1>=source.bars)throw Error('There is no following bar in this region.');
 const target=patternBar(region,session,source.index+1),timing=regionBeatTiming(region,session);
 const bounds=pattern=>{
  const first=pattern.cells[0],last=pattern.cells.at(-1);
  if(!first||!last)throw Error('Choose a bar inside the region.');
  return {start:first.time,end:Math.min(region.duration,last.time+timing.durationAtBeat(timing.beatAtTime(last.time),last.beats))};
 };
 const from=bounds(source),to=bounds(target),origin=timing.beatAtTime(from.start),destination=timing.beatAtTime(to.start);
 const inside=(note,range)=>(note.channel??0)===9&&note.start>=range.start&&note.start<range.end;
 const commands=region.notes.filter(n=>inside(n,to)).map(n=>({op:'note.delete',target:n.id}));
 for(const note of region.notes.filter(n=>inside(n,from))){
  const beat=destination+timing.beatAtTime(note.start)-origin,start=timing.timeAtBeat(beat);
  if(start>=to.end-1e-9)continue;
  const duration=Math.min(timing.durationAtBeat(beat,timing.beatsInDuration(note.start,note.duration)),to.end-start);
  if(duration<=0)continue;
  commands.push({op:'note.add',target:region.id,values:{pitch:note.pitch,channel:9,start,duration,velocity:note.velocity,mute:Boolean(note.mute)}});
 }
 return commands;
}
