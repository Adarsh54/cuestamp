import {activeAutomation} from './automation-mode.js';

// Estimate decay from the slowest biquad pole, using the export sample rates.
// Include both extrema of active curves; this is a conservative static-pole
// estimate, not a guarantee for arbitrary rapidly time-varying filters.
export function eqTail(effect,inheritedOff=false){
 if(!effect.enabled)return 0;
 const points=activeAutomation(effect,inheritedOff),extrema=key=>{
  const values=[effect[key],...points.filter(p=>p.parameter===key).map(p=>p.value)];return [...new Set([Math.min(...values),Math.max(...values)])];
 };
 const gains=extrema('gainDb');
 if(['peaking','lowshelf','highshelf'].includes(effect.type)&&gains.every(g=>g===0))return 0;
 let seconds=0;
 for(const sampleRate of [44100,48000,96000])for(const frequency of extrema('frequency'))for(const q of extrema('q'))for(const gain of gains){
  const w=2*Math.PI*Math.min(frequency,sampleRate/2-1)/sampleRate,c=Math.cos(w),s=Math.sin(w),A=10**(gain/40);
  let alpha=s/(2*q),a0,a1,a2;
  if(['lowpass','highpass'].includes(effect.type))alpha=s/(2*10**(q/20));
  if(effect.type==='peaking'){a0=1+alpha/A;a1=-2*c;a2=1-alpha/A;}
  else if(effect.type==='lowshelf'||effect.type==='highshelf'){
   const beta=Math.sqrt(2*A)*s,sign=effect.type==='lowshelf'?1:-1;
   a0=(A+1)+sign*(A-1)*c+beta;a1=-2*sign*((A-1)+sign*(A+1)*c);a2=(A+1)+sign*(A-1)*c-beta;
  }else{a0=1+alpha;a1=-2*c;a2=1-alpha;}
  const b=a1/a0,d=a2/a0,discriminant=b*b-4*d;
  const radius=discriminant<0?Math.sqrt(d):Math.max(Math.abs((-b+Math.sqrt(discriminant))/2),Math.abs((-b-Math.sqrt(discriminant))/2));
  // Extra decay margin accommodates coefficient/residue size and near repeated
  // poles. Keep the existing bounded-render policy for near-unit poles.
  seconds=Math.max(seconds,radius>=1?30:radius>0?Math.log(1e-7)/(sampleRate*Math.log(radius)):0);
 }
 return Math.min(30,seconds);
}
