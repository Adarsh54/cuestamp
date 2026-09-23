// Exact min/max buckets preserve short transients that point-sampling can miss.
export function buildWaveformIndex(channels,blockSize=256){
 const frames=channels[0]?.length;if(!frames||!channels.length||channels.some(c=>!(c instanceof Float32Array)||c.length!==frames)||!Number.isInteger(blockSize)||blockSize<1)throw Error('Invalid waveform data.');
 return {frames,blockSize,channels:channels.map(data=>{const count=Math.ceil(frames/blockSize),min=new Float32Array(count),max=new Float32Array(count);for(let b=0;b<count;b++){let lo=Infinity,hi=-Infinity;for(let i=b*blockSize;i<Math.min(frames,(b+1)*blockSize);i++){const v=data[i];if(!Number.isFinite(v))throw Error('Audio contains non-finite samples.');lo=Math.min(lo,v);hi=Math.max(hi,v);}min[b]=lo;max[b]=hi;}return {min,max};})};
}
export function waveformRange(data,index,channel,start,end){
 if(start<0||end>data.length||start>=end||!Number.isInteger(start)||!Number.isInteger(end)||index.frames!==data.length||!index.channels[channel])throw Error('Invalid waveform range.');
 const size=index.blockSize,buckets=index.channels[channel];let lo=Infinity,hi=-Infinity,i=start;
 while(i<end&&i%size){lo=Math.min(lo,data[i]);hi=Math.max(hi,data[i]);i++;}
 while(i+size<=end){const b=i/size;lo=Math.min(lo,buckets.min[b]);hi=Math.max(hi,buckets.max[b]);i+=size;}
 while(i<end){lo=Math.min(lo,data[i]);hi=Math.max(hi,data[i]);i++;}return {min:lo,max:hi};
}
export function detailWaveformBins(buffer,index,region,view,bins=1000){
 if(!Number.isInteger(bins)||bins<1||bins>4096||!Number.isFinite(view.start)||!Number.isFinite(view.span)||view.start<0||view.span<=0||view.start+view.span>region.duration+1e-9)throw Error('Invalid waveform viewport.');
 const rate=buffer.sampleRate,offset=Math.round(region.offset*rate),length=Math.round(region.duration*rate);if(length<1)throw Error('The region is shorter than one source sample.');if(offset+length>buffer.length)throw Error('The region exceeds its source audio.');
 return Array.from({length:buffer.numberOfChannels},(_,c)=>{const data=buffer.getChannelData(c);return Array.from({length:bins},(_,i)=>{let a=Math.min(length-1,Math.max(0,Math.floor((view.start+view.span*i/bins)*rate))),b=Math.min(length,Math.max(a+1,Math.ceil((view.start+view.span*(i+1)/bins)*rate)));if(region.reverse)[a,b]=[length-b,length-a];return waveformRange(data,index,c,offset+a,offset+b);});});
}
export function waveformViewport(region,previous,operation,cursor=0,sampleRate=48000){
 const key=[region.id,region.offset,region.duration,region.reverse].join(':'),old=previous?.key===key?previous:{key,start:0,span:region.duration};
 if(operation==='fit')return {key,start:0,span:region.duration};
 if(operation==='left'||operation==='right')return {...old,start:Math.max(0,Math.min(region.duration-old.span,old.start+old.span*(operation==='left'?-.5:.5)))};
 if(operation==='in'||operation==='out'){const span=Math.min(region.duration,Math.max(Math.min(region.duration,16/sampleRate),old.span*(operation==='in'?.5:2))),center=cursor>=old.start&&cursor<=old.start+old.span?cursor:old.start+old.span/2;return {key,span,start:Math.max(0,Math.min(region.duration-span,center-span/2))};}return old;
}
export function detailWaveformView(region,kind,ready,busy,position){if(!region||kind!=='audio')return '';return `<details data-waveform-detail><summary>Audio waveform editor</summary>${ready?`<div class="button-row"><button data-waveform-view="in">Zoom in</button><button data-waveform-view="out">Zoom out</button><button data-waveform-view="fit">Fit region</button><button data-waveform-view="left" aria-label="Pan waveform left">←</button><button data-waveform-view="right" aria-label="Pan waveform right">→</button></div><canvas id="daw-audio-waveform" data-waveform-canvas width="1000" height="180" tabindex="0" role="slider" aria-label="Audio region cursor" aria-valuemin="0" aria-valuemax="${region.duration}" aria-valuenow="${Math.max(0,Math.min(region.duration,position-region.start))}" style="width:100%;height:180px;cursor:crosshair;touch-action:none"></canvas><output data-waveform-range></output><button data-waveform-split ${busy||position<=region.start||position>=region.start+region.duration?'disabled':''}>Split at cursor</button>`:`<button data-waveform-load ${busy?'disabled':''}>Load detailed waveform</button>`}<p class="muted">Click to place the cursor. Arrow keys move one sample; Shift moves 10 ms. Zoom reveals individual samples. Displays source amplitude before gain and effects; splits preserve the original file.</p></details>`;}
export function bindDetailWaveform(root,{buffer,index,region,view,position,onView,onSeek,onSplit,guard}){
 const canvas=root.querySelector('[data-waveform-canvas]');if(!canvas||!buffer||!index)return;const ctx=canvas.getContext('2d');let bins;try{bins=detailWaveformBins(buffer,index,region,view,1000);}catch(error){root.querySelector('[data-waveform-range]').textContent=error.message;root.querySelector('[data-waveform-split]').disabled=true;return;}const height=180/bins.length;
 ctx.clearRect(0,0,1000,180);ctx.strokeStyle=getComputedStyle(canvas).color;ctx.lineWidth=1;
 bins.forEach((channel,c)=>{const mid=height*(c+.5),scale=height*.45;ctx.beginPath();channel.forEach((p,i)=>{if(view.span*buffer.sampleRate<=1000){const y=mid-p.max*scale;if(i)ctx.lineTo(i+.5,y);else ctx.moveTo(i+.5,y);return;}ctx.moveTo(i+.5,mid-Math.max(-1,Math.min(1,p.max))*scale);ctx.lineTo(i+.5,mid-Math.max(-1,Math.min(1,p.min))*scale);});ctx.stroke();ctx.globalAlpha=.25;ctx.beginPath();ctx.moveTo(0,mid);ctx.lineTo(1000,mid);ctx.stroke();ctx.globalAlpha=1;});
 const x=(position-region.start-view.start)/view.span*1000;if(x>=0&&x<=1000){ctx.strokeStyle=getComputedStyle(canvas).getPropertyValue('--accent').trim()||getComputedStyle(canvas).color;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,180);ctx.stroke();}
 root.querySelector('[data-waveform-range]').textContent=`${view.start.toFixed(4)}–${(view.start+view.span).toFixed(4)} s within region · ${buffer.sampleRate} Hz`;
 const seek=local=>onSeek(region.start+Math.max(0,Math.min(region.duration,Math.round(local*buffer.sampleRate)/buffer.sampleRate)));
 canvas.onclick=guard(e=>{const box=canvas.getBoundingClientRect();seek(view.start+Math.max(0,Math.min(1,(e.clientX-box.left)/box.width))*view.span);});
 canvas.onkeydown=guard(e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();seek(e.key==='Home'?0:e.key==='End'?region.duration:Math.max(0,Math.min(region.duration,position-region.start))+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?.01:1/buffer.sampleRate));});
 root.querySelectorAll('[data-waveform-view]').forEach(el=>el.onclick=guard(()=>onView(el.dataset.waveformView)));root.querySelector('[data-waveform-split]').onclick=guard(onSplit);
}
