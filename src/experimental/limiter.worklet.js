import {LookaheadLimiter} from './limiter-dsp.js';
class LimiterProcessor extends AudioWorkletProcessor {
 static get parameterDescriptors(){return [['gainDb',0,-24,24],['ceilingDb',-1,-24,0],['release',.1,.001,3]].map(([name,defaultValue,minValue,maxValue])=>({name,defaultValue,minValue,maxValue,automationRate:'a-rate'}));}
 constructor(options){super();this.limiter=new LookaheadLimiter(sampleRate,options.processorOptions.lookaheadMs);this.meter=options.processorOptions.meter;this.frames=0;this.stopped=false;this.port.onmessage=event=>{if(event.data==='stop')this.stopped=true;};}
 process(inputs,outputs,parameters){if(this.stopped)return false;if(outputs[0]?.length){this.limiter.process(inputs[0]||[],outputs[0],parameters);this.frames+=outputs[0][0].length;if(this.meter&&this.frames>=sampleRate/20){this.frames=0;this.port.postMessage({time:currentTime,reduction:20*Math.log10(Math.max(1e-12,this.limiter.gain))});}}return true;}
}
registerProcessor('cuestamp-limiter',LimiterProcessor);
