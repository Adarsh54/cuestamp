const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true,args:['--disable-audio-output']});try{
 const page=await browser.newPage();await page.route('**/api/**',r=>r.fulfill({json:{configured:false,user:null,projects:[]}}));await page.goto(process.env.CUESTAMP_URL||'http://127.0.0.1:5190/');
 const result=await page.evaluate(async()=>{
  const {effectSchema,effectTail,connectEffects}=await import('/src/experimental/effects.js');let maxEnd=0,retainedPeak=0,cases=0;
  for(const sr of [44100,48000,96000])for(const type of ['notch','bandpass','lowpass','highpass','peaking','lowshelf','highshelf'])for(const q of [.1,20])for(const frequency of [20,1000,20000])for(const gainDb of [-24,24]){
   const e=effectSchema.parse({id:'e',kind:'eq',type,frequency,q,gainDb}),tail=effectTail([e]),start=Math.round(.02*sr),ctx=new OfflineAudioContext(1,Math.ceil((.02+tail)*sr),sr),buffer=ctx.createBuffer(1,start,sr);buffer.getChannelData(0)[start-1]=1;
   const source=ctx.createBufferSource();source.buffer=buffer;connectEffects(ctx,source,[e],[],{base:0}).connect(ctx.destination);source.start();const pcm=(await ctx.startRendering()).getChannelData(0);
   for(let i=start;i<Math.min(pcm.length,start+Math.round(.01*sr));i++)retainedPeak=Math.max(retainedPeak,Math.abs(pcm[i]));
   for(let i=Math.max(start,pcm.length-Math.max(1,Math.floor(Math.min(.01,tail*.01)*sr)));i<pcm.length;i++)maxEnd=Math.max(maxEnd,Math.abs(pcm[i]));cases++;
  }return {cases,maxEnd,retainedPeak};
 });assert.equal(result.cases,252);assert.ok(result.maxEnd<1e-6,JSON.stringify(result));assert.ok(result.retainedPeak>.001,JSON.stringify(result));console.log('PASS real native EQ ring-down retained and decayed across seven types, Q/frequency/gain extremes and three export sample rates.',result);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
