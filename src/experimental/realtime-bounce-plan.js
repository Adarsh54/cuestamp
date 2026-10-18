import {wavStreamLayout} from './wav-stream.js';
import {bounceMarkers} from './wav-markers.js';
export function realtimeWavFormat(plan,settings){
 if(plan.zip||plan.entries.length!==1)throw Error('Real-time file export supports one WAV at a time.');
 const format={channels:2,sampleRate:settings.sampleRate,frames:Math.max(1,Math.ceil(plan.duration*settings.sampleRate))},options={bitDepth:settings.bitDepth,dither:settings.dither,markers:bounceMarkers(plan.entries[0].document,plan.position,plan.duration)};
 wavStreamLayout(format,options);return {format,options};
}

export function realtimeStemJobs(plan,settings){
 if(!plan.zip||!plan.entries.length)throw Error('Choose a nonempty stem export plan.');
 return plan.entries.map(entry=>{const single={...plan,zip:false,entries:[entry]};realtimeWavFormat(single,settings);return {name:entry.name,plan:single};});
}
