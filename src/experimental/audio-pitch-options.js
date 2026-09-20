import {validateAudioStretch} from './audio-stretch-options.js';
export function validateAudioPitch({sampleRate,frames,channels,semitones}){
 if(!Number.isFinite(semitones)||semitones< -12||semitones>12)throw Error('Choose a pitch change between −12 and +12 semitones.');
 return validateAudioStretch({sampleRate,frames,channels,ratio:1});
}
