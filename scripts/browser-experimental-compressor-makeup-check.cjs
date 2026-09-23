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
  await page.locator('[data-mix-select=t]').click();await page.locator('[data-new-effect]').selectOption('compressor');await page.locator('[data-add-effect=t]').click();const form=page.locator('[data-effect-form]');await form.locator('[name=makeupDb]').fill('6');await form.getByRole('button',{name:'Apply effect',exact:true}).click();assert.equal((await read()).tracks[0].effects[0].makeupDb,6);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await read()).tracks[0].effects[0].makeupDb,0);await page.getByRole('button',{name:'Redo',exact:true}).click();
  const rendered=await page.evaluate(async()=>{
   const {effectSchema,connectEffects}=await import('/src/experimental/effects.js');const sr=48000;
   const run=async(values={},native=false)=>{
    const ctx=new OfflineAudioContext(2,2*sr,sr),source=ctx.createBufferSource(),buffer=ctx.createBuffer(2,2*sr,sr),bindings=[];
    for(let i=0;i<buffer.length;i++){buffer.getChannelData(0)[i]=.4*Math.sin(2*Math.PI*200*i/sr);buffer.getChannelData(1)[i]=.2*Math.sin(2*Math.PI*400*i/sr);}source.buffer=buffer;
    const e=effectSchema.parse({id:'c',kind:'compressor',threshold:-24,ratio:4,knee:0,attack:.003,release:.05,...values});
    if(native){const c=ctx.createDynamicsCompressor();for(const key of ['threshold','ratio','knee','attack','release'])c[key].value=e[key];source.connect(c).connect(ctx.destination);}else connectEffects(ctx,source,[e],[],{base:0,register:(e,key,param,transform,exponential)=>bindings.push({key,exponential})}).connect(ctx.destination);
    source.start();const result=await ctx.startRendering();return {pcm:[result.getChannelData(0),result.getChannelData(1)],bindings};
   };
   const unity=await run(),native=await run({},true),plus=await run({makeupDb:6}),minus=await run({makeupDb:-12}),automated=await run({automation:[{id:'a',parameter:'makeupDb',time:0,value:-6},{id:'b',parameter:'makeupDb',time:2,value:6}]});
   let unityError=0,plusError=0,minusError=0,automationError=0;
   for(let i=0;i<2*sr;i++)for(let c=0;c<2;c++){
    const v=unity.pcm[c][i];unityError=Math.max(unityError,Math.abs(v-native.pcm[c][i]));plusError=Math.max(plusError,Math.abs(plus.pcm[c][i]-v*10**(6/20)));minusError=Math.max(minusError,Math.abs(minus.pcm[c][i]-v*10**(-12/20)));automationError=Math.max(automationError,Math.abs(automated.pcm[c][i]-v*10**((-6+6*i/sr)/20)));
   }
   return {unityError,plusError,minusError,automationError,bindings:unity.bindings};
  });
  assert.equal(rendered.unityError,0);for(const key of ['plusError','minusError','automationError'])assert.ok(rendered[key]<1e-5,JSON.stringify(rendered));assert.equal(rendered.bindings.find(b=>b.key==='makeupDb').exponential,true);
  await form.screenshot({path:'/tmp/cuestamp-compressor-makeup.png'});const saved=await read();await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).tracks,saved.tracks);assert.deepEqual(errors,[]);console.log('PASS compressor makeup controls, undo/redo, reload, exact native unity compatibility, stereo gain scaling and dB-linear automation.',rendered);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
