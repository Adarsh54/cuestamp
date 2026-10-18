const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();await page.route('**/__session-latency-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto('http://127.0.0.1:5190/__session-latency-test');
 const results=await page.evaluate(async()=>{
  const {SessionHistory}=await import('/src/experimental/session.js'),{scheduleSession}=await import('/src/experimental/audio-engine.js'),{prepareSessionEffects}=await import('/src/experimental/noise-gate.js');
  const results=[];
  for(const sampleRate of [44100,48000,96000])for(const compensated of [false,true]){
   const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'wet',kind:'audio'}},{op:'track.add',values:{id:'dry',kind:'audio'}},{op:'track.add',values:{id:'a',kind:'bus'}},{op:'track.add',values:{id:'b',kind:'bus'}},{op:'effect.add',target:'wet',values:{kind:'compressor',ratio:1,threshold:0,knee:0}},{op:'effect.add',target:'a',values:{kind:'compressor',ratio:1,threshold:0,knee:0}},{op:'effect.add',target:h.session.id,values:{kind:'compressor',ratio:1,threshold:0,knee:0}},{op:'track.set',target:'wet',values:{output:'a'}},{op:'send.set',target:'wet',values:{busId:'b',gainDb:0}},{op:'region.add',target:'wet',values:{assetId:'pulse',start:.1,duration:.05}},{op:'region.add',target:'dry',values:{assetId:'pulse',start:.1,duration:.05}}]);
   const context=new OfflineAudioContext(2,Math.ceil(sampleRate*.3),sampleRate),buffer=context.createBuffer(1,Math.ceil(sampleRate*.1),sampleRate);buffer.getChannelData(0)[10]=.25;
   const before=JSON.stringify(h.session),graph=scheduleSession(context,h.session,new Map([['pulse',buffer]]),0,{baseTime:0,compensateLatency:compensated}),pcm=(await context.startRendering()).getChannelData(0),peak=Math.max(...pcm),peaks=[];for(let i=0;i<pcm.length;i++)if(pcm[i]>peak*.001)peaks.push(i);graph.stop();results.push({kind:'routes',sampleRate,compensated,peaks,expected:Math.round(.1*sampleRate)+10+3*Math.floor(.006*sampleRate),frames:graph.latencyFrames,outputBase:graph.outputBase,unchanged:before===JSON.stringify(h.session)});
  }
  // Short detector pulse must open a gate when the corresponding compressed
  // program arrives, rather than having closed before the program gets there.
  for(const compensated of [false,true]){
   const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'program',kind:'audio'}},{op:'track.add',values:{id:'detector',kind:'audio'}},{op:'track.set',target:'detector',values:{mute:true}},{op:'region.add',target:'program',values:{assetId:'pulse',start:.1,duration:.05}},{op:'region.add',target:'detector',values:{assetId:'pulse',start:.1,duration:.05}},{op:'effect.add',target:'program',values:{kind:'compressor',ratio:1,threshold:0,knee:0}},{op:'effect.add',target:'program',values:{kind:'gate',sidechainTrackId:'detector',threshold:-13,hysteresis:0,attack:0,hold:0,release:.001,reductionDb:-96}}]);
   const context=new OfflineAudioContext(2,14400,48000),buffer=context.createBuffer(1,4800,48000);buffer.getChannelData(0).fill(.25,10,34);await prepareSessionEffects(context,h.session);const graph=scheduleSession(context,h.session,new Map([['pulse',buffer]]),0,{baseTime:0,compensateLatency:compensated});const pcm=(await context.startRendering()).getChannelData(0);graph.stop();results.push({kind:'sidechain',compensated,peak:Math.max(...pcm)});
  }
  for(const sampleRate of [44100,48000,96000]){
   const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'region.add',target:'t',values:{assetId:'pulse',duration:.3}},{op:'effect.add',target:h.session.id,values:{kind:'compressor',ratio:1,threshold:0,knee:0}}]);
   const context=new OfflineAudioContext(2,Math.ceil(.4*sampleRate),sampleRate),buffer=context.createBuffer(1,Math.ceil(.3*sampleRate),sampleRate),early=Math.round(.199*sampleRate),late=Math.round(.201*sampleRate);buffer.getChannelData(0)[early]=.25;buffer.getChannelData(0)[late]=.25;
   const graph=scheduleSession(context,h.session,new Map([['pulse',buffer]]),.1,{baseTime:.05,endPosition:.2,compensateLatency:true}),pcm=(await context.startRendering()).getChannelData(0),peak=Math.max(...pcm),peaks=[];for(let i=0;i<pcm.length;i++)if(pcm[i]>peak*.001)peaks.push(i);graph.stop();results.push({kind:'boundary',sampleRate,peaks,expected:early-Math.round(.05*sampleRate)+Math.floor(.006*sampleRate)});
  }
  return results;
 });
 for(const row of results.filter(r=>r.kind==='routes')){assert.ok(row.unchanged);if(row.compensated){assert.deepEqual(row.peaks,[row.expected]);assert.equal(row.frames,3*Math.floor(.006*row.sampleRate));assert.equal(row.outputBase,row.frames/row.sampleRate);}else{assert.equal(row.peaks.length,3);assert.equal(row.frames,0);}}
 for(const row of results.filter(r=>r.kind==='boundary'))assert.deepEqual(row.peaks,[row.expected]);
 const gates=results.filter(r=>r.kind==='sidechain');assert.ok(gates[1].peak>gates[0].peak*10,JSON.stringify(gates));assert.ok(gates[1].peak>.01);console.log(results);console.log('PASS session graph aligns buses/sends/master and muted-source gate detector without session edits');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
