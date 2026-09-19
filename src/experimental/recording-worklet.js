class CaptureProcessor extends AudioWorkletProcessor {
 constructor(options){super();this.startFrame=options?.processorOptions?.startFrame??0;this.endFrame=options?.processorOptions?.endFrame??Infinity;this.active=true;this.chunks=[];this.frames=0;this.port.onmessage=e=>{if(e.data==='stop'){this.active=false;this.flush();this.port.postMessage({done:true});}};}
 flush(){if(!this.frames)return;const channels=this.chunks[0].length,pcm=Array.from({length:channels},()=>new Float32Array(this.frames));let offset=0;for(const chunk of this.chunks){for(let c=0;c<channels;c++)pcm[c].set(chunk[c]||chunk[0],offset);offset+=chunk[0].length;}this.port.postMessage({pcm},pcm.map(c=>c.buffer));this.chunks=[];this.frames=0;}
 process(inputs){const input=inputs[0];if(!this.active)return true;
  if(input?.length&&input[0].length){const skip=Math.max(0,this.startFrame-currentFrame),end=Math.min(input[0].length,this.endFrame-currentFrame);if(end>skip){this.chunks.push(input.slice(0,2).map(c=>c.slice(skip,end)));this.frames+=end-skip;if(this.frames>=4096)this.flush();}}
  if(currentFrame+(input?.[0]?.length||128)>=this.endFrame){this.active=false;this.flush();this.port.postMessage({limit:true});}return true;
 }
}
registerProcessor('cuestamp-capture',CaptureProcessor);
