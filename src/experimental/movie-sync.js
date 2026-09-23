import {exactFrameRate} from './timecode.js';
const desired=new WeakMap();
export function movieFrame(session,time){
 for(const track of session.tracks){if(track.kind!=='video'||track.mute)continue;for(const region of track.regions){if(region.mute||time<region.start||time>=region.start+region.duration)continue;
 const frame=1/exactFrameRate(session.frameRate||24),local=time-region.start;
 return {assetId:region.assetId,reverse:region.reverse,sourceTime:region.offset+(region.reverse?Math.max(0,region.duration-local-frame):local),tolerance:frame/2};
 }}return null;
}
export function syncMovie(video,session,time,urls,{playing=false}={}){
 if(!video)return;const frame=movieFrame(session,time),url=frame&&urls.get(frame.assetId),run=Boolean(url&&playing&&!frame.reverse);desired.set(video,{url,run});
 if(!url){video.pause();video.hidden=true;return;}
 video.hidden=false;const changed=video.getAttribute('src')!==url;if(changed)video.src=url;
 if(!run)video.pause();
 // Stopped and reverse playback seek explicitly; forward playback follows its media clock.
 if(changed||((!run||!video.seeking)&&Math.abs(video.currentTime-frame.sourceTime)>frame.tolerance))video.currentTime=frame.sourceTime;
 if(run&&video.paused)Promise.resolve(video.play()).then(()=>{const latest=desired.get(video);if(!latest?.run)video.pause();}).catch(()=>{});
}
