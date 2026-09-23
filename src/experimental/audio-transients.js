import {z} from 'zod';
export const transientSettingsSchema=z.object({riseDb:z.number().finite().min(3).max(24).default(9),floorDb:z.number().finite().min(-96).max(-12).default(-45),minimumGap:z.number().finite().min(.01).max(1).default(.05)}).strict();
// Short-time energy rise detector. Channels contribute power independently so
// opposite-polarity stereo cannot cancel. This finds attacks, not musical beats.
export function detectTransients(channels,sampleRate,options={},onProgress=()=>{}){
 const settings=transientSettingsSchema.parse(options),length=channels[0]?.length;
 if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>192000||!length||channels.length<1||channels.length>2||channels.some(c=>!(c instanceof Float32Array)||c.length!==length)||length/sampleRate>600||length*channels.length*4>250*1024*1024)throw Error('Analyze up to 10 minutes of mono/stereo audio within 250 MB of PCM.');
 const hop=Math.max(1,Math.round(sampleRate*.002)),history=10,energies=[],floor=10**(settings.floorDb/10),ratio=10**(settings.riseDb/10),gap=Math.ceil(settings.minimumGap*sampleRate),markers=[];let sum=0,last=-gap,previous=0;
 for(let start=0,block=0;start<length;start+=hop,block++){
  const end=Math.min(length,start+hop);let energy=0;
  for(let i=start;i<end;i++){let power=0;for(const channel of channels){const v=channel[i];if(!Number.isFinite(v))throw Error('Audio contains non-finite samples.');power=Math.max(power,v*v);}energy+=power;}energy/=end-start;
  const baseline=sum/Math.max(1,energies.length),threshold=Math.max(floor,baseline*ratio);
  if(energy>threshold&&energy>previous&&start-last>=gap){
   let onset=start;for(let i=start;i<end;i++)if(channels.some(c=>c[i]*c[i]>=threshold)){onset=i;break;}
   if(onset>0&&onset<length){markers.push(onset/sampleRate);last=onset;if(markers.length>10000)throw Error('Too many attacks. Increase the minimum gap.');}
  }
  energies.push(energy);sum+=energy;if(energies.length>history)sum-=energies.shift();sum=Math.max(0,sum);previous=energy;if(block%256===0)onProgress(start/length);
 }
 onProgress(1);return markers;
}
export function adjacentTransient(markers,position,direction,sampleRate){const epsilon=.5/sampleRate;return direction==='next'?markers.find(t=>t>position+epsilon):markers.findLast(t=>t<position-epsilon);}
