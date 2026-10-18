import {DelayToneFilter} from './delay-tone-filter.js';
export class FeedbackDelay {
 constructor(sampleRate,maximum=2,mode='stereo',filter={}){
  if(!Number.isFinite(sampleRate)||sampleRate<=0||!Number.isFinite(maximum)||maximum<.01||maximum>24)throw Error('Invalid delay size.');
  if(!['stereo','pingPong'].includes(mode))throw Error('Invalid delay mode.');this.mode=mode;
  this.filters=filter.filterEnabled?[new DelayToneFilter(sampleRate,filter.lowCutHz,filter.highCutHz),new DelayToneFilter(sampleRate,filter.lowCutHz,filter.highCutHz)]:null;
  this.sampleRate=sampleRate;this.size=Math.ceil(sampleRate*maximum)+2;this.left=new Float32Array(this.size);this.right=new Float32Array(this.size);this.index=0;
 }
 process(input,output,parameters){
  const [left,right]=output;if(!left)return;
  const value=(name,i)=>parameters[name][parameters[name].length===1?0:i];
  for(let i=0;i<left.length;i++){
   const distance=Math.min(this.size-2,Math.max(1,value('time',i)*this.sampleRate)),position=(this.index-distance+this.size)%this.size,a=Math.floor(position),b=(a+1)%this.size,f=position-a;
   let l=this.left[a]*(1-f)+this.left[b]*f,r=this.right[a]*(1-f)+this.right[b]*f,feedback=Math.max(0,Math.min(.9,value('feedback',i)));
   if(this.filters){l=this.filters[0].process(l);r=this.filters[1].process(r);}
   const mono=input.length>1?((input[0]?.[i]||0)+(input[1]?.[i]||0))*.5:(input[0]?.[i]||0);
   this.left[this.index]=this.mode==='pingPong'?mono+r*feedback:(input[0]?.[i]||0)+l*feedback;this.right[this.index]=this.mode==='pingPong'?l*feedback:(input.length>1?(input[1]?.[i]||0):(input[0]?.[i]||0))+r*feedback;left[i]=l;if(right)right[i]=r;this.index=(this.index+1)%this.size;
  }
 }
}
