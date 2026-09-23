import {LiveLoudness} from './live-loudness-core.js';
class LoudnessProcessor extends AudioWorkletProcessor {
 constructor(options){super();this.meter=new LiveLoudness(sampleRate);this.startFrame=Math.round((options.processorOptions?.startTime||0)*sampleRate);this.nextReport=0;this.closed=false;this.port.onmessage=()=>{this.closed=true;};}
 process(inputs,outputs){
  if(this.closed)return false;
  const input=inputs[0],length=outputs[0]?.[0]?.length||128;
  for(let i=0;i<length;i++)if(currentFrame+i>=this.startFrame)this.meter.push(input?.[0]?.[i]||0,input?.[1]?.[i]||0);
  if(this.meter.frames>=this.nextReport){this.port.postMessage({...this.meter.read(),frames:this.meter.frames,contextTime:(currentFrame+length)/sampleRate});this.nextReport=this.meter.frames+Math.round(sampleRate/10);}
  return true;
 }
}
registerProcessor('cuestamp-live-loudness',LoudnessProcessor);
