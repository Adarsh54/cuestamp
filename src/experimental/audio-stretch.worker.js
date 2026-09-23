import {warpAudioChannels} from './audio-warp.js';
import {pitchAudioChannels} from './audio-pitch.js';
import {stretchAudioChannels} from './audio-stretch.js';
self.onmessage=({data})=>{try{const channels=(data.mode==='warp'?warpAudioChannels:data.mode==='pitch'?pitchAudioChannels:stretchAudioChannels)(data.channels,data.sampleRate,data.mode==='warp'?data.anchors:data.mode==='pitch'?data.semitones:data.ratio,progress=>self.postMessage({progress}));self.postMessage({channels},channels.map(c=>c.buffer));}catch(error){self.postMessage({error:error.message});}};
