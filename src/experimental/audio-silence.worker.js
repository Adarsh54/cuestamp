import {detectAudioActivity} from './audio-silence.js';
self.onmessage=({data})=>{try{const ranges=detectAudioActivity(data.channels,data.sampleRate,data.options,progress=>self.postMessage({progress}));self.postMessage({ranges});}catch(error){self.postMessage({error:error.message});}};
