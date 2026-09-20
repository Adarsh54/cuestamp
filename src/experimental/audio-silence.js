import {z} from 'zod';
export const silenceOptionsSchema=z.object({thresholdDb:z.number().finite().min(-120).max(0),minimumGap:z.number().finite().min(.001).max(60),preRoll:z.number().finite().min(0).max(10),postRoll:z.number().finite().min(0).max(10)}).strict();
export const defaultSilenceOptions={thresholdDb:-40,minimumGap:.1,preRoll:.01,postRoll:.05};
// Analyze raw source PCM: all channels must be quiet before a gap is removed.
// Sample intervals are half-open; short quiet gaps stay inside the retained region.
export function detectAudioActivity(channels,sampleRate,options,onProgress=()=>{}){
 const settings=silenceOptionsSchema.parse(options),frames=channels[0]?.length;
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw Error('Choose audio sampled between 8 and 192 kHz.');
 if(!Number.isInteger(frames)||frames<1||frames>sampleRate*600||channels.length<1||channels.length>2||channels.some(c=>!(c instanceof Float32Array)||c.length!==frames))throw Error('Analyze up to 10 minutes of equal-length mono or stereo audio.');
 if(frames*channels.length*4>250*1024*1024)throw Error('Audio analysis exceeds the 250 MB PCM limit.');
 const threshold=10**(settings.thresholdDb/20),gap=Math.ceil(settings.minimumGap*sampleRate),pre=Math.round(settings.preRoll*sampleRate),post=Math.round(settings.postRoll*sampleRate),ranges=[];let first=-1,last=-1;
 const append=(start,end)=>{start=Math.max(0,start-pre);end=Math.min(frames,end+post);const prior=ranges.at(-1);if(prior&&start<=prior.end)prior.end=Math.max(prior.end,end);else ranges.push({start,end});if(ranges.length>1000)throw Error('More than 1,000 regions detected. Increase the minimum gap or lower the threshold.');};
 for(let i=0;i<frames;i++){
  let audible=false;for(const channel of channels){const value=channel[i];if(!Number.isFinite(value))throw Error('Audio contains non-finite samples.');if(Math.abs(value)>=threshold)audible=true;}
  if(audible){if(first<0)first=i;last=i;}else if(first>=0&&i-last>=gap){append(first,last+1);first=-1;}
  if(i%65536===0)onProgress(i/frames);
 }
 if(first>=0)append(first,last+1);
 onProgress(1);return ranges.map(({start,end})=>({start:start/sampleRate,end:end/sampleRate}));
}
