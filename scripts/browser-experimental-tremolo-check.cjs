const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true,args:['--disable-audio-output']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'transpose',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
  await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));
  await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));
  await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
  await page.getByText('Session restored on this device.',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('[data-audio-input-refresh]')?.disabled);await page.evaluate(()=>document.fonts.ready);
  await page.getByText('Command harness',{exact:true}).click();
  await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'t',kind:'midi',instrument:'sine'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},...[60,64,67].map((pitch,i)=>({op:'note.add',target:'r',values:{id:'n'+i,pitch,start:0,duration:2,velocity:.7,channel:0}}))]));
  await page.getByRole('button',{name:'Execute commands',exact:true}).click();await page.locator('[data-region=r]').click();


  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose')));
  await page.locator('[data-mix-select=t]').click();await page.locator('[data-new-effect]').selectOption('tremolo');await page.locator('[data-add-effect=t]').click();const form=page.locator('[data-effect-form]');await form.locator('[name=depth]').fill('1');await form.locator('[name=sync]').check();await form.locator('[name=beats]').fill('1');await form.locator('[name=stereoPhase]').fill('180');await form.getByRole('button',{name:'Apply effect',exact:true}).click();assert.equal((await read()).tracks[0].effects[0].sync,true);assert.equal((await read()).tracks[0].effects[0].stereoPhase,180);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await read()).tracks[0].effects[0].sync,false);await page.getByRole('button',{name:'Redo',exact:true}).click();
  const result=await page.evaluate(async()=>{
   const {connectEffects,effectSchema}=await import('/src/experimental/effects.js'),{scheduleSession}=await import('/src/experimental/audio-engine.js'),{SessionHistory}=await import('/src/experimental/session.js');
   const render=async(values,position=0,duration=2,tempo=120)=>{const context=new OfflineAudioContext(2,Math.round(48000*duration),48000),source=context.createConstantSource(),nodes=[];source.offset.value=1;connectEffects(context,source,[effectSchema.parse({id:'fx',kind:'tremolo',...values})],nodes,{position,base:0,tempo}).connect(context.destination);source.start();const audio=await context.startRendering();return [audio.getChannelData(0),audio.getChannelData(1)];};
   const check=(data,fn)=>{let error=0;for(let c=0;c<2;c++)for(let i=0;i<data[c].length;i++)error=Math.max(error,Math.abs(data[c][i]-fn(i/48000,c)));return error;};
   const stereo=await render({rate:2,depth:1,stereoPhase:180}),stereoError=check(stereo,(t,c)=>.5+.5*Math.cos(4*Math.PI*t+c*Math.PI));
   const bypassError=check(await render({enabled:false}),(t,c)=>1),zeroError=check(await render({depth:0}),(t,c)=>1);
   const synced=await render({rate:7,sync:true,beats:.5,depth:1},0,2,90),syncError=check(synced,t=>.5+.5*Math.cos(6*Math.PI*t));
   const automation=[{id:'a',parameter:'rate',time:0,value:1},{id:'b',parameter:'rate',time:2,value:3},{id:'c',parameter:'depth',time:0,value:.2},{id:'d',parameter:'depth',time:2,value:1}],full=await render({automation}),seek=await render({automation},.75,1);
   let seekError=0;for(let c=0;c<2;c++)for(let i=0;i<seek[c].length;i++)seekError=Math.max(seekError,Math.abs(full[c][i+36000]-seek[c][i]));
   const placementErrors=[];
   for(const target of ['t','b','master']){const h=new SessionHistory();h.execute([{op:'session.set',values:{tempo:90}},{op:'track.add',values:{id:'b',kind:'bus'}},{op:'track.add',values:{id:'t',kind:'audio'}},{op:'track.set',target:'t',values:{output:'b'}},{op:'region.add',target:'t',values:{assetId:'constant',duration:2}},{op:'effect.add',target:target==='master'?h.session.id:target,values:{kind:'tremolo',sync:true,beats:.5,depth:1}}]);const ctx=new OfflineAudioContext(2,96000,48000),buffer=ctx.createBuffer(2,96000,48000);buffer.getChannelData(0).fill(1);buffer.getChannelData(1).fill(1);const handle=scheduleSession(ctx,h.session,new Map([['constant',buffer]]),0,{baseTime:0}),audio=await ctx.startRendering();placementErrors.push(check([audio.getChannelData(0),audio.getChannelData(1)],t=>.5+.5*Math.cos(6*Math.PI*t)));handle.stop();}
   return {stereoError,bypassError,zeroError,syncError,seekError,placementErrors};
  });assert.ok(Object.values(result).flat().every(n=>n<.0002),JSON.stringify(result));console.log(result);
  await form.screenshot({path:'/tmp/cuestamp-tremolo.png'});const before=await read();await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).tracks,before.tracks);assert.deepEqual(errors,[]);console.log('PASS tremolo UI, undo/redo/reload, stereo phase/depth, bypass, tempo sync, rate/depth automation seek continuity, track/bus/master render and node cleanup.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
