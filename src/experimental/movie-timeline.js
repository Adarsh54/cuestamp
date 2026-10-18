import {movieFrame} from './movie-sync.js';
import {exactFrameRate} from './timecode.js';
export function* movieTimelineFrames(plan){
 const rate=exactFrameRate(plan.frameRate),count=Math.ceil(plan.duration*rate);
 for(let i=0;i<count;i++){const timestamp=i/rate;yield {timestamp,duration:Math.min(1/rate,plan.duration-timestamp),picture:movieFrame(plan.picture,timestamp)};}
}
export function createTimelineMovieSource(m,sources,output,plan,{codec,width,height,signal,onProgress}){
 const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d'),source=new m.CanvasSource(canvas,{codec,quality:m.QUALITY_MEDIUM}),sinks=new Map();output.addVideoTrack(source);
 return async()=>{
  for(const frame of movieTimelineFrames(plan)){
   signal?.throwIfAborted();ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
   if(frame.picture){const {assetId,sourceTime}=frame.picture,media=sources.get(assetId);let sink=sinks.get(assetId);if(!sink){sink=new m.CanvasSink(media.video,{poolSize:1});sinks.set(assetId,sink);}
    const image=await sink.getCanvas(media.first+sourceTime);signal?.throwIfAborted();if(!image)throw Error('Unable to decode a movie frame in the arrangement.');
    const scale=Math.min(width/image.canvas.width,height/image.canvas.height),w=image.canvas.width*scale,h=image.canvas.height*scale;ctx.drawImage(image.canvas,(width-w)/2,(height-h)/2,w,h);
   }
   await source.add(frame.timestamp,frame.duration);signal?.throwIfAborted();onProgress((frame.timestamp+frame.duration)/plan.duration);
  }
  source.close();
 };
}
