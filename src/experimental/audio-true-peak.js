import {TruePeakMeter} from './true-peak-meter.js';
// Offline limits remain explicit; the shared detector also supports live blocks.
export function truePeakStatistics(channels,sampleRate){
 const frames=channels?.[0]?.length;
 if(![44100,48000,96000].includes(sampleRate)||!Array.isArray(channels)||channels.length<1||channels.length>2||!frames||frames>sampleRate*600||frames*channels.length*4>250*1024*1024||channels.some(c=>!(c instanceof Float32Array)||c.length!==frames))throw Error('True-peak analysis requires matching mono/stereo PCM at 44.1, 48 or 96 kHz, up to ten minutes and 250 MB.');
 const meter=new TruePeakMeter(channels.length);meter.process(channels);return meter.finish();
}
