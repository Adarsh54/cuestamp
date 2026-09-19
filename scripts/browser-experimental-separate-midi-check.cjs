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
  await page.getByText('Separate MIDI into tracks',{exact:true}).click();
  const form=page.locator('[data-separate-midi]'),read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose'))),before=await read();
  assert.match(await page.locator('[data-separate-preview]').textContent(),/3 new tracks/);await page.locator('.daw-separate-midi').screenshot({path:'/tmp/cuestamp-separate-midi.png'});await form.getByRole('button',{name:'Separate MIDI',exact:true}).click();let after=await read();assert.equal(after.tracks.length,4);assert.equal(after.tracks[0].regions[0].mute,true);assert.deepEqual(after.tracks.slice(1).map(t=>t.regions[0].notes[0].pitch),[60,64,67]);
  const difference=await page.evaluate(async({before,after})=>{const {scheduleSession}=await import('/src/experimental/audio-engine.js');const render=async s=>{const ctx=new OfflineAudioContext(2,48000*4,48000);scheduleSession(ctx,s,new Map(),0,{baseTime:0});return (await ctx.startRendering()).getChannelData(0);};const a=await render(before),b=await render(after);let max=0,peak=0;for(let i=0;i<a.length;i++){max=Math.max(max,Math.abs(a[i]-b[i]));peak=Math.max(peak,Math.abs(a[i]));}return {max,peak};},{before,after});assert.ok(difference.peak>.01);assert.ok(difference.max<1e-6);
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).tracks,before.tracks);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal((await read()).tracks.length,4);await page.getByRole('button',{name:'Undo',exact:true}).click();
  await form.locator('[name=by]').selectOption('channel');assert.match(await page.locator('[data-separate-preview]').textContent(),/Channel 1, Channel 2, Channel 3/);await form.getByRole('button',{name:'Separate MIDI',exact:true}).click();assert.deepEqual((await read()).tracks.slice(1).map(t=>t.regions[0].notes[0].channel),[0,1,2]);
  await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.equal((await read()).tracks.length,4);assert.equal((await read()).tracks[0].regions[0].mute,true);assert.deepEqual(errors,[]);console.log('PASS pitch/channel separation UI, independent tracks, preserved linear playback, one-step undo/redo and reload.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
