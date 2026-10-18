import {wavStreamLayout} from './wav-stream.js';
import {bounceMarkers} from './wav-markers.js';
export function realtimeWavFormat(plan,settings){
 if(plan.zip||plan.entries.length!==1)throw Error('Real-time file export supports one mix at a time.');
 const format={channels:2,sampleRate:settings.sampleRate,frames:Math.max(1,Math.ceil(plan.duration*settings.sampleRate))},options={bitDepth:settings.bitDepth,dither:settings.dither,markers:bounceMarkers(plan.entries[0].document,plan.position,plan.duration)};
 wavStreamLayout(format,options);return {format,options};
}
