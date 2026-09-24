import {detectMelody} from './audio-melody.js';
self.onmessage=({data})=>{try{const notes=detectMelody(data.channels,data.sampleRate,data.settings,progress=>self.postMessage({progress}));self.postMessage({notes});}catch(error){self.postMessage({error:error.message});}};
