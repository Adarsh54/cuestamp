import {z} from 'zod';
import {validateAudioStretch} from './audio-stretch-options.js';
export const pitchCorrectionsSchema=z.array(z.object({start:z.number().finite().min(0),end:z.number().finite().positive(),semitones:z.number().finite().min(-12).max(12)}).strict()).min(1).max(4000);
export function validatePitchCorrections(value,duration){const corrections=pitchCorrectionsSchema.parse(value);let previous=0;for(const c of corrections){if(c.end<=c.start||c.start<previous-1e-8||c.end>duration+1e-8)throw Error('Pitch correction spans must be ordered, nonoverlapping and inside the source region.');previous=c.end;}return corrections;}
export function validateAudioRetune({sampleRate,frames,channels,corrections}){validateAudioStretch({sampleRate,frames,channels,ratio:1});return validatePitchCorrections(corrections,frames/sampleRate+.5/sampleRate);}
