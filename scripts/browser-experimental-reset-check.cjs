const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();await page.goto(process.env.CUESTAMP_URL||'http://127.0.0.1:5190/');const results=await page.evaluate(async()=>{
 const {newSession,SessionHistory}=await import('/src/experimental/session.js'),{scheduleSession}=await import('/src/experimental/audio-engine.js');
 const rms=(b,a,z)=>{const d=b.getChannelData(0);let sum=0;for(let i=Math.round(a*48000);i<Math.round(z*48000);i++)sum+=d[i]**2;return Math.sqrt(sum/((z-a)*48000));},results=[];
 for(const mode of ['sustain','expression']){
  const h=new SessionHistory(newSession());h.execute([{op:'track.add',values:{id:'t',kind:'midi',instrument:'sine'}},{op:'region.add',target:'t',values:{id:'r',duration:1}},{op:'note.add',target:'r',values:{pitch:69,start:0,duration:mode==='sustain'?.1:1,velocity:1}},{op:'event.add',target:'r',values:{type:'controlChange',parameter:mode==='sustain'?64:11,value:mode==='sustain'?127:0,start:0}},{op:'event.add',target:'r',values:{type:'controlChange',parameter:121,value:0,start:.3}}]);
  const ctx=new OfflineAudioContext(2,48000,48000);scheduleSession(ctx,h.session,new Map(),0,{baseTime:0});const b=await ctx.startRendering();results.push({mode,before:rms(b,.15,.25),after:rms(b,.5,.6)});
 }return results;});
 const sustain=results.find(r=>r.mode==='sustain'),expression=results.find(r=>r.mode==='expression');assert.ok(sustain.before>.001&&sustain.after<1e-7,JSON.stringify(sustain));assert.ok(expression.before<1e-7&&expression.after>.001,JSON.stringify(expression));console.log('PASS: native rendered sustain release and expression reset.',results);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
