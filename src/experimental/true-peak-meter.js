// BS.1770-5 Annex 2 four-phase FIR. History persists across render blocks.
const taps=[
 [.001708984375,-.0291748046875,-.0189208984375,-.00830078125],
 [.010986328125,.029296875,.0330810546875,.014892578125],
 [-.0196533203125,-.0517578125,-.0582275390625,-.026611328125],
 [.033203125,.089111328125,.1015625,.047607421875],
 [-.0594482421875,-.16650390625,-.2003173828125,-.102294921875],
 [.1373291015625,.465087890625,.77978515625,.97216796875],
 [.97216796875,.77978515625,.465087890625,.1373291015625],
 [-.102294921875,-.2003173828125,-.16650390625,-.0594482421875],
 [.047607421875,.1015625,.089111328125,.033203125],
 [-.026611328125,-.0582275390625,-.0517578125,-.0196533203125],
 [.014892578125,.0330810546875,.029296875,.010986328125],
 [-.00830078125,-.0189208984375,-.0291748046875,.001708984375]
];

export class TruePeakMeter {
 constructor(channels=2){
  if(!Number.isInteger(channels)||channels<1||channels>2)throw Error('Choose one or two true-peak meter channels.');
  this.channels=channels;this.history=Array.from({length:channels},()=>new Float64Array(12));this.peaks=new Float64Array(channels);this.framePeaks=new Float64Array(channels);this.index=0;this.finished=false;
 }
 pushFrame(left,right=left){
  if(this.finished)throw Error('True-peak measurement has finished.');
  if(!Number.isFinite(left)||(this.channels===2&&!Number.isFinite(right)))throw Error('True-peak analysis cannot measure non-finite audio.');
  for(let c=0;c<this.channels;c++){
   const sample=c===0?left:right,history=this.history[c];history[this.index]=sample;let a=0,b=0,d=0,e=0,k=this.index;
   for(let j=0;j<12;j++){const value=history[k],weights=taps[j];a+=value*weights[0];b+=value*weights[1];d+=value*weights[2];e+=value*weights[3];if(--k<0)k=11;}
   this.framePeaks[c]=Math.max(Math.abs(sample),Math.abs(a),Math.abs(b),Math.abs(d),Math.abs(e));
   this.peaks[c]=Math.max(this.peaks[c],this.framePeaks[c]);
  }
  this.index=(this.index+1)%12;
  return this.framePeaks; // Reused view: consume before the next frame.
 }
 process(channels){
  if(this.finished)throw Error('True-peak measurement has finished.');
  if(!Array.isArray(channels)||channels.length!==this.channels||channels.some(c=>!(c instanceof Float32Array)||c.length!==channels[0].length))throw Error('True-peak blocks require matching channel arrays.');
  // Validate first so a malformed block cannot leave a partially updated meter.
  for(const channel of channels)for(const sample of channel)if(!Number.isFinite(sample))throw Error('True-peak analysis cannot measure non-finite audio.');
  for(let i=0;i<channels[0].length;i++)this.pushFrame(channels[0][i],channels[1]?.[i]);
 }
 read({reset=false}={}){
  const result={oversample:4,peaksDbtp:Array.from(this.peaks,peak=>peak?20*Math.log10(peak):null)};
  if(reset)this.peaks.fill(0);return result;
 }
 finish(){
  if(!this.finished){for(let i=0;i<11;i++)this.pushFrame(0,0);this.finished=true;}
  return this.read();
 }
}
