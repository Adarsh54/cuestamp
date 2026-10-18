// At most eight transferred blocks may await disk writes. A real-time audio
// clock cannot wait for storage: overrun fails the export instead of dropping PCM.
export class StreamCapture {
 constructor({startFrame,endFrame,channels=2,blockFrames=4096,maxPending=8},send){
  if(!Number.isSafeInteger(startFrame)||!Number.isSafeInteger(endFrame)||endFrame<=startFrame||!Number.isInteger(channels)||channels<1||channels>2||!Number.isInteger(blockFrames)||blockFrames<128||!Number.isInteger(maxPending)||maxPending<1)throw Error('Invalid streaming capture range.');
  Object.assign(this,{startFrame,endFrame,channels,blockFrames,maxPending,send,pending:0,used:0,active:true});this.allocate();
 }
 allocate(){this.pcm=Array.from({length:this.channels},()=>new Float32Array(this.blockFrames));}
 acknowledge(){this.pending=Math.max(0,this.pending-1);}
 stop(){this.active=false;this.pcm=[];}
 flush(){if(!this.used)return true;if(this.pending>=this.maxPending){this.stop();this.send({error:'Storage could not keep up with the audio render. Export stopped without dropping samples.'});return false;}
  const pcm=this.used===this.blockFrames?this.pcm:this.pcm.map(c=>c.slice(0,this.used));this.pending++;this.send({pcm},pcm.map(c=>c.buffer));this.used=0;this.allocate();return true;
 }
 process(input,currentFrame,quantum=128){
  if(!this.active)return;const from=Math.max(0,this.startFrame-currentFrame),to=Math.min(quantum,this.endFrame-currentFrame);
  for(let i=from;i<to;i++){for(let c=0;c<this.channels;c++)this.pcm[c][this.used]=input[c]?.[i]??input[0]?.[i]??0;if(++this.used===this.blockFrames&&!this.flush())return;}
  if(currentFrame+quantum>=this.endFrame){if(this.flush()){this.stop();this.send({done:true});}}
 }
}
