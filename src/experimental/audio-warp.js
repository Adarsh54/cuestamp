import {audioWarpPlan} from './audio-warp-options.js';
import {stretchAudioChannels} from './audio-stretch.js';
// Each interval is stretched with neighboring source context, then complementary
// linear crossfades combine a 10 ms overlap around each destination anchor.
export function warpAudioChannels(channels,sampleRate,anchors,onProgress=()=>{}){
 const frames=channels[0]?.length,plan=audioWarpPlan({sampleRate,frames,channels:channels.length,anchors});
 if(channels.some(c=>!(c instanceof Float32Array)||c.length!==frames))throw Error('Audio channels must contain equal-length Float32 data.');for(const channel of channels)for(const value of channel)if(!Number.isFinite(value))throw Error('Audio contains non-finite samples.');
 if(plan.identity){onProgress(1);return channels.map(c=>c.slice());}
 const output=channels.map(()=>new Float32Array(frames)),radius=Math.max(1,Math.round(sampleRate*.005));
 for(let index=0;index<plan.segments.length;index++){
  const segment=plan.segments[index],left=index?radius:0,right=index+1<plan.segments.length?radius:0,padding=Math.ceil(radius/segment.ratio)+1;
  const sourceStart=Math.max(0,segment.sourceStart-padding),sourceEnd=Math.min(frames,segment.sourceEnd+padding),input=channels.map(c=>c.slice(sourceStart,sourceEnd));
  const rendered=stretchAudioChannels(input,sampleRate,segment.ratio,p=>onProgress((index+p)/plan.segments.length)),origin=Math.round((segment.sourceStart-sourceStart)*segment.ratio),length=segment.targetEnd-segment.targetStart;
  if(origin-left<0||origin+length+right>rendered[0].length)throw Error('Warp context did not cover the requested interval.');
  for(let j=-left;j<length+right;j++){
   let weight=1;if(left&&j<left)weight=(j+left)/(2*left);if(right&&j>=length-right)weight=Math.min(weight,(length+right-j)/(2*right));
   const destination=segment.targetStart+j;for(let c=0;c<channels.length;c++)output[c][destination]+=rendered[c][origin+j]*weight;
  }
 }
 onProgress(1);return output;
}
