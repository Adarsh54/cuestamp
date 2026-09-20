import {stretchAudioChannels} from './audio-stretch.js';
self.onmessage=({data})=>{try{const channels=stretchAudioChannels(data.channels,data.sampleRate,data.ratio,progress=>self.postMessage({progress}));self.postMessage({channels},channels.map(c=>c.buffer));}catch(error){self.postMessage({error:error.message});}};
