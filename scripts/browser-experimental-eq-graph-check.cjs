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



  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose'))),effect=async()=>(await read()).tracks[0].effects[0];
  await page.locator('[data-mix-select=t]').click();await page.locator('[data-add-effect=t]').click();const form=page.locator('[data-effect-form]'),svg=page.locator('[data-eq-plot]');assert.ok((await page.locator('[data-eq-curve]').getAttribute('d')).startsWith('M'));
  await form.locator('[name=gainDb]').fill('6');assert.match(await page.locator('[data-eq-readout]').textContent(),/6.0 dB/);assert.equal((await effect()).gainDb,0);await form.getByRole('button',{name:'Apply effect',exact:true}).click();
  const drag=async(frequency,gain,commit=true)=>{await svg.scrollIntoViewIfNeeded();const box=await svg.boundingBox(),x=box.x+(42+Math.log10(frequency/20)/3*500)/556*box.width,y=box.y+(14+(24-gain)/48*180)/220*box.height;await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(x,y,{steps:4});if(!commit)await page.keyboard.press('Escape');await page.mouse.up();};
  const before=await read();await drag(2000,12);assert.ok(Math.abs((await effect()).frequency-2000)<.01);assert.ok(Math.abs((await effect()).gainDb-12)<.01);assert.equal((await read()).revision,before.revision+1);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).tracks,before.tracks);await page.getByRole('button',{name:'Redo',exact:true}).click();
  const unchanged=await read();await drag(200,-8,false);assert.deepEqual(await read(),unchanged);assert.ok(Math.abs(Number(await form.locator('[name=frequency]').inputValue())-2000)<.01);
  await svg.focus();await page.keyboard.press('ArrowUp');assert.ok(Math.abs((await effect()).gainDb-12.5)<.01);await page.keyboard.press('Shift+ArrowRight');assert.ok(Math.abs((await effect()).frequency-2000*2**(1/48))<.01);
  await form.locator('[name=type]').selectOption('lowpass');await form.getByRole('button',{name:'Apply effect',exact:true}).click();const priorGain=(await effect()).gainDb;await drag(500,20);assert.ok(Math.abs((await effect()).frequency-500)<.01);assert.equal((await effect()).gainDb,priorGain);
  // Pointer cancellation and a render-replacing undo cannot commit a late drag.
  await svg.scrollIntoViewIfNeeded();let box=await svg.boundingBox();const stable=await read();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.8,box.y+box.height*.3);await svg.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();assert.deepEqual(await read(),stable);
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.3);await page.evaluate(()=>document.querySelector('[data-action=undo]').click());const undone=await read();await page.mouse.up();assert.deepEqual(await read(),undone);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual((await read()).tracks,stable.tracks);
  const response=await page.evaluate(async()=>{const {eqResponse}=await import('/src/experimental/eq-graph.js'),{effectSchema,connectEffects}=await import('/src/experimental/effects.js');let error=0;for(const type of ['peaking','lowshelf','highshelf','lowpass','highpass']){const e=effectSchema.parse({id:'e',kind:'eq',type,frequency:1000,gainDb:6,q:1}),frequencies=new Float32Array([100,1000,6000]),predicted=eqResponse(e,48000,frequencies);for(let j=0;j<frequencies.length;j++){const ctx=new OfflineAudioContext(1,48000,48000),osc=ctx.createOscillator(),nodes=[];osc.frequency.value=frequencies[j];connectEffects(ctx,osc,[e],nodes,{base:0}).connect(ctx.destination);osc.start();const pcm=(await ctx.startRendering()).getChannelData(0);let sum=0;for(let i=24000;i<48000;i++)sum+=pcm[i]*pcm[i];const measured=20*Math.log10(Math.sqrt(sum/24000)*Math.SQRT2);error=Math.max(error,Math.abs(measured-predicted[j].db));}}const e=effectSchema.parse({id:'e',kind:'eq',enabled:false,gainDb:12});return {error,bypass:eqResponse(e,48000).every(p=>p.db===0),nyquist:eqResponse(e,8000).every(p=>p.frequency<4000&&Number.isFinite(p.db))};});assert.ok(response.error<.02,JSON.stringify(response));assert.ok(response.bypass&&response.nyquist);
  await form.locator('[name=q]').fill('0');assert.equal(await svg.getAttribute('aria-disabled'),'true');const saved=await read();await svg.focus();await page.keyboard.press('ArrowRight');assert.deepEqual(await read(),saved);await form.locator('[name=q]').fill('1');
  await page.locator('.daw-eq-graph').screenshot({path:'/tmp/cuestamp-eq-graph.png'});await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).tracks,saved.tracks);assert.deepEqual(errors,[]);console.log('PASS EQ graph preview, drag/keyboard, one-step undo/redo, Escape rollback, pass-filter gain isolation, invalid drafts, reload, and real frequency-response vs rendered PCM across all five filter types.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
