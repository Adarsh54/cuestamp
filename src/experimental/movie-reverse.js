import {exactFrameRate} from './timecode.js';
// Match movieFrame's reverse seek mapping, including fractional project rates.
export function* reversedMovieFrames(start,duration,frameRate=24){
 const rate=exactFrameRate(frameRate),count=Math.ceil(duration*rate);
 for(let i=0;i<count;i++){const timestamp=i/rate;yield {timestamp,duration:Math.min(1/rate,duration-timestamp),sourceTime:start+Math.max(0,duration-timestamp-1/rate)};}
}
export function createReverseMovieSource(m,video,output,{codec,width,height,start,duration,frameRate,signal,onProgress}){
 const canvas=new OffscreenCanvas(width,height),context=canvas.getContext('2d'),sink=new m.CanvasSink(video,{poolSize:1}),source=new m.CanvasSource(canvas,{codec,quality:m.QUALITY_MEDIUM});
 output.addVideoTrack(source);
 return async()=>{
  for(const frame of reversedMovieFrames(start,duration,frameRate)){
   signal?.throwIfAborted();const image=await sink.getCanvas(frame.sourceTime);signal?.throwIfAborted();
   if(!image)throw Error('Unable to decode a reversed movie frame.');
   context.drawImage(image.canvas,0,0,width,height);await source.add(frame.timestamp,frame.duration);signal?.throwIfAborted();onProgress((frame.timestamp+frame.duration)/duration);
  }
  source.close();
 };
}
