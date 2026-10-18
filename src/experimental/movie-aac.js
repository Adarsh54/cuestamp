// AAC encoders may emit priming audio without exposing its delay. Calibrate the
// same browser/configuration with a deterministic probe, then mux aligned packets.
const delays=new Map();
export function estimateEncoderDelay(reference,decoded,maxDelay=8192){
 const start=Math.floor(reference.length/3),length=Math.min(2048,reference.length-start);let best=-Infinity,lag=0;
 for(let offset=0;offset<=maxDelay&&start+offset+length<=decoded.length;offset++){
  let dot=0,a=0,b=0;for(let i=0;i<length;i++){const x=reference[start+i]||0,y=decoded[start+offset+i];dot+=x*y;a+=x*x;b+=y*y;}
  const score=a*b?dot/Math.sqrt(a*b):0;if(score>best){best=score;lag=offset;}
 }
 if(best<.65)throw Error('Could not verify AAC encoder timing. Use WebM export instead.');return lag;
}
async function encode(m,buffer,signal){
 const output=new m.Output({format:new m.Mp4OutputFormat(),target:new m.BufferTarget()}),source=new m.AudioBufferSource({codec:'aac',bitrate:192000});output.addAudioTrack(source);
 const abort=()=>{void output.cancel().catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
 try{signal?.throwIfAborted();await output.start();await source.add(buffer);source.close();await output.finalize();signal?.throwIfAborted();return new Blob([output.target.buffer],{type:'audio/mp4'});}catch(error){abort();signal?.throwIfAborted();throw error;}finally{signal?.removeEventListener('abort',abort);}
}
async function encoderDelay(m,rate,signal){
 if(delays.has(rate))return delays.get(rate);
 const probe=new AudioBuffer({numberOfChannels:2,length:Math.round(rate*.3),sampleRate:rate});let seed=54;
 for(let i=0;i<probe.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=(seed/2147483648-1)*.4;for(let c=0;c<2;c++)probe.getChannelData(c)[i]=v;}
 const file=await encode(m,probe,signal),input=new m.Input({formats:m.ALL_FORMATS,source:new m.BlobSource(file)});
 try{const track=await input.getPrimaryAudioTrack(),samples=new Float32Array(probe.length+16384);for await(const sample of new m.AudioSampleSink(track).samples()){try{signal?.throwIfAborted();const data=sample.toAudioBuffer().getChannelData(0),start=Math.round(sample.timestamp*rate);for(let i=0;i<data.length;i++)if(start+i>=0&&start+i<samples.length)samples[start+i]=data[i];}finally{sample.close();}}
  const delay=estimateEncoderDelay(probe.getChannelData(0),samples)/rate;delays.set(rate,delay);return delay;
 }finally{input.dispose();}
}
export async function prepareMovieAac(m,mix,{signal}={}){
 const delay=await encoderDelay(m,mix.sampleRate,signal),file=await encode(m,mix,signal),input=new m.Input({formats:m.ALL_FORMATS,source:new m.BlobSource(file)});
 try{const track=await input.getPrimaryAudioTrack(),config=await track.getDecoderConfig();return {delay,dispose:()=>input.dispose(),async feed(source){let first=true;try{for await(const packet of new m.EncodedPacketSink(track).packets()){signal?.throwIfAborted();const timestamp=packet.timestamp-delay;if(timestamp>=mix.duration)break;const duration=Math.min(packet.duration,mix.duration-timestamp);await source.add(packet.clone({timestamp,duration}),first?{decoderConfig:config}:undefined);first=false;}source.close();}finally{input.dispose();}}};}catch(error){input.dispose();throw error;}
}
