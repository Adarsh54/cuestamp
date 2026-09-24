import {NoiseGate} from './noise-gate-dsp.js';
class NoiseGateProcessor extends AudioWorkletProcessor {
 static get parameterDescriptors(){return [
  ['threshold',-40,-96,0],['reductionDb',-60,-96,0],['hysteresis',6,0,24],
  ['attack',.003,0,1],['hold',.05,0,2],['release',.1,.001,3],
 ].map(([name,defaultValue,minValue,maxValue])=>({name,defaultValue,minValue,maxValue,automationRate:'a-rate'}));}
 constructor(){super();this.gate=new NoiseGate(sampleRate);this.stopped=false;this.port.onmessage=event=>{if(event.data==='stop')this.stopped=true;};}
 process(inputs,outputs,parameters){if(this.stopped)return false;if(outputs[0]?.length)this.gate.process(inputs[0]||[],outputs[0],parameters);return true;}
}
registerProcessor('cuestamp-noise-gate',NoiseGateProcessor);
