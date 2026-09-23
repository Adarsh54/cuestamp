import {truePeakStatistics} from './audio-true-peak.js';
import {integratedLoudness} from './audio-loudness.js';
import {audioStatistics,stereoStatistics} from './audio-statistics.js';
self.onmessage=event=>{try{self.postMessage({channels:audioStatistics(event.data.channels),stereo:stereoStatistics(event.data.channels),...(event.data.truePeak?{truePeak:truePeakStatistics(event.data.channels,event.data.sampleRate)}:{}),...(event.data.loudness?{loudness:integratedLoudness(event.data.channels,event.data.sampleRate)}:{})});}catch(error){self.postMessage({error:error.message});}};
