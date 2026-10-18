import {wavMarkerChunks} from './wav-markers.js';
import {encodeWav} from './wav.js';
const MAX_FRAMES=16384;
// The render supplies a known frame count. A complete header can therefore be
// written up front, without seeking or retaining earlier audio chunks.
export function wavStreamLayout({channels,sampleRate,frames},{bitDepth=16,dither='none',markers=[]}={}){
 if(!Number.isInteger(channels)||channels<1||channels>32)throw Error('Choose 1 to 32 audio channels.');
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>384000)throw Error('Choose a supported WAV sample rate.');
 if(!Number.isSafeInteger(frames)||frames<1)throw Error('Choose a positive WAV frame count.');
 if(![16,24,32].includes(bitDepth))throw Error('Choose 16-bit, 24-bit or 32-bit float WAV.');
 if(!['none','tpdf'].includes(dither))throw Error('Choose no dither or triangular dither.');
 const metadata=wavMarkerChunks(markers,sampleRate,frames),dataSize=frames*channels*(bitDepth/8),padding=dataSize%2,headerSize=bitDepth===32?56:44,totalBytes=headerSize+dataSize+padding+metadata.length;
 if(!Number.isSafeInteger(totalBytes)||totalBytes-8>0xffffffff)throw Error('Audio exceeds the WAV file size limit.');
 // Reuse the established format header, then patch only its total-size fields.
 const empty={numberOfChannels:channels,length:0,sampleRate,getChannelData:()=>new Float32Array()};
 return {channels,sampleRate,frames,bitDepth,dither,metadata,padding,headerSize,dataSize,totalBytes,header:async()=>{
  const bytes=new Uint8Array(await encodeWav(empty,{bitDepth}).arrayBuffer()),view=new DataView(bytes.buffer);
  view.setUint32(4,totalBytes-8,true);view.setUint32(headerSize-4,dataSize,true);if(bitDepth===32)view.setUint32(44,frames,true);return bytes;
 }};
}
function wait(promise,signal){
 if(!signal)return Promise.resolve(promise);
 return new Promise((resolve,reject)=>{
  const cleanup=()=>signal.removeEventListener('abort',abort),abort=()=>{cleanup();reject(signal.reason);};
  signal.addEventListener('abort',abort,{once:true});
  Promise.resolve(promise).then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
  if(signal.aborted)abort();
 });
}
// sink implements async write(Uint8Array), close(), abort(error). Each write is
// awaited before pulling more input: backpressure cannot turn into an output queue.
export async function writeWavStream(format,chunks,sink,{signal,onProgress=()=>{},random=Math.random,...options}={}){
 let iterator,completed=false,written=0;
 try{
  const layout=wavStreamLayout(format,options);signal?.throwIfAborted();
  iterator=chunks[Symbol.asyncIterator]?.()??chunks[Symbol.iterator]?.();if(!iterator)throw Error('Audio chunks must be iterable.');
  await wait(sink.write(await layout.header()),signal);
  while(true){
   signal?.throwIfAborted();const next=await wait(iterator.next(),signal);if(next.done)break;
   const pcm=next.value;if(!Array.isArray(pcm)||pcm.length!==layout.channels||pcm.some(channel=>!(channel instanceof Float32Array)||channel.length!==pcm[0].length))throw Error('Audio chunk channels or frame lengths do not match the WAV format.');
   const length=pcm[0].length;if(written+length>layout.frames)throw Error('Audio stream exceeds its declared frame count.');
   for(let offset=0;offset<length;offset+=MAX_FRAMES){
    signal?.throwIfAborted();const count=Math.min(MAX_FRAMES,length-offset),buffer={numberOfChannels:layout.channels,length:count,sampleRate:layout.sampleRate,getChannelData:c=>pcm[c].subarray(offset,offset+count)};
    // The existing encoder remains the single authority for PCM rounding,
    // overloads, nonfinite samples and dither. Discard each small RIFF wrapper.
    const encoded=await wait(encodeWav(buffer,{bitDepth:layout.bitDepth,dither:layout.dither,random}).arrayBuffer(),signal),data=new Uint8Array(encoded,layout.headerSize,count*layout.channels*layout.bitDepth/8);
    await wait(sink.write(data),signal);written+=count;onProgress(written/layout.frames);
   }
  }
  if(written!==layout.frames)throw Error('Audio stream ended before its declared frame count.');
  if(layout.padding)await wait(sink.write(new Uint8Array(layout.padding)),signal);
  if(layout.metadata.length)await wait(sink.write(layout.metadata),signal);
  signal?.throwIfAborted();await wait(sink.close(),signal);completed=true;return {frames:written,bytes:layout.totalBytes};
 }catch(error){try{await sink.abort(error);}catch{}throw error;}
 finally{if(!completed&&iterator?.return)try{Promise.resolve(iterator.return()).catch(()=>{});}catch{}}
}
