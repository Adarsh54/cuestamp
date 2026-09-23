export function audioStatistics(channels){
 if(channels.length!==2||!channels[0]?.length||channels[0].length!==channels[1]?.length)throw Error('Analysis requires equal-length stereo channels.');
 return channels.map(samples=>{let peak=0,peakFrame=null,energy=0,overSamples=0;for(let i=0;i<samples.length;i++){const sample=samples[i];if(!Number.isFinite(sample))throw Error('The mix contains non-finite audio samples. Check effect levels.');const level=Math.abs(sample);if(level>peak){peak=level;peakFrame=i;}energy+=sample*sample;if(level>1)overSamples++;}return {peakDb:peak?20*Math.log10(peak):null,rmsDb:energy?10*Math.log10(energy/samples.length):null,peakFrame,overSamples};});
}
// Full-render normalized cross-product (no mean subtraction or time window).
// Mid/side use averaging, so a mono fold-down is (left + right) / 2.
export function stereoStatistics(channels){
 if(channels.length!==2||!channels[0]?.length||channels[0].length!==channels[1]?.length)throw Error('Analysis requires equal-length stereo channels.');
 let left=0,right=0,cross=0,mid=0,side=0;
 for(let i=0;i<channels[0].length;i++){const l=channels[0][i],r=channels[1][i];if(!Number.isFinite(l)||!Number.isFinite(r))throw Error('The mix contains non-finite audio samples. Check effect levels.');left+=l*l;right+=r*r;cross+=l*r;mid+=((l+r)/2)**2;side+=((l-r)/2)**2;}
 const db=energy=>energy?10*Math.log10(energy/channels[0].length):null;
 return {correlation:left&&right?Math.max(-1,Math.min(1,cross/Math.sqrt(left*right))):null,midRmsDb:db(mid),sideRmsDb:db(side)};
}

// Overlapping 400 ms windows, stepped every 100 ms. Both channels must exceed -60 dBFS RMS.
export function stereoWindowStatistics(channels,sampleRate){
 if(channels.length!==2||!channels[0]?.length||channels[0].length!==channels[1]?.length)throw Error('Analysis requires equal-length stereo channels.');
 if(![44100,48000,96000].includes(sampleRate))throw Error('Unsupported analysis sample rate.');
 const windowFrames=Math.round(sampleRate*.4),hopFrames=Math.round(sampleRate*.1),windows=Math.max(0,Math.floor((channels[0].length-windowFrames)/hopFrames)+1),result={windowFrames,hopFrames,gateDb:-60,windows,eligibleWindows:0,negativeWindows:0,worstCorrelation:null,worstStartFrame:null};
 let left=0,right=0,cross=0;
 const add=(from,to,sign)=>{for(let i=from;i<to;i++){const l=channels[0][i],r=channels[1][i];if(!Number.isFinite(l)||!Number.isFinite(r))throw Error('The mix contains non-finite audio samples.');left+=sign*l*l;right+=sign*r*r;cross+=sign*l*r;}};
 if(!windows)return result;add(0,windowFrames,1);
 for(let index=0;index<windows;index++){const start=index*hopFrames;if(index){add(start-hopFrames,start,-1);add(start+windowFrames-hopFrames,start+windowFrames,1);}if(left/windowFrames<=1e-6||right/windowFrames<=1e-6)continue;const correlation=Math.max(-1,Math.min(1,cross/Math.sqrt(left*right)));result.eligibleWindows++;if(correlation<0)result.negativeWindows++;if(result.worstCorrelation===null||correlation<result.worstCorrelation){result.worstCorrelation=correlation;result.worstStartFrame=start;}}
 return result;
}
