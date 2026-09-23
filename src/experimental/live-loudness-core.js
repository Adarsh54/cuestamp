import {kWeighting} from './audio-loudness.js';
// Continuous windows: every input sample is consumed, independent of UI polling.
export class LiveLoudness {
 constructor(rate){this.rate=rate;this.shortFrames=3*rate;this.momentaryFrames=Math.round(.4*rate);this.ring=new Float64Array(this.shortFrames);this.filters=[0,1].map(()=>kWeighting(rate).map(f=>({...f,x1:0,x2:0,y1:0,y2:0})));this.frames=0;this.shortSum=0;this.momentarySum=0;}
 push(left,right){
  let power=0;
  for(let channel=0;channel<2;channel++){
   let value=channel?right:left;if(!Number.isFinite(value))value=0;
   for(const f of this.filters[channel]){const output=f.b[0]*value+f.b[1]*f.x1+f.b[2]*f.x2-f.a[0]*f.y1-f.a[1]*f.y2;f.x2=f.x1;f.x1=value;f.y2=f.y1;f.y1=output;value=output;}
   power+=value*value;
  }
  const slot=this.frames%this.shortFrames,oldMomentary=this.frames>=this.momentaryFrames?this.ring[(this.frames-this.momentaryFrames)%this.shortFrames]:0;
  this.shortSum+=power-this.ring[slot];this.momentarySum+=power-oldMomentary;this.ring[slot]=power;this.frames++;
 }
 read(){const db=(sum,size)=>this.frames<size||sum/size<=1e-12?null:-.691+10*Math.log10(sum/size);return {momentaryLufs:db(this.momentarySum,this.momentaryFrames),shortTermLufs:db(this.shortSum,this.shortFrames)};}
}
