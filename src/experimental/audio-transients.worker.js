import {detectTransients} from './audio-transients.js';
self.onmessage=({data})=>{try{const markers=detectTransients(data.channels,data.sampleRate,data.settings,progress=>self.postMessage({progress}));self.postMessage({markers});}catch(error){self.postMessage({error:error.message});}};
