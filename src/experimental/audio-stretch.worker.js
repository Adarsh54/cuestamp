import {pitchAudioChannels} from './audio-pitch.js';
import {stretchAudioChannels} from './audio-stretch.js';
self.onmessage=({data})=>{try{const channels=(data.mode==='pitch'?pitchAudioChannels:stretchAudioChannels)(data.channels,data.sampleRate,data.mode==='pitch'?data.semitones:data.ratio,progress=>self.postMessage({progress}));self.postMessage({channels},channels.map(c=>c.buffer));}catch(error){self.postMessage({error:error.message});}};
