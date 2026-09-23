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
  await page.locator('[data-mix-select=t]').click();await page.locator('[data-new-effect]').selectOption('chorus');await page.locator('[data-add-effect=t]').click();const form=page.locator('[data-effect-form]');await form.locator('[name=depthMs]').fill('6');await form.locator('[name=rate]').fill('2');await form.getByRole('button',{name:'Apply effect',exact:true}).click();assert.equal((await read()).tracks[0].effects[0].depthMs,6);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await read()).tracks[0].effects[0].depthMs,3);await page.getByRole('button',{name:'Redo',exact:true}).click();
  const rendered=await page.evaluate(async()=>{const {effectSchema,connectEffects}=await import('/src/experimental/effects.js');
   const run=async(values={},position=0,duration=1)=>{const context=new OfflineAudioContext(2,Math.round(duration*48000),48000),source=context.createBufferSource(),buffer=context.createBuffer(1,48000*3,48000);for(let i=0;i<buffer.length;i++)buffer.getChannelData(0)[i]=.2*Math.sin(2*Math.PI*220*i/48000);source.buffer=buffer;const nodes=[],effect=effectSchema.parse({id:'c',kind:'chorus',...values});connectEffects(context,source,[effect],nodes,{position,base:0}).connect(context.destination);source.start(0,position);const audio=await context.startRendering();return [Array.from(audio.getChannelData(0)),Array.from(audio.getChannelData(1))];};
   const dry=await run({mix:0}),bypass=await run({enabled:false}),fixed=await run({depthMs:0,mix:1}),wet=await run({rate:2,depthMs:3,mix:1,stereoPhase:90});let dryError=0,fixedError=0,modError=0,stereo=0;
   for(let i=5000;i<48000;i++){const t=i/48000,original=.2*Math.sin(2*Math.PI*220*t);for(let c=0;c<2;c++){dryError=Math.max(dryError,Math.abs(dry[c][i]-original),Math.abs(bypass[c][i]-original));fixedError=Math.max(fixedError,Math.abs(fixed[c][i]-.2*Math.sin(2*Math.PI*220*(t-.025))));const delay=.025+.003*Math.sin(2*Math.PI*2*t+c*Math.PI/2);modError=Math.max(modError,Math.abs(wet[c][i]-.2*Math.sin(2*Math.PI*220*(t-delay))));}stereo+=Math.abs(wet[0][i]-wet[1][i]);}
   const automation=[{id:'p0',parameter:'rate',time:0,value:1},{id:'p1',parameter:'rate',time:2,value:3},{id:'p2',parameter:'depthMs',time:0,value:2},{id:'p3',parameter:'depthMs',time:2,value:8},{id:'p4',parameter:'mix',time:0,value:.2},{id:'p5',parameter:'mix',time:2,value:.8}],full=await run({automation},0,2),seek=await run({automation},1,1);let seekError=0;for(let i=5000;i<48000;i++)for(let c=0;c<2;c++)seekError=Math.max(seekError,Math.abs(full[c][i+48000]-seek[c][i]));return {dryError,fixedError,modError,seekError,stereo};
  });assert.ok(rendered.dryError<1e-6,JSON.stringify(rendered));assert.ok(rendered.fixedError<1e-5,JSON.stringify(rendered));assert.ok(rendered.modError<.005,JSON.stringify(rendered));assert.ok(rendered.seekError<.005,JSON.stringify(rendered));assert.ok(rendered.stereo>100,JSON.stringify(rendered));
  await form.locator('[name=sync]').check();await form.locator('[name=beats]').fill('2');await form.getByRole('button',{name:'Apply effect',exact:true}).click();
  assert.equal((await read()).tracks[0].effects[0].sync,true);assert.equal((await read()).tracks[0].effects[0].beats,2);assert.equal(await page.locator('[data-effect-live][data-effect-parameter=rate]').isDisabled(),true);
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await read()).tracks[0].effects[0].sync,false);await page.getByRole('button',{name:'Redo',exact:true}).click();
  const syncResults=await page.evaluate(async()=>{
   const {effectSchema,connectEffects}=await import('/src/experimental/effects.js');const sr=48000;
   const run=async(kind,values={},position=0,duration=3)=>{
    const ctx=new OfflineAudioContext(2,Math.round(duration*sr),sr),source=ctx.createBufferSource(),buffer=ctx.createBuffer(1,3*sr,sr),bindings=[];
    for(let i=0;i<buffer.length;i++)buffer.getChannelData(0)[i]=.2*Math.sin(2*Math.PI*220*i/sr);source.buffer=buffer;
    const effect=effectSchema.parse({id:'fx',kind,...values});
    connectEffects(ctx,source,[effect],[],{position,base:0,tempo:120,tempoChanges:[{beat:2,bpm:90},{beat:3,bpm:180}],register:(e,key)=>bindings.push(key)}).connect(ctx.destination);
    source.start(0,position);const audio=await ctx.startRendering();return {pcm:[audio.getChannelData(0),audio.getChannelData(1)],bindings};
   };
   const results=[];
   for(const kind of ['chorus','phaser','tremolo']){
    const values={sync:true,beats:.5,automation:[{id:'ignored',parameter:'rate',time:0,value:7}]};
    const referenceAutomation=[{id:'a',parameter:'rate',time:0,value:4,shape:'hold'},{id:'b',parameter:'rate',time:1,value:3,shape:'hold'},{id:'c',parameter:'rate',time:5/3,value:6,shape:'hold'}];
    const full=await run(kind,values),reference=await run(kind,{automation:referenceAutomation}),seek=await run(kind,values,1.25,1.75);
    let error=0,seekError=0;
    for(let i=0;i<3*sr;i++)for(let c=0;c<2;c++)error=Math.max(error,Math.abs(full.pcm[c][i]-reference.pcm[c][i]));
    for(let i=12000;i<1.75*sr;i++)for(let c=0;c<2;c++)seekError=Math.max(seekError,Math.abs(full.pcm[c][i+1.25*sr]-seek.pcm[c][i]));
    results.push({kind,error,seekError,rateBindings:full.bindings.filter(k=>k==='rate').length});
   }return results;
  });
  for(const result of syncResults){assert.ok(result.error<1e-6,JSON.stringify(result));assert.ok(result.seekError<.005,JSON.stringify(result));assert.equal(result.rateBindings,0);}
  console.log('PASS musical timing renders for chorus, phaser and tremolo',syncResults);
  await form.screenshot({path:'/tmp/cuestamp-chorus.png'});const saved=await read();await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).tracks,saved.tracks);assert.deepEqual(errors,[]);console.log('PASS chorus mixer editing, undo/redo, reload, real PCM dry/bypass, fixed delay, analytical stereo modulation and seek continuity after delay warmup with rate/depth/mix automation.',rendered);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
