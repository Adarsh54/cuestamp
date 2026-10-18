const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{
 const page=await browser.newPage();await page.route('**/__export-latency-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto('http://127.0.0.1:5190/__export-latency-test');
 const results=await page.evaluate(async()=>{
  const {SessionHistory}=await import('/src/experimental/session.js'),{renderOfflineSession}=await import('/src/experimental/offline-render.js'),{renderRealtimeWav}=await import('/src/experimental/realtime-bounce.js'),{encodeWav}=await import('/src/experimental/wav.js');
  const results=[];
  for(const sampleRate of [44100,48000,96000]){
   const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'region.add',target:'t',values:{assetId:'pulse',duration:.4}},{op:'effect.add',target:'t',values:{kind:'compressor',ratio:1,threshold:0,knee:0}},{op:'effect.add',target:h.session.id,values:{kind:'compressor',ratio:1,threshold:0,knee:0}}]);
   const buffer=new AudioBuffer({numberOfChannels:1,length:Math.ceil(.4*sampleRate),sampleRate}),start=Math.round(.1*sampleRate),frames=Math.ceil(.2*sampleRate);buffer.getChannelData(0)[start+10]=.25;buffer.getChannelData(0)[start+frames-10]=.25;const buffers=new Map([['pulse',buffer]]),snapshot=JSON.stringify(h.session);
   const rendered=await renderOfflineSession(h.session,buffers,{position:.1,duration:.2,sampleRate});const samples=rendered.getChannelData(0),peak=Math.max(...samples),peaks=[];for(let i=0;i<samples.length;i++)if(samples[i]>peak*.001)peaks.push(i);
   // Reuse returned native AudioBuffer as a source, as the region-bounce UI does.
   const context=new OfflineAudioContext(2,frames,sampleRate),source=context.createBufferSource();source.buffer=rendered;source.connect(context.destination);source.start();const replay=await context.startRendering();let error=0;for(let i=0;i<frames;i++)error=Math.max(error,Math.abs(samples[i]-replay.getChannelData(0)[i]));
   const readWav=async blob=>{const data=new DataView(await blob.arrayBuffer());let offset=12;while(offset<data.byteLength){const id=String.fromCharCode(...new Uint8Array(data.buffer,offset,4)),size=data.getUint32(offset+4,true);if(id==='data'){const values=[];for(let i=0;i<size/8;i++)values.push(data.getFloat32(offset+8+i*8,true));const peak=Math.max(...values),peaks=[];values.forEach((v,i)=>{if(v>peak*.001)peaks.push(i);});return {frames:size/8,peaks,peak};}offset+=8+size+(size%2);}throw Error('Missing WAV data');};
   const wav=await readWav(encodeWav(rendered,{bitDepth:32}));results.push({kind:'offline',sampleRate,frames:rendered.length,expectedFrames:frames,peaks,expectedPeaks:[10,frames-10],native:rendered instanceof AudioBuffer,error,wav,unchanged:snapshot===JSON.stringify(h.session)});
   if(sampleRate===48000){const parts=[],sink={async write(bytes){parts.push(bytes.slice());},async close(){},async abort(error){throw error;}};await renderRealtimeWav({zip:false,position:.1,duration:.2,entries:[{document:h.session}]},buffers,{sampleRate,bitDepth:32,dither:'none'},sink);results.push({kind:'realtime',...(await readWav(new Blob(parts))),expectedFrames:frames,expectedPeaks:[10,frames-10]});}
  }
  return results;
 });
 for(const row of results){assert.equal(row.frames,row.expectedFrames);assert.deepEqual(row.peaks,row.expectedPeaks);if(row.kind==='offline'){assert.ok(row.native&&row.unchanged);assert.equal(row.error,0);assert.deepEqual(row.wav.peaks,row.expectedPeaks);assert.equal(row.wav.frames,row.expectedFrames);}else assert.ok(row.peak>.01);}
 console.log(results);console.log('PASS compensated offline/native-buffer/encoded WAV and real-time exports preserve exact range length and first/last impulses');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
