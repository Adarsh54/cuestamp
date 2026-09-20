const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();await page.goto(process.env.CUESTAMP_URL||'http://127.0.0.1:5190/');const result=await page.evaluate(async()=>{
  const {renderAudioStretch}=await import('/src/experimental/audio-stretch-client.js'),rate=48000,ctx=new OfflineAudioContext(2,rate,rate),buffer=ctx.createBuffer(2,rate,rate);
  for(let i=0;i<rate;i++){buffer.getChannelData(0)[i]=Math.sin(2*Math.PI*440*i/rate)*.5;buffer.getChannelData(1)[i]=-buffer.getChannelData(0)[i];}
  let progress=0;const channels=await renderAudioStretch(buffer,1.5,{onProgress:p=>progress=p});let crossings=0;for(let i=14401;i<57600;i++)if(channels[0][i-1]<=0&&channels[0][i]>0)crossings++;
  const controller=new AbortController();let canceled=false;try{await renderAudioStretch(buffer,2,{signal:controller.signal,onProgress:()=>controller.abort()});}catch(error){canceled=error.name==='AbortError';}
  return {frames:channels[0].length,frequency:crossings/.9,progress,canceled,sourceFrames:buffer.getChannelData(0).length,sourceSample:buffer.getChannelData(0)[100],stereo:channels[0].every((v,i)=>v===-channels[1][i])};
 });assert.equal(result.frames,72000);assert.ok(Math.abs(result.frequency-440)<5);assert.equal(result.progress,1);assert.equal(result.canceled,true);assert.equal(result.sourceFrames,48000);assert.ok(Math.abs(result.sourceSample-Math.sin(2*Math.PI*440*100/48000)*.5)<1e-7);assert.equal(result.stereo,true);console.log('PASS: browser worker time stretch, pitch, stereo, cancellation and intact source.',result);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
