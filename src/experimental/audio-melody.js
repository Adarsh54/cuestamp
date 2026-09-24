import {z} from 'zod';
export const melodySettingsSchema=z.object({minPitch:z.number().int().min(24).max(95).default(36),maxPitch:z.number().int().min(25).max(96).default(84),floorDb:z.number().finite().min(-80).max(-12).default(-45),minimumDuration:z.number().finite().min(.04).max(1).default(.08)}).strict().refine(v=>v.maxPitch>v.minPitch,{message:'Highest pitch must be above lowest pitch.'});
const frequency=p=>440*2**((p-69)/12);
// Windowed-sinc low-pass before integer decimation. Centered filtering introduces
// no timestamp delay; channels stay separate so stereo polarity cannot cancel.
function decimate(channel,factor){
 if(factor===1)return channel;
 const radius=16*factor,cutoff=.45/factor,kernel=[];let sum=0;
 for(let i=-radius;i<=radius;i++){const sinc=i===0?2*cutoff:Math.sin(2*Math.PI*cutoff*i)/(Math.PI*i),value=sinc*(.5+.5*Math.cos(Math.PI*i/radius));kernel.push(value);sum+=value;}
 const result=new Float32Array(Math.ceil(channel.length/factor));
 for(let j=0;j<result.length;j++){let value=0;for(let i=-radius;i<=radius;i++){const k=j*factor+i;if(k>=0&&k<channel.length)value+=channel[k]*kernel[i+radius];}result[j]=value/sum;}
 return result;
}
// YIN cumulative mean normalized difference and parabolic lag refinement.
// de Cheveigné & Kawahara (2002), doi:10.1121/1.1458024.
function estimate(data,center,rate,minHz,maxHz){
 const maxLag=Math.ceil(rate/minHz),minLag=Math.max(2,Math.floor(rate/maxHz)),window=Math.max(256,2*maxLag),start=Math.round(center-(window+maxLag)/2),difference=new Float64Array(maxLag+2);let running=0;
 for(let lag=1;lag<=maxLag+1;lag++){let sum=0;for(let i=0;i<window;i++){const a=data[start+i]??0,b=data[start+i+lag]??0;sum+=(a-b)**2;}running+=sum;difference[lag]=running>0?sum*lag/running:1;}
 for(let lag=minLag;lag<=maxLag;lag++)if(difference[lag]<.15){while(lag<maxLag&&difference[lag+1]<difference[lag])lag++;const a=difference[lag-1],b=difference[lag],c=difference[lag+1],denominator=a-2*b+c,delta=denominator===0?0:Math.max(-.5,Math.min(.5,.5*(a-c)/denominator)),hz=rate/(lag+delta);if(hz<minHz||hz>maxHz)return null;return {pitch:69+12*Math.log2(hz/440),confidence:1-b};}
 return null;
}
export function detectMelody(channels,sampleRate,options={},onProgress=()=>{}){
 const settings=melodySettingsSchema.parse(options),length=channels[0]?.length;
 if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000||!length||channels.length<1||channels.length>2||channels.some(c=>!(c instanceof Float32Array)||c.length!==length)||length/sampleRate>120||length*channels.length*4>250*1024*1024)throw Error('Analyze up to two minutes of mono/stereo audio within 250 MB of PCM. Split longer recordings first.');
 for(const channel of channels)for(const value of channel)if(!Number.isFinite(value))throw Error('Audio contains non-finite samples.');
 onProgress(0);const factor=Math.max(1,Math.ceil(sampleRate/12000)),rate=sampleRate/factor,data=channels.map(c=>decimate(c,factor)),duration=length/sampleRate,hop=Math.round(rate*.02),floor=10**(settings.floorDb/10),frames=[];
 for(let start=0;start<data[0].length;start+=hop){
  const end=Math.min(data[0].length,start+hop);let best=null,power=0;
  for(const channel of data){let energy=0,mean=0;for(let i=start;i<end;i++){energy+=channel[i]**2;mean+=channel[i];}energy=Math.max(0,energy/(end-start)-(mean/(end-start))**2);if(energy>power){power=energy;best=channel;}}
  const result=power>=floor?estimate(best,(start+end)/2,rate,frequency(settings.minPitch-.5),frequency(settings.maxPitch+.5)):null;
  frames.push({start:start/rate,end:Math.min(duration,end/rate),...result,velocity:Math.min(1,Math.max(.1,Math.sqrt(power)*2))});
  if(frames.length%50===0)onProgress(start/data[0].length);
 }
 const notes=[];let run=null;
 const flush=()=>{if(run&&run.end-run.start+1e-9>=settings.minimumDuration)notes.push({pitch:run.pitch,start:run.start,duration:run.end-run.start,velocity:run.velocity/run.count,cents:100*(run.sum/run.count-run.pitch),confidence:run.confidence/run.count});run=null;};
 for(const frame of frames){const pitch=frame.pitch===undefined?null:Math.round(frame.pitch);if(pitch===null||pitch<settings.minPitch||pitch>settings.maxPitch){flush();continue;}if(run?.pitch!==pitch){flush();run={pitch,start:frame.start,end:frame.end,sum:0,confidence:0,velocity:0,count:0};}run.end=frame.end;run.sum+=frame.pitch;run.confidence+=frame.confidence;run.velocity+=frame.velocity;run.count++;}flush();onProgress(1);return notes;
}
