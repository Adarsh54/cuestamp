// BS.1770-5 Annex 2's four-phase, twelve-tap-per-phase interpolation FIR.
// Floating point needs no preliminary attenuation. Include source samples and
// zero-pad both boundaries so the filter tail cannot hide an end-of-file peak.
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
export function truePeakStatistics(channels,sampleRate){
 const frames=channels?.[0]?.length;
 if(![44100,48000,96000].includes(sampleRate)||!Array.isArray(channels)||channels.length<1||channels.length>2||!frames||frames>sampleRate*600||frames*channels.length*4>250*1024*1024||channels.some(c=>!(c instanceof Float32Array)||c.length!==frames))throw Error('True-peak analysis requires matching mono/stereo PCM at 44.1, 48 or 96 kHz, up to ten minutes and 250 MB.');
 const peaksDbtp=channels.map(source=>{
  let peak=0;
  for(const sample of source){if(!Number.isFinite(sample))throw Error('True-peak analysis cannot measure non-finite audio.');peak=Math.max(peak,Math.abs(sample));}
  if(!peak)return null;
  for(let i=0;i<frames+11;i++){
   let a=0,b=0,c=0,d=0;
   for(let j=Math.max(0,i-frames+1);j<Math.min(12,i+1);j++){
    const value=source[i-j],weights=taps[j];a+=value*weights[0];b+=value*weights[1];c+=value*weights[2];d+=value*weights[3];
   }
   peak=Math.max(peak,Math.abs(a),Math.abs(b),Math.abs(c),Math.abs(d));
  }
  return 20*Math.log10(peak);
 });
 return {oversample:4,peaksDbtp};
}
