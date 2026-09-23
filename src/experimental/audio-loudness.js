// Mono/stereo BS.1770 integrated loudness. Filter parameters reconstruct the
// published 48 kHz coefficients at other sample rates (De Man formulation).
export function kWeighting(sampleRate){
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw Error('Unsupported loudness sample rate.');
 const denominator=(frequency,q)=>{const k=Math.tan(Math.PI*frequency/sampleRate),d=1+k/q+k*k;return {k,d,a:[2*(k*k-1)/d,(1-k/q+k*k)/d]};};
 const shelf=denominator(1681.974450955533,.7071752369554196),v=10**(3.999843853973347/20),root=v**.4996667741545416,{k,d}=shelf;
 return [{b:[(v+root*k/.7071752369554196+k*k)/d,2*(k*k-v)/d,(v-root*k/.7071752369554196+k*k)/d],a:shelf.a},{b:[1,-2,1],a:denominator(38.13547087602444,.5003270373238773).a}];
}
const level=power=>power>0?-.691+10*Math.log10(power):null;
export function integratedLoudness(channels,sampleRate){
 const coefficients=kWeighting(sampleRate),frames=channels?.[0]?.length;
 if(!Array.isArray(channels)||channels.length<1||channels.length>2||!frames||frames>sampleRate*600||channels.some(c=>!(c instanceof Float32Array)||c.length!==frames)||frames*channels.length*4>250*1024*1024)throw Error('Loudness requires matching mono/stereo PCM, up to ten minutes and 250 MB.');
 const filters=channels.map(()=>coefficients.map(({a,b})=>({a,b,x1:0,x2:0,y1:0,y2:0})));
 const block=Math.round(.4*sampleRate),ring=new Float64Array(block),powers=[];
 let sum=0,next=block,index=0;
 for(let frame=0;frame<frames;frame++){
  let power=0;
  for(let channel=0;channel<channels.length;channel++){
   let value=channels[channel][frame];if(!Number.isFinite(value))throw Error('Loudness cannot measure non-finite audio.');
   for(const f of filters[channel]){const output=f.b[0]*value+f.b[1]*f.x1+f.b[2]*f.x2-f.a[0]*f.y1-f.a[1]*f.y2;f.x2=f.x1;f.x1=value;f.y2=f.y1;f.y1=output;value=output;}
   power+=value*value;
  }
  const slot=frame%block;sum+=power-ring[slot];ring[slot]=power;
  if(frame+1===next){powers.push(Math.max(0,sum/block));next=block+Math.round(++index*block/4);}
 }
 const absolute=powers.filter(p=>level(p)>-70&&p>0);
 if(!absolute.length)return {integratedLufs:null,blocks:powers.length,gatedBlocks:0};
 const mean=values=>values.reduce((sum,p)=>sum+p,0)/values.length;
 const threshold=Math.max(-70,level(mean(absolute))-10),gated=absolute.filter(p=>level(p)>threshold);
 return {integratedLufs:gated.length?level(mean(gated)):null,blocks:powers.length,gatedBlocks:gated.length};
}
