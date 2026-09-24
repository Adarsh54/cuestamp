import {NoiseGate} from './noise-gate-dsp.js';
class NoiseGateProcessor extends AudioWorkletProcessor {
 static get parameterDescriptors(){return [
  ['threshold',-40,-96,0],['reductionDb',-60,-96,0],['hysteresis',6,0,24],
  ['attack',.003,0,1],['hold',.05,0,2],['release',.1,.001,3],
 ].map(([name,defaultValue,minValue,maxValue])=>({name,defaultValue,minValue,maxValue,automationRate:'a-rate'}));}
 constructor(options){super();this.options=options.processorOptions||{};this.frames=0;this.gate=new NoiseGate(sampleRate,this.options.mode);this.stopped=false;this.port.onmessage=event=>{if(event.data==='stop')this.stopped=true;};}
 process(inputs,outputs,parameters){if(this.stopped)return false;if(outputs[0]?.length){this.gate.process(inputs[0]||[],outputs[0],parameters,this.options.filterEnabled?(inputs[1]||[]):(inputs[0]||[]));this.frames+=outputs[0][0].length;if(this.options.meter&&this.frames>=sampleRate/20){this.frames=0;this.port.postMessage({time:currentTime,reduction:20*Math.log10(Math.max(1e-8,this.gate.gain??1)),open:this.gate.open});}}return true;}
}
registerProcessor('cuestamp-noise-gate',NoiseGateProcessor);
