const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();await page.goto(process.env.CUESTAMP_URL||'http://127.0.0.1:5190/');
 const results=await page.evaluate(async()=>{
  const {newSession,SessionHistory}=await import('/src/experimental/session.js'),{scheduleSession}=await import('/src/experimental/audio-engine.js'),{createLiveMidiMonitor}=await import('/src/experimental/live-midi-monitor.js');
  const frequency=buffer=>{const data=buffer.getChannelData(0);let crossings=0;for(let i=4801;i<19200;i++)if(data[i-1]<=0&&data[i]>0)crossings++;return crossings/.3;};
  const results=[];
  for(const instrument of ['sine','sampler'])for(const range of [0,2,12]){
   const ctx=new OfflineAudioContext(2,24000,48000),sample=ctx.createBuffer(1,96000,48000);for(let i=0;i<sample.length;i++)sample.getChannelData(0)[i]=Math.sin(2*Math.PI*440*i/48000)*.2;
   const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'midi',instrument,pitchBendRange:range,sampleRoot:69,sampleAssetId:'sample'}},{op:'region.add',target:'t',values:{id:'r',duration:1}},{op:'note.add',target:'r',values:{pitch:69,start:0,duration:1,velocity:1}},{op:'event.add',target:'r',values:{type:'pitchBend',start:0,value:16383}}]);
   scheduleSession(ctx,h.session,new Map([['sample',sample]]),.2,{baseTime:0});results.push({instrument,range,frequency:frequency(await ctx.startRendering())});
  }
  for(const range of [0,12]){
   const ctx=new OfflineAudioContext(2,24000,48000),monitor=createLiveMidiMonitor(ctx,{instrument:'sine',pitchBendRange:range});monitor.push([0xe0,127,127]);monitor.push([0x90,69,127]);results.push({instrument:'monitor',range,frequency:frequency(await ctx.startRendering())});
  }
  return results;
 });
 for(const r of results)assert.ok(Math.abs(r.frequency-440*2**(r.range/12))<5,JSON.stringify(r));
 console.log('PASS: rendered synth, sampler seek and MIDI monitoring use configured bend ranges.',results);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
