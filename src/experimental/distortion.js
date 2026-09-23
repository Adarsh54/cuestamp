import {activeAutomation} from './automation-mode.js';
import {scheduleCurveAutomation} from './automation-curves.js';

// A fixed symmetric transfer curve allows drive to be automated as input gain.
// Map [-16,16] into the WaveShaper's [-1,1] domain; beyond it, tanh is effectively
// saturated. The dense table retains resolution for low-level signals.
const curve=Float32Array.from({length:32769},(_,i)=>Math.tanh(32*i/32768-16));
export function connectDistortion(context,input,effect,nodes,{position=0,base=context.currentTime,register}={}){
 const schedule=(param,key,transform=v=>v,exponential=false)=>{
  register?.(effect,key,param,transform,exponential);
  scheduleCurveAutomation(param,activeAutomation(effect),key,position,base,effect[key],transform,exponential);
 };
 const drive=context.createGain(),shape=context.createWaveShaper(),tone=context.createBiquadFilter(),level=context.createGain(),dry=context.createGain(),wet=context.createGain(),sum=context.createGain();
 shape.curve=curve;shape.oversample='4x';tone.type='lowpass';tone.Q.value=Math.SQRT1_2;
 schedule(drive.gain,'driveDb',v=>10**(v/20)/16,true);
 schedule(tone.frequency,'toneHz',v=>Math.min(v,context.sampleRate/2-1));
 schedule(level.gain,'outputDb',v=>10**(v/20),true);
 schedule(dry.gain,'mix',v=>1-v);schedule(wet.gain,'mix');
 input.connect(drive).connect(shape).connect(tone).connect(level).connect(wet).connect(sum);
 input.connect(dry).connect(sum);nodes.push(drive,shape,tone,level,dry,wet,sum);
 return sum;
}
