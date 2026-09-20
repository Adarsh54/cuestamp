const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();await page.goto(process.env.CUESTAMP_URL||'http://127.0.0.1:5190/');
 const results=await page.evaluate(async()=>{
  const {newSession,SessionHistory}=await import('/src/experimental/session.js'),{scheduleSession}=await import('/src/experimental/audio-engine.js'),{createLiveMidiMonitor}=await import('/src/experimental/live-midi-monitor.js'),{writeMidi,encodeMidiImport}=await import('/src/experimental/midi.js');
  const messages=[[101,0],[100,2],[6,76],[100,1],[6,96],[38,0]];
  const frequency=buffer=>{const data=buffer.getChannelData(0);let crossings=0;for(let i=4801;i<19200;i++)if(data[i-1]<=0&&data[i]>0)crossings++;return crossings/.3;};
  const results=[];
  for(const instrument of ['sine','sampler','roundtrip']){
   const ctx=new OfflineAudioContext(2,24000,48000),sample=ctx.createBuffer(1,96000,48000);for(let i=0;i<sample.length;i++)sample.getChannelData(0)[i]=Math.sin(2*Math.PI*440*i/48000)*.2;
   let h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'midi',instrument:instrument==='sampler'?'sampler':'sine',sampleRoot:69,sampleAssetId:'sample'}},{op:'region.add',target:'t',values:{id:'r',duration:1}},{op:'note.add',target:'r',values:{pitch:69,start:0,duration:1,velocity:1}},...messages.map(([parameter,value])=>({op:'event.add',target:'r',values:{type:'controlChange',parameter,value,start:.05}}))]);
   if(instrument==='roundtrip'){const data=encodeMidiImport(writeMidi(h.session).buffer);h=new SessionHistory(newSession());h.execute([{op:'midi.import',values:{data}}]);h.execute([{op:'track.set',target:h.session.tracks[0].id,values:{instrument:'sine'}}]);}
   scheduleSession(ctx,h.session,new Map([['sample',sample]]),.2,{baseTime:0});results.push({instrument,frequency:frequency(await ctx.startRendering())});
  }
  const ctx=new OfflineAudioContext(2,24000,48000),monitor=createLiveMidiMonitor(ctx,{instrument:'sine'});monitor.push([0x90,69,127]);for(const [parameter,value] of messages)monitor.push([0xb0,parameter,value]);results.push({instrument:'held live note',frequency:frequency(await ctx.startRendering())});
  return results;
 });
 for(const r of results)assert.ok(Math.abs(r.frequency-440*2**(12.5/12))<5,JSON.stringify(r));console.log('PASS: rendered channel tuning in synth, sampler seek, MIDI roundtrip and held live note.',results);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
