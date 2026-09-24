// Linked peak detection: either channel opens the same gain for both channels.
// Attack/release are one-pole time constants; detector decay is fixed at 10 ms.
export class NoiseGate {
 constructor(rate){this.rate=rate;this.envelope=0;this.gain=null;this.open=false;this.hold=0;this.detectorDecay=Math.exp(-1/(.01*rate));}
 process(input,output,parameters,detector=input){
  const value=(key,i)=>parameters[key][parameters[key].length===1?0:i];
  for(let i=0;i<output[0].length;i++){
   let peak=0;for(const channel of detector)peak=Math.max(peak,Math.abs(channel[i]||0));
   this.envelope=Math.max(peak,this.envelope*this.detectorDecay);
   const threshold=10**(value('threshold',i)/20),close=threshold*10**(-value('hysteresis',i)/20);
   if(this.envelope>=threshold){this.open=true;this.hold=Math.round(value('hold',i)*this.rate);}
   else if(this.open&&this.envelope>=close)this.hold=Math.round(value('hold',i)*this.rate);
   else if(this.open){if(this.hold>0)this.hold--;else this.open=false;}
   const floor=10**(value('reductionDb',i)/20),target=this.open?1:floor;
   this.gain??=floor;
   const time=value(target>this.gain?'attack':'release',i),coefficient=time===0?0:Math.exp(-1/(time*this.rate));
   this.gain=target+(this.gain-target)*coefficient;
   for(let c=0;c<output.length;c++)output[c][i]=(input[c]?.[i]||0)*this.gain;
  }
 }
}
