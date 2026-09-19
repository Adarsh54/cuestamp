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
  await page.getByRole('button',{name:'Select all notes',exact:true}).click();const before=await read();await page.getByRole('button',{name:'Mute selected',exact:true}).click();assert.ok((await read()).tracks[0].regions[0].notes.every(n=>n.mute));assert.equal(await page.locator('[data-note-muted=true]').count(),3);
  await page.getByRole('button',{name:'Clear selection',exact:true}).click();await page.getByRole('button',{name:'Select muted notes',exact:true}).click();assert.equal(await page.locator('[data-note][aria-pressed=true]').count(),3);await page.getByRole('button',{name:'Unmute selected',exact:true}).click();assert.deepEqual((await read()).tracks,before.tracks);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await page.locator('[data-note-muted=true]').count(),3);
  const render=await page.evaluate(async()=>{const {newSession,applyCommands}=await import('/src/experimental/session.js'),{scheduleSession}=await import('/src/experimental/audio-engine.js');const results=[];for(const instrument of ['sine','sampler','drumKit']){const s=applyCommands(newSession(),[{op:'track.add',values:{id:'t',kind:'midi',instrument,sampleAssetId:'sample'}},{op:'region.add',target:'t',values:{id:'r',duration:1}},{op:'note.add',target:'r',values:{id:'n',pitch:60,start:0,duration:.5}}]);const run=async mute=>{const context=new OfflineAudioContext(2,48000,48000),buffer=context.createBuffer(1,48000,48000);for(let i=0;i<48000;i++)buffer.getChannelData(0)[i]=.2*Math.sin(2*Math.PI*440*i/48000);const document=applyCommands(s,[{op:'notes.mute',target:'r',values:{mute}}]);scheduleSession(context,document,new Map(mute?[]:[['sample',buffer]]),0,{baseTime:0});const audio=await context.startRendering();let peak=0;for(const sample of audio.getChannelData(0))peak=Math.max(peak,Math.abs(sample));return peak;};results.push({instrument,on:await run(false),off:await run(true)});}return results;});for(const r of render){assert.ok(r.on>.001,JSON.stringify(r));assert.equal(r.off,0,JSON.stringify(r));}
  await page.locator('[data-note=n0]').scrollIntoViewIfNeeded();await page.locator('.daw-note-scroll').screenshot({path:'/tmp/cuestamp-note-mute.png'});const saved=await read();await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).tracks,saved.tracks);assert.deepEqual(errors,[]);console.log('PASS MIDI note mute/unmute/select-muted UI, undo, reload and exact PCM silence for synth, sampler and drums; muted sampler needs no decoded asset.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
