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
  await page.locator('[data-mix-select=t]').click();await page.locator('[data-new-effect]').selectOption('distortion');await page.locator('[data-add-effect=t]').click();const form=page.locator('[data-effect-form]');await form.locator('[name=driveDb]').fill('24');await form.getByRole('button',{name:'Apply effect',exact:true}).click();assert.equal((await read()).tracks[0].effects[0].driveDb,24);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await read()).tracks[0].effects[0].driveDb,12);await page.getByRole('button',{name:'Redo',exact:true}).click();
  const rendered=await page.evaluate(async()=>{
   const {effectSchema,connectEffects}=await import('/src/experimental/effects.js');const sr=48000;
   const run=async(values={},position=0,duration=1,tone=200)=>{
    const ctx=new OfflineAudioContext(2,Math.round(duration*sr),sr),source=ctx.createBufferSource(),buffer=ctx.createBuffer(2,3*sr,sr),bindings=[];
    for(let i=0;i<buffer.length;i++){buffer.getChannelData(0)[i]=.2*Math.sin(2*Math.PI*tone*i/sr);buffer.getChannelData(1)[i]=0;}
    source.buffer=buffer;const effect=effectSchema.parse({id:'d',kind:'distortion',...values});
    connectEffects(ctx,source,[effect],[],{position,base:0,register:(e,key,p,transform,exponential)=>bindings.push({key,exponential})}).connect(ctx.destination);
    source.start(0,position);const audio=await ctx.startRendering();return {pcm:[audio.getChannelData(0),audio.getChannelData(1)],bindings};
   };
   const rms=a=>Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length),harmonic=(a,f)=>{let re=0,im=0;for(let i=12000;i<sr;i++){re+=a[i]*Math.cos(2*Math.PI*f*i/sr);im+=a[i]*Math.sin(2*Math.PI*f*i/sr);}return 2*Math.hypot(re,im)/(sr-12000);};
   const dry=await run({mix:0}),bypass=await run({enabled:false}),low=await run({driveDb:0,outputDb:0,toneHz:20000}),high=await run({driveDb:24,outputDb:0,toneHz:20000}),quiet=await run({driveDb:24,outputDb:-12,toneHz:20000}),dark=await run({driveDb:24,outputDb:0,toneHz:200});
   let dryError=0,rightLeak=0,peak=0;for(let i=0;i<sr;i++){dryError=Math.max(dryError,Math.abs(dry.pcm[0][i]-bypass.pcm[0][i]));rightLeak=Math.max(rightLeak,Math.abs(high.pcm[1][i]));peak=Math.max(peak,Math.abs(high.pcm[0][i]));}
   const lowThird=harmonic(low.pcm[0],600),highThird=harmonic(high.pcm[0],600),toneRatio=harmonic(dark.pcm[0],600)/highThird,outputRatio=rms(quiet.pcm[0].slice(12000))/rms(high.pcm[0].slice(12000));
   const automation=[{id:'a',parameter:'driveDb',time:0,value:0},{id:'b',parameter:'driveDb',time:2,value:24},{id:'c',parameter:'toneHz',time:0,value:1000},{id:'d',parameter:'toneHz',time:2,value:10000},{id:'e',parameter:'outputDb',time:0,value:-6},{id:'f',parameter:'outputDb',time:2,value:-18},{id:'g',parameter:'mix',time:0,value:.2},{id:'h',parameter:'mix',time:2,value:.8}];
   const full=await run({automation},0,2),seek=await run({automation},1,1);let seekError=0;for(let i=12000;i<sr;i++)seekError=Math.max(seekError,Math.abs(full.pcm[0][i+sr]-seek.pcm[0][i]));
   return {dryError,rightLeak,peak,lowThird,highThird,toneRatio,outputRatio,seekError,bindings:high.bindings};
  });
  assert.equal(rendered.dryError,0);assert.equal(rendered.rightLeak,0);assert.ok(rendered.peak<1.05,JSON.stringify(rendered));assert.ok(rendered.highThird>rendered.lowThird*20,JSON.stringify(rendered));assert.ok(rendered.toneRatio<.15,JSON.stringify(rendered));assert.ok(Math.abs(rendered.outputRatio-10**(-12/20))<1e-5,JSON.stringify(rendered));assert.ok(rendered.seekError<.001,JSON.stringify(rendered));
  for(const key of ['driveDb','outputDb'])assert.equal(rendered.bindings.find(b=>b.key===key).exponential,true);
  await form.screenshot({path:'/tmp/cuestamp-distortion.png'});const saved=await read();await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).tracks,saved.tracks);assert.deepEqual(errors,[]);
  console.log('PASS distortion controls, undo/redo, reload, real PCM bypass/dry, odd harmonics, tone filtering, output gain, stereo isolation, automation seek and live gain bindings.',rendered);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
