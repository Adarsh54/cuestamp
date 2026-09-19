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
  await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'t',kind:'midi',instrument:'sine'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},...[60,64,67].map((pitch,i)=>({op:'note.add',target:'r',values:{id:'n'+i,pitch,start:i,duration:.5,velocity:.7,channel:i}}))]));
  await page.getByRole('button',{name:'Execute commands',exact:true}).click();await page.locator('[data-region=r]').click();
  await page.getByText('Velocity ramp · crescendo / decrescendo',{exact:true}).click();
  const form=page.locator('[data-velocity-ramp]'),apply=form.getByRole('button',{name:'Apply velocity ramp',exact:true}),read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose'))),values=async()=>(await read()).tracks[0].regions[0].notes.map(n=>Math.round(n.velocity*127));
  await form.locator('[name=from]').fill('20');await form.locator('[name=to]').fill('120');assert.equal(await page.locator('[data-ramp-chart] line').count(),3);await apply.click();assert.deepEqual(await values(),[20,70,120]);assert.equal(await page.locator('[data-velocity=n1]').inputValue(),'70');
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await values(),[89,89,89]);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual(await values(),[20,70,120]);
  await page.getByRole('button',{name:'Clear selection',exact:true}).click();await form.locator('[name=scope]').selectOption('selected');assert.equal(await apply.isDisabled(),true);assert.match(await page.locator('[data-ramp-preview]').textContent(),/Select notes/);
  await page.locator('[data-note=n0]').click();await page.locator('[data-note=n2]').click({modifiers:['Meta']});assert.equal(await apply.isDisabled(),true);
  await form.getByRole('button',{name:'Reverse ramp',exact:true}).click();await apply.click();assert.deepEqual(await values(),[120,70,20]);
  await form.locator('[name=scope]').selectOption('region');await form.locator('[name=curve]').selectOption('easeIn');await apply.click();assert.deepEqual(await values(),[120,95,20]);
  const audio=await page.evaluate(async()=>{const {scheduleSession}=await import('/src/experimental/audio-engine.js'),session=JSON.parse(localStorage.getItem('cuestamp-experimental:transpose')),ctx=new OfflineAudioContext(2,48000*4,48000);scheduleSession(ctx,session,new Map(),0,{baseTime:0});const data=(await ctx.startRendering()).getChannelData(0);return [0,1,2].map(t=>{let peak=0;for(let i=(t+.05)*48000;i<(t+.4)*48000;i++)peak=Math.max(peak,Math.abs(data[Math.floor(i)]));return peak;});});assert.ok(audio[0]>audio[1]&&audio[1]>audio[2]&&audio[2]>0);
  await form.locator('[name=from]').fill('128');assert.equal(await apply.isDisabled(),true);assert.match(await page.locator('[data-ramp-preview]').textContent(),/whole-number/);await form.locator('[name=from]').fill('120');
  await page.locator('.daw-velocity-ramp').scrollIntoViewIfNeeded();await page.locator('.daw-velocity-ramp').screenshot({path:'/tmp/cuestamp-velocity-ramp.png'});
  await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual(await values(),[120,95,20]);assert.deepEqual(errors,[]);console.log('PASS velocity ramp controls, chart, selection, reverse/curves, validation, lane synchronization, undo/redo and reload.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
