const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});
 try{
  const page=await browser.newPage();await page.route('**/__latency-automation-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto('http://127.0.0.1:5190/__latency-automation-test');
  const results=await page.evaluate(async()=>{
   const {SessionHistory}=await import('/src/experimental/session.js'),{connectEffects}=await import('/src/experimental/effects.js'),{createProcessingLatencyPlan}=await import('/src/experimental/processing-latency.js');
   const results=[];
   for(const sampleRate of [44100,48000,96000])for(const target of ['makeup','gain'])for(const enabled of [false,true]){
    const h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'audio'}},{op:'effect.add',target:'t',values:{id:'compressor',kind:'compressor',ratio:1,threshold:0,knee:0}},{op:'effect.add',target:'t',values:{id:'gain',kind:'gain'}}]);
    const track=h.session.tracks[0],effect=track.effects[target==='makeup'?0:1],parameter=target==='makeup'?'makeupDb':'gainDb';
    effect.automation=[{id:'p0',parameter,time:0,value:0,shape:'hold'},{id:'p1',parameter,time:.2,value:-24,shape:'hold'}];
    const plan=createProcessingLatencyPlan(h.session,sampleRate),context=new OfflineAudioContext(2,Math.ceil(.35*sampleRate),sampleRate),source=context.createBufferSource(),buffer=context.createBuffer(1,Math.ceil(.3*sampleRate),sampleRate);buffer.getChannelData(0).fill(.25);source.buffer=buffer;
    connectEffects(context,source,track.effects,[],{base:0,timing:enabled?plan.tracks[0].effects:[]}).connect(context.destination);source.start(0);
    const pcm=(await context.startRendering()).getChannelData(0),before=pcm[Math.round(.19*sampleRate)],middle=pcm[Math.round(.203*sampleRate)],after=pcm[Math.round(.21*sampleRate)];
    results.push({sampleRate,target,enabled,middleRatio:middle/before,afterRatio:after/before});
   }
   return results;
  });
  for(const row of results){assert.ok(Math.abs(row.middleRatio-(row.enabled?1:10**(-24/20)))<.02,JSON.stringify(row));assert.ok(Math.abs(row.afterRatio-10**(-24/20))<.02,JSON.stringify(row));}
  console.log(results);console.log('PASS rendered compressor makeup and following gain changes remain aligned with delayed audio at all three sample rates');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
