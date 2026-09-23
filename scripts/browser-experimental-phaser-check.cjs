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
  await page.locator('[data-mix-select=t]').click();await page.locator('[data-new-effect]').selectOption('phaser');await page.locator('[data-add-effect=t]').click();const form=page.locator('[data-effect-form]');await form.locator('[name=depthCents]').fill('600');await form.locator('[name=rate]').fill('2');await form.getByRole('button',{name:'Apply effect',exact:true}).click();assert.equal((await read()).tracks[0].effects[0].depthCents,600);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await read()).tracks[0].effects[0].depthCents,1200);await page.getByRole('button',{name:'Redo',exact:true}).click();
  const rendered=await page.evaluate(async()=>{
   const {effectSchema,connectEffects}=await import('/src/experimental/effects.js');
   const sr=48000;
   const run=async(values={},position=0,duration=1,tone=220)=>{
    const context=new OfflineAudioContext(2,Math.round(duration*sr),sr),source=context.createBufferSource(),buffer=context.createBuffer(1,sr*4,sr);
    for(let i=0;i<buffer.length;i++)buffer.getChannelData(0)[i]=.2*Math.sin(2*Math.PI*tone*i/sr);
    source.buffer=buffer;const nodes=[],bindings=[],effect=effectSchema.parse({id:'p',kind:'phaser',...values});
    connectEffects(context,source,[effect],nodes,{position,base:0,register:(e,key)=>bindings.push(key)}).connect(context.destination);
    source.start(0,position);const audio=await context.startRendering();return {pcm:[audio.getChannelData(0),audio.getChannelData(1)],bindings};
   };
   const rms=a=>Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length);
   const dry=await run({mix:0}),bypass=await run({enabled:false}),wet=await run({depthCents:0,mix:1});
   let dryError=0;for(let i=0;i<sr;i++)for(let c=0;c<2;c++)dryError=Math.max(dryError,Math.abs(dry.pcm[c][i]-bypass.pcm[c][i]));
   // Analytic notch: four all-pass stages each shift this tone by -pi/4.
   const a=Math.SQRT1_2*Math.tan(Math.PI/8),x=(Math.sqrt(1+4*a*a)-1)/(2*a),notchHz=sr/Math.PI*Math.atan(x*Math.tan(Math.PI*1000/sr));
   const notch=await run({depthCents:0,mix:.5},0,1,notchHz),notchRatio=rms(notch.pcm[0].slice(12000))/(.2/Math.sqrt(2));
   const wetRatio=rms(wet.pcm[0].slice(12000))/(.2/Math.sqrt(2));
   const moving=await run({rate:2,depthCents:1200,mix:.5,stereoPhase:90});let stereo=0;
   for(let i=12000;i<sr;i++)stereo+=Math.abs(moving.pcm[0][i]-moving.pcm[1][i]);
   const automation=[{id:'p0',parameter:'rate',time:0,value:1},{id:'p1',parameter:'rate',time:2,value:3},{id:'p2',parameter:'depthCents',time:0,value:200},{id:'p3',parameter:'depthCents',time:2,value:1400},{id:'p4',parameter:'mix',time:0,value:.2},{id:'p5',parameter:'mix',time:2,value:.8},{id:'p6',parameter:'frequency',time:0,value:500},{id:'p7',parameter:'frequency',time:2,value:1500}];
   const full=await run({automation},0,2),seek=await run({automation},1,1);let seekError=0;
   for(let i=12000;i<sr;i++)for(let c=0;c<2;c++)seekError=Math.max(seekError,Math.abs(full.pcm[c][i+sr]-seek.pcm[c][i]));
   return {dryError,wetRatio,notchRatio,stereo,seekError,bindings:dry.bindings};
  });
  assert.ok(rendered.dryError<1e-6,JSON.stringify(rendered));assert.ok(Math.abs(rendered.wetRatio-1)<.005,JSON.stringify(rendered));assert.ok(rendered.notchRatio<.001,JSON.stringify(rendered));assert.ok(rendered.stereo>100,JSON.stringify(rendered));assert.ok(rendered.seekError<.005,JSON.stringify(rendered));
  for(const [key,count]of Object.entries({rate:2,frequency:8,depthCents:2,mix:4}))assert.equal(rendered.bindings.filter(k=>k===key).length,count);
  await form.screenshot({path:'/tmp/cuestamp-phaser.png'});const saved=await read();await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).tracks,saved.tracks);assert.deepEqual(errors,[]);console.log('PASS phaser mixer editing, undo/redo, reload, real PCM dry/bypass, all-pass energy, analytical notch, stereo sweep, live bindings and seek continuity after filter warmup with automation.',rendered);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
