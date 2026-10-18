// Stereo-linked sample-peak limiter. A minimum-gain window followed by a moving
// average provides a finite lookahead attack. Every gain in that average is at
// most the required gain of the delayed sample, including automated ceilings.
// This bounds digital sample peaks, not reconstructed/inter-sample true peaks.
export class LookaheadLimiter {
 constructor(sampleRate,lookaheadMs=5){
  if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>384000||!Number.isFinite(lookaheadMs)||lookaheadMs<0||lookaheadMs>20)throw Error('Invalid limiter sample rate or lookahead.');
  this.sampleRate=sampleRate;this.latencyFrames=Math.round(sampleRate*lookaheadMs/1000);this.size=this.latencyFrames+1;
  this.audio=[new Float64Array(this.size),new Float64Array(this.size)];this.gains=new Float64Array(this.size).fill(1);this.sum=this.size;this.envelope=1;this.gain=1;this.frame=0;
  this.queueValues=new Float64Array(this.size+1);this.queueFrames=new Float64Array(this.size+1);this.head=0;this.count=0;
 }
 process(input,output,parameters){
  const value=(key,i)=>parameters[key][parameters[key].length===1?0:i],capacity=this.queueValues.length;
  for(let i=0;i<output[0].length;i++){
   const frame=this.frame++,slot=frame%this.size,drive=10**(value('gainDb',i)/20),ceiling=10**(value('ceilingDb',i)/20);let peak=0;
   for(let c=0;c<2;c++){const raw=input[c]?.[i]??input[0]?.[i]??0,sample=Number.isFinite(raw)?raw*drive:0;this.audio[c][slot]=sample;peak=Math.max(peak,Math.abs(sample));}
   const required=peak>ceiling?ceiling/peak:1;
   while(this.count&&this.queueFrames[this.head]<frame-this.latencyFrames){this.head=(this.head+1)%capacity;this.count--;}
   while(this.count&&this.queueValues[(this.head+this.count-1)%capacity]>=required)this.count--;
   const tail=(this.head+this.count)%capacity;this.queueValues[tail]=required;this.queueFrames[tail]=frame;this.count++;
   const release=value('release',i),coefficient=Math.exp(-1/(Math.max(.001,release)*this.sampleRate));
   this.envelope=Math.min(this.queueValues[this.head],1+(this.envelope-1)*coefficient);
   this.sum+=this.envelope-this.gains[slot];this.gains[slot]=this.envelope;this.gain=Math.min(1,Math.max(0,this.sum/this.size));
   const delayed=(slot+1)%this.size;
   for(let c=0;c<output.length;c++)output[c][i]=frame<this.latencyFrames?0:this.audio[Math.min(c,1)][delayed]*this.gain;
  }
 }
}
