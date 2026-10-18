import {prepareMovieAac} from './movie-aac.js';
// Conversion owns only the selected picture; the DAW render supplies the sole audio track.
export async function encodeMovieMix(file,mix,plan,{signal,onProgress=()=>{},format='auto'}={}){
 const requestedFormat=format;signal?.throwIfAborted();if(!['auto','mp4','webm'].includes(format))throw Error('Choose MP4, WebM or automatic movie export.');
 if(!file||file.size>250*1024*1024)throw Error('Movie export currently supports source files up to 250 MB.');
 const m=await import('mediabunny'),input=new m.Input({formats:m.ALL_FORMATS,source:new m.BlobSource(file)});let output,conversion,preparedAudio;
 const cancel=()=>{void conversion?.cancel().catch(()=>{});void output?.cancel().catch(()=>{});};signal?.addEventListener('abort',cancel,{once:true});
 try{
  signal?.throwIfAborted();const video=await input.getPrimaryVideoTrack();if(!video)throw Error('The selected source has no video track.');
  const first=Math.max(0,await input.getFirstTimestamp()),start=first+plan.offset,end=start+plan.duration;
  if(end>await video.computeDuration()+.05)throw Error('The selected video region extends beyond its source. Trim it before exporting.');
  const width=await video.getDisplayWidth(),height=await video.getDisplayHeight();
  const supported=async(v,a)=>await m.canEncodeVideo(v,{width,height})&&await m.canEncodeAudio(a,{numberOfChannels:2,sampleRate:mix.sampleRate});
  if(format==='auto')format=await supported('avc','aac')?'mp4':'webm';
  const codec=format==='mp4'?'avc':'vp9',audioCodec=format==='mp4'?'aac':'opus';
  if(!await supported(codec,audioCodec))throw Error(`This browser cannot encode ${format.toUpperCase()} video with audio. Try a browser with WebCodecs encoding support.`);
  output=new m.Output({format:format==='mp4'?new m.Mp4OutputFormat():new m.WebMOutputFormat(),target:new m.BufferTarget()});
  conversion=await m.Conversion.init({input,output,tracks:'primary',trim:{start,end},video:{codec,forceTranscode:true},audio:{discard:true},composable:true});
  if(!conversion.isValid||!conversion.utilizedTracks.includes(video))throw Error('This browser cannot decode and export the selected video codec.');
  conversion.onProgress=p=>onProgress(p);
  if(audioCodec==='aac'){try{preparedAudio=await prepareMovieAac(m,mix,{signal});}catch(error){signal?.throwIfAborted();if(requestedFormat==='auto'){cancel();return encodeMovieMix(file,mix,plan,{signal,onProgress,format:'webm'});}throw error;}}
  const audio=preparedAudio?new m.EncodedAudioPacketSource('aac'):new m.AudioBufferSource({codec:audioCodec,bitrate:192000});output.addAudioTrack(audio);signal?.throwIfAborted();await output.start();
  // Both tracks progress concurrently; input/output retain the current short-export limits.
  await Promise.all([conversion.execute(),preparedAudio?preparedAudio.feed(audio):audio.add(mix).then(()=>audio.close())]);signal?.throwIfAborted();await output.finalize();signal?.throwIfAborted();
  return {blob:new Blob([output.target.buffer],{type:format==='mp4'?'video/mp4':'video/webm'}),extension:format};
 }catch(error){cancel();signal?.throwIfAborted();throw error;}finally{signal?.removeEventListener('abort',cancel);preparedAudio?.dispose();input.dispose();}
}
