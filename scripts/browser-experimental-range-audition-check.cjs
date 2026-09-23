const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});
 try{
  const page=await browser.newPage();await page.goto(process.env.CUESTAMP_URL||'http://127.0.0.1:5190/');
  const result=await page.evaluate(async()=>{
   const {newSession,applyCommands}=await import('/src/experimental/session.js');
   const {audioRangeAudition}=await import('/src/experimental/audio-range-audition.js');
   const {scheduleSession}=await import('/src/experimental/audio-engine.js');
   const session=applyCommands(newSession(),[
    {op:'session.set',values:{masterDb:0}},
    {op:'track.add',values:{id:'bus',kind:'bus'}},
    {op:'effect.add',target:'bus',values:{kind:'gain',gainDb:-6}},
    {op:'track.add',values:{id:'t'}},
    {op:'track.set',target:'t',values:{output:'bus'}},
    {op:'region.add',target:'t',values:{id:'clip',assetId:'one',duration:2}},
    {op:'region.set',target:'clip',values:{reverse:true,fadeIn:.5}},
    {op:'region.add',target:'t',values:{id:'other',assetId:'missing',duration:2}}
   ]),before=JSON.stringify(session),plan=audioRangeAudition(session,{regionId:'clip',start:.25,end:.75});
   async function render(gated){
    const ctx=new OfflineAudioContext(2,48000,48000),buffer=ctx.createBuffer(2,96000,48000);
    for(let channel=0;channel<2;channel++){const data=buffer.getChannelData(channel);for(let i=0;i<data.length;i++)data[i]=i<48000?.1:.4;}
    scheduleSession(ctx,plan.document,new Map([['one',buffer]]),plan.position,{baseTime:0,...(gated?{endPosition:plan.end}:{})});
    return Array.from((await ctx.startRendering()).getChannelData(0));
   }
   const gated=await render(true),reference=await render(false);
   return {unchanged:before===JSON.stringify(session),error:Math.max(...gated.slice(0,24000).map((v,i)=>Math.abs(v-reference[i]))),tailPeak:Math.max(...gated.slice(24000).map(Math.abs)),sample:gated[18000],referenceTail:reference[36000]};
  });
  assert.equal(result.unchanged,true);assert.equal(result.error,0);assert.equal(result.tailPeak,0);assert.ok(Math.abs(result.sample-.4*10**(-6/20))<1e-6,JSON.stringify(result));assert.ok(result.referenceTail>0);
  console.log('PASS: native audio range gate, reverse source, bus gain, intact fades and unchanged project.',result);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
