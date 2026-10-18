// 4x linear-phase FIR resampling for nonlinear audio processing. The two stages
// each delay by 32 base-rate frames. This is audio resampling, not peak limiting.
const factor=4,length=257,center=(length-1)/2;
const coefficients=Float64Array.from({length},(_,n)=>{
 const x=n-center,phase=2*Math.PI*n/(length-1);
 const window=.35875-.48829*Math.cos(phase)+.14128*Math.cos(2*phase)-.01168*Math.cos(3*phase);
 return (x===0?1/factor:Math.sin(Math.PI*x/factor)/(Math.PI*x))*window;
});
const sum=coefficients.reduce((a,b)=>a+b,0);for(let i=0;i<length;i++)coefficients[i]/=sum;
const phases=Array.from({length:factor},(_,phase)=>Float64Array.from(coefficients.filter((_,i)=>i%factor===phase),v=>v*factor));
const typed=value=>value instanceof Float32Array||value instanceof Float64Array;
function validate(input,output,channels,scale){
 if(!Array.isArray(input)||!Array.isArray(output)||input.length!==channels||output.length!==channels||input.some(c=>!typed(c)||c.length!==input[0].length)||output.some(c=>!typed(c)||c.length!==input[0].length*scale))throw Error('Resampling requires matching channel buffers and an exact 4x frame ratio.');
 if(output.some((c,i)=>input.some(source=>source.buffer===c.buffer)||output.some((other,j)=>i!==j&&other.buffer===c.buffer)))throw Error('Resampling output buffers must not alias input or each other.');
 // Preflight before mutating history, including invalid values late in a block.
 for(const channel of input)for(const value of channel)if(!Number.isFinite(value))throw Error('Resampling requires finite audio samples.');
}
function channelCount(channels){if(!Number.isInteger(channels)||channels<1||channels>2)throw Error('Choose one or two resampling channels.');return channels;}
export const oversamplingLatencyFrames=64;
export class FourTimesInterpolator {
 constructor(channels=2){this.channels=channelCount(channels);this.latencyFrames=32;this.history=Array.from({length:channels},()=>new Float64Array(65));this.index=0;}
 reset(){for(const channel of this.history)channel.fill(0);this.index=0;}
 process(input,output){
  validate(input,output,this.channels,4);
  for(let i=0;i<input[0].length;i++){
   for(let c=0;c<this.channels;c++){
    const history=this.history[c];history[this.index]=input[c][i];
    for(let phase=0;phase<4;phase++){const taps=phases[phase];let result=0,k=this.index;for(let j=0;j<taps.length;j++){result+=taps[j]*history[k];if(--k<0)k=64;}output[c][i*4+phase]=result;}
   }
   this.index=(this.index+1)%65;
  }
 }
}
export class FourTimesDecimator {
 constructor(channels=2){this.channels=channelCount(channels);this.latencyFrames=32;this.history=Array.from({length:channels},()=>new Float64Array(length));this.index=0;}
 reset(){for(const channel of this.history)channel.fill(0);this.index=0;}
 process(input,output){
  validate(input,output,this.channels,1/4);
  for(let i=0;i<input[0].length;i++){
   for(let c=0;c<this.channels;c++){
    const history=this.history[c];history[this.index]=input[c][i];
    if(i%4===0){let result=0,k=this.index;for(let j=0;j<length;j++){result+=coefficients[j]*history[k];if(--k<0)k=length-1;}output[c][i/4]=result;}
   }
   this.index=(this.index+1)%length;
  }
 }
}
