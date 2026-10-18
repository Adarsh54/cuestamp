import {correctTruePeakBuffer} from './true-peak-correction.js';
self.onmessage=({data})=>{
 try{const result=correctTruePeakBuffer(data.channels,data.sampleRate,data.settings,progress=>self.postMessage({type:'progress',progress}));self.postMessage({type:'result',result},result.channels.map(channel=>channel.buffer));}
 catch(error){self.postMessage({type:'error',error:error.message||'True-peak correction failed.'});}
};
