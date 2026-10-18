// Independent windowed-sinc reconstruction models for offline peak diagnostics.
// Coefficients are generated from sinc and window equations, normalized per phase.
const sinc=x=>Math.abs(x)<1e-12?1:Math.sin(Math.PI*x)/(Math.PI*x);
function bessel0(x){let term=1,total=1;for(let k=1;k<100;k++){term*=x*x/(4*k*k);total+=term;if(term<total*1e-16)break;}return total;}
export class ReconstructionPeakMeter {
 constructor(channels=2,{size=32,window='kaiser',phases=4}={}){
  if(![1,2].includes(channels)||![16,32,64,128,512].includes(size)||!['kaiser','blackmanNuttall'].includes(window)||![4,16].includes(phases))throw Error('Unsupported reconstruction meter settings.');
  this.channels=channels;this.size=size;this.latencyFrames=size/2;this.index=0;this.history=Array.from({length:channels},()=>new Float64Array(size));this.framePeaks=new Float64Array(channels);
  this.filters=Array.from({length:phases},(_,phase)=>{const taps=Float64Array.from({length:size},(_,j)=>{const x=j+phase/phases-size/2,w=Math.PI*x/(size/2),weight=window==='kaiser'?bessel0(9*Math.sqrt(Math.max(0,1-(x/(size/2))**2))):.3635819+.4891775*Math.cos(w)+.1365995*Math.cos(2*w)+.0106411*Math.cos(3*w);return sinc(x)*weight;});const total=taps.reduce((a,b)=>a+b,0);return taps.map(v=>v/total);});
 }
 pushFrame(left,right=left){
  if(!Number.isFinite(left)||!Number.isFinite(right))throw Error('Reconstruction requires finite audio.');
  for(let c=0;c<this.channels;c++){const history=this.history[c];history[this.index]=c?right:left;let peak=Math.abs(history[this.index]);for(const taps of this.filters){let value=0,k=this.index;for(let j=0;j<this.size;j++){value+=taps[j]*history[k];if(--k<0)k=this.size-1;}peak=Math.max(peak,Math.abs(value));}this.framePeaks[c]=peak;}
  this.index=(this.index+1)%this.size;return this.framePeaks;
 }
}

// File resamplers may mirror the first samples around sample zero, and repeat
// the final sample when reflecting the tail. Measure these edge windows in
// addition to zero-extended reconstruction. A repeated source index shares gain.
export function measureReflectedBoundaries(channels,meter,onPeak){
 const frames=channels[0].length,period=2*frames-1,indices=new Int32Array(meter.size),maxima=new Float64Array(channels.length),half=meter.latencyFrames;
 const reflect=index=>{const p=((index%period)+period)%period;return p<frames?p:period-p;};
 const visit=t=>{
  for(let j=0;j<meter.size;j++)indices[j]=reflect(t+half-j);
  let level=0;
  for(let c=0;c<channels.length;c++){let peak=0;for(const taps of meter.filters){let value=0;for(let j=0;j<taps.length;j++)value+=taps[j]*channels[c][indices[j]];peak=Math.max(peak,Math.abs(value));}maxima[c]=Math.max(maxima[c],peak);level=Math.max(level,peak);}
  onPeak?.(level,indices); // indices is reused at the next boundary frame.
 };
 for(let t=0;t<Math.min(half,frames);t++)visit(t);
 for(let t=Math.max(half,frames-half);t<frames;t++)visit(t);
 return maxima;
}
