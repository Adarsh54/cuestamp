import {PingPongDelay} from './ping-pong-dsp.js';
class PingPongProcessor extends AudioWorkletProcessor {
 static get parameterDescriptors(){return [{name:'time',defaultValue:.25,minValue:.01,maxValue:24,automationRate:'a-rate'},{name:'feedback',defaultValue:.3,minValue:0,maxValue:.9,automationRate:'a-rate'}];}
 constructor(options){super();this.delay=new PingPongDelay(sampleRate,options.processorOptions.maximum);this.stopped=false;this.port.onmessage=event=>{if(event.data==='stop')this.stopped=true;};}
 process(inputs,outputs,parameters){if(this.stopped)return false;this.delay.process(inputs[0]||[],outputs[0],parameters);return true;}
}
registerProcessor('cuestamp-ping-pong',PingPongProcessor);
