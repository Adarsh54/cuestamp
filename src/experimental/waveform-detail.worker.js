import {buildWaveformIndex} from './waveform-detail.js';
self.onmessage=({data})=>{try{const index=buildWaveformIndex(data.channels);self.postMessage({index},index.channels.flatMap(c=>[c.min.buffer,c.max.buffer]));}catch(error){self.postMessage({error:error.message});}};
