import {SoundTouch} from '@soundtouchjs/core';
import {renderProcessedChannels} from './audio-stretch.js';
import {validateAudioPitch} from './audio-pitch-options.js';
export function pitchAudioChannels(channels,sampleRate,semitones,onProgress=()=>{}){
 const frames=channels[0]?.length;validateAudioPitch({sampleRate,frames,channels:channels.length,semitones});
 if(channels.some(c=>!(c instanceof Float32Array)||c.length!==frames))throw Error('Audio channels must contain equal-length Float32 data.');
 for(const c of channels)for(const value of c)if(!Number.isFinite(value))throw Error('Audio contains non-finite samples.');
 if(semitones===0){onProgress(1);return channels.map(c=>c.slice());}
 const processor=new SoundTouch({sampleRate,interpolationStrategy:'lanczos'});processor.pitchSemitones=semitones;
 return renderProcessedChannels(processor,channels,sampleRate,frames,onProgress);
}
