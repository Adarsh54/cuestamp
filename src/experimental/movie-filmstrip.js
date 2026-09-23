import {exactFrameRate,formatSessionTimecode} from './timecode.js';
export function movieFrameSamples(region,rate=24,count=8){
 const span=Math.max(0,region.duration-1/exactFrameRate(rate));
 return Array.from({length:count},(_,i)=>{const local=count===1?0:span*i/(count-1);return {timeline:region.start+local,source:region.offset+(region.reverse?span-local:local)};});
}
function waitFor(video,event,signal){return new Promise((resolve,reject)=>{
 const cleanup=()=>{clearTimeout(timer);video.removeEventListener(event,done);video.removeEventListener('error',failed);signal?.removeEventListener('abort',abort);};
 const done=()=>{cleanup();resolve();},failed=()=>{cleanup();reject(Error('Movie frames could not be decoded.'));},abort=()=>{cleanup();reject(signal.reason||Error('Canceled'));},timer=setTimeout(()=>{cleanup();reject(Error('Movie frame decoding timed out.'));},10000);
 video.addEventListener(event,done,{once:true});video.addEventListener('error',failed,{once:true});signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
});}
export async function renderMovieFrames(url,region,rate,{signal}={}){
 const video=document.createElement('video');video.muted=true;video.preload='auto';const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 try{signal?.throwIfAborted();const ready=waitFor(video,'loadeddata',signal);video.src=url;await ready;canvas.width=160;canvas.height=Math.max(1,Math.min(160,Math.round(160*video.videoHeight/video.videoWidth)));const frames=[];
 for(const point of movieFrameSamples(region,rate)){signal?.throwIfAborted();const source=Number.isFinite(video.duration)?Math.min(point.source,Math.max(0,video.duration-1/exactFrameRate(rate))):point.source;
 if(Math.abs(video.currentTime-source)>1e-7){const seeked=waitFor(video,'seeked',signal);video.currentTime=source;await seeked;}
 ctx.drawImage(video,0,0,canvas.width,canvas.height);frames.push({...point,image:canvas.toDataURL('image/jpeg',.7)});
 }return frames;
 }finally{video.pause();video.removeAttribute('src');video.load();}
}
export function createMovieFilmstrip(){let pending=null,cache=null;
 return {
 bind(root,{session,selectedRegion,position,urls,esc,seek}){
 pending?.abort();pending=null;const host=root?.querySelector('[data-movie-filmstrip]');if(!host)return;
 const regions=session.tracks.filter(t=>t.kind==='video').flatMap(t=>t.regions),region=regions.find(r=>r.id===selectedRegion)||regions.find(r=>position>=r.start&&position<r.start+r.duration)||regions[0],url=region&&urls.get(region.assetId);
 if(!region||!url){host.innerHTML='';return;}
 const key=JSON.stringify([url,region.id,region.start,region.offset,region.duration,region.reverse,session.frameRate]);
 const draw=()=>{host.innerHTML=`<p class="muted">Movie frames · ${esc(region.name||'Movie')}</p><div class="daw-movie-frames">${cache.frames.map((f,i)=>`<button type="button" data-movie-frame="${i}" aria-label="Go to movie frame ${formatSessionTimecode(f.timeline,session)}"><img src="${f.image}" alt="" width="160"><span>${formatSessionTimecode(f.timeline,session)}</span></button>`).join('')}</div>`;host.querySelectorAll('[data-movie-frame]').forEach(button=>button.onclick=()=>seek(cache.frames[Number(button.dataset.movieFrame)].timeline));};
 if(cache?.key===key){draw();return;}
 host.innerHTML='<button type="button" data-load-movie-frames>Show movie frames</button><p class="muted">Select a movie clip to preview its frames.</p>';
 host.querySelector('button').onclick=async function load(){const retry=message=>{host.innerHTML=`<p role="status">${esc(message)}</p><button type="button">Retry movie frames</button>`;host.querySelector('button').onclick=load;};const request=new AbortController();pending=request;host.innerHTML='<p role="status">Loading movie frames…</p><button type="button">Cancel</button>';host.querySelector('button').onclick=()=>{request.abort();retry('Movie frame loading canceled.');};try{const frames=await renderMovieFrames(url,region,session.frameRate,{signal:request.signal});if(request.signal.aborted||!host.isConnected)return;cache={key,frames};draw();}catch(error){if(!request.signal.aborted&&host.isConnected)retry(error.message);}finally{if(pending===request)pending=null;}};
 },
 dispose(){pending?.abort();pending=null;cache=null;}
 };
}
