// Short stereo delay with per-sample feedback. A native Web Audio feedback graph
// would impose a render-quantum minimum delay, changing sub-millisecond flanging.
export class StereoFlanger {
 constructor(sampleRate){
  if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>384000)throw Error('Invalid flanger sample rate.');
  this.sampleRate=sampleRate;this.size=Math.ceil(sampleRate*.006)+2;this.rings=[new Float64Array(this.size),new Float64Array(this.size)];this.index=0;
 }
 process(input,output,parameters){
  const value=(key,i)=>parameters[key][parameters[key].length===1?0:i];
  for(let i=0;i<output[0].length;i++){
   const feedback=Math.max(-.95,Math.min(.95,value('feedback',i))),mix=Math.max(0,Math.min(1,value('mix',i)));
   for(let c=0;c<2;c++){
    const raw=input[c]?.[i]??input[0]?.[i]??0,dry=Number.isFinite(raw)?raw:0,ring=this.rings[c],delay=Math.max(1,Math.min(this.sampleRate*.006,value(c?'rightMs':'leftMs',i)*this.sampleRate/1000)),read=(this.index-delay+this.size)%this.size,lo=Math.floor(read),fraction=read-lo,wet=ring[lo]*(1-fraction)+ring[(lo+1)%this.size]*fraction;
    ring[this.index]=dry+wet*feedback;if(output[c])output[c][i]=dry*(1-mix)+wet*mix;
   }
   this.index=(this.index+1)%this.size;
  }
 }
}
