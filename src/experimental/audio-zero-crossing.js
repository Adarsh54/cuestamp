// Locate a shared channel crossing at an integer boundary, without rewriting PCM.
// Positions are region-local; reversing changes boundary mapping, not channel timing.
export function nearestZeroCrossing(buffer,region,time,{radius=.005,min=0,max=region.duration}={}){
 const rate=buffer.sampleRate,offset=Math.round(region.offset*rate),length=Math.round(region.duration*rate);
 if(!Number.isFinite(rate)||rate<=0||!Number.isInteger(buffer.numberOfChannels)||buffer.numberOfChannels<1||buffer.numberOfChannels>2||!Number.isInteger(offset)||offset<0||!Number.isInteger(length)||length<2||offset+length>buffer.length||!Number.isFinite(time)||time<0||time>region.duration||!Number.isFinite(radius)||radius<=0||radius>.1||!Number.isFinite(min)||!Number.isFinite(max)||min<0||max>region.duration||min>max)throw Error('Invalid zero-crossing search.');
 const channels=Array.from({length:buffer.numberOfChannels},(_,c)=>buffer.getChannelData(c));
 const target=Math.round(time*rate),distance=Math.floor(radius*rate),lo=Math.max(1,Math.ceil(min*rate),target-distance),hi=Math.min(length-1,Math.floor(max*rate),target+distance);
 let best=null;
 for(let boundary=lo;boundary<=hi;boundary++){
  const source=offset+(region.reverse?length-boundary:boundary);let score=0,crossing=true;
  for(const channel of channels){const left=channel[source-1],right=channel[source];if(!Number.isFinite(left)||!Number.isFinite(right))throw Error('Audio contains invalid samples.');if(!((left<=0&&right>=0)||(left>=0&&right<=0)))crossing=false;score=Math.max(score,Math.abs(left),Math.abs(right));}
  if(!crossing)continue;
  const delta=Math.abs(boundary-target);
  if(!best||delta<best.delta||(delta===best.delta&&score<best.score))best={frame:boundary,delta,score};
 }
 if(!best)throw Error('No shared zero crossing within 5 ms. Selection unchanged. Try a fade instead.');
 return best.frame/rate;
}
export function snapWaveformRange(buffer,region,range){
 if(!range||!Number.isFinite(range.start)||!Number.isFinite(range.end)||range.start<0||range.end>region.duration||range.end<=range.start)throw Error('Select a positive range inside the region.');
 // Search independently first; never silently collapse or reverse a short selection.
 const start=range.start===0?0:nearestZeroCrossing(buffer,region,range.start),end=range.end===region.duration?region.duration:nearestZeroCrossing(buffer,region,range.end);
 if(end<=start)throw Error('Nearby crossings would collapse the range. Selection unchanged.');
 return {start,end};
}
