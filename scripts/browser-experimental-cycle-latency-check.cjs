const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();await page.route('**/__cycle-latency-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto('http://127.0.0.1:5190/__cycle-latency-test');
 const results=await page.evaluate(async()=>{const {SessionHistory}=await import('/src/experimental/session.js'),{renderCycle}=await import('/src/experimental/cycle.js');const results=[];
 for(const sampleRate of [44100,48000,96000]){
  const h=new SessionHistory();h.execute([{op:'session.set',values:{loopStart:.49,loopEnd:.75001,metronomeEnabled:true}},{op:'effect.add',target:h.session.id,values:{kind:'compressor'}}]);
  const reference=structuredClone(h.session);reference.masterEffects=[];
  const a=await renderCycle(h.session,new Map(),sampleRate,{metronome:true}),b=await renderCycle(reference,new Map(),sampleRate,{metronome:true});let error=0,energy=0;
  for(let i=0;i<a.length;i++){error=Math.max(error,Math.abs(a.getChannelData(0)[i]-b.getChannelData(0)[i]));energy+=a.getChannelData(0)[i]**2;}
  results.push({sampleRate,frames:a.length,expected:Math.round((h.session.loopEnd-h.session.loopStart)*sampleRate),error,energy});
 }
 return results;});for(const row of results){assert.equal(row.frames,row.expected);assert.ok(row.error<1e-6);assert.ok(row.energy>.001);}
 console.log(results);console.log('PASS cycle frame rounding and metronome timing survive processing latency');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
