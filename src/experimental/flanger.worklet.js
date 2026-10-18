import {StereoFlanger} from './flanger-dsp.js';
class FlangerProcessor extends AudioWorkletProcessor {
 static get parameterDescriptors(){return [['leftMs',3,.1,5.9],['rightMs',3,.1,5.9],['feedback',.3,-.95,.95],['mix',.5,0,1]].map(([name,defaultValue,minValue,maxValue])=>({name,defaultValue,minValue,maxValue,automationRate:'a-rate'}));}
 constructor(){super();this.flanger=new StereoFlanger(sampleRate);this.stopped=false;this.port.onmessage=event=>{if(event.data==='stop')this.stopped=true;};}
 process(inputs,outputs,parameters){if(this.stopped)return false;if(outputs[0]?.length)this.flanger.process(inputs[0]||[],outputs[0],parameters);return true;}
}
registerProcessor('cuestamp-flanger',FlangerProcessor);
