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

  await page.getByText('Arpeggiate chords',{exact:true}).click();
  const form=page.locator('[data-arpeggio-form]'),apply=form.getByRole('button',{name:'Apply arpeggio',exact:true}),read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose')));
  assert.equal(await apply.isDisabled(),true);await form.locator('[name=scope]').selectOption('region');await form.locator('[name=rate]').selectOption('0.5');assert.match(await page.locator('[data-arpeggio-preview]').textContent(),/Replace 3 notes with 8/);assert.equal(await page.locator('[data-arpeggio-chart] rect').count(),8);
  await page.locator('.daw-arpeggio').screenshot({path:'/tmp/cuestamp-arpeggio.png'});const original=await read();await apply.click();let current=await read();assert.deepEqual(current.tracks[0].regions[0].notes.map(n=>n.pitch),[60,64,67,60,64,67,60,64]);
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).tracks,original.tracks);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual((await read()).tracks,current.tracks);
  // Render the generated MIDI through the real engine: eight distinct gated notes.
  const peaks=await page.evaluate(async()=>{const {scheduleSession}=await import('/src/experimental/audio-engine.js'),s=JSON.parse(localStorage.getItem('cuestamp-experimental:transpose')),ctx=new OfflineAudioContext(2,48000*4,48000);scheduleSession(ctx,s,new Map(),0,{baseTime:0});const data=(await ctx.startRendering()).getChannelData(0);const peak=(start,end)=>{let result=0;for(let i=Math.floor(start*48000);i<end*48000;i++)result=Math.max(result,Math.abs(data[i]));return result;};return Array.from({length:8},(_,i)=>({on:peak(i*.25+.05,i*.25+.1),off:peak(i*.25+.235,i*.25+.249)}));});assert.ok(peaks.every(p=>p.on>.01&&p.off<.0001));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await page.locator('[data-note=n0]').click();await page.locator('[data-note=n1]').click({modifiers:['Meta']});await form.locator('[name=scope]').selectOption('selected');await form.locator('[name=order]').selectOption('down');await form.locator('[name=octaves]').fill('2');await form.locator('[name=gate]').fill('50');await apply.click();current=await read();assert.deepEqual(current.tracks[0].regions[0].notes[0],original.tracks[0].regions[0].notes[2]);assert.deepEqual(current.tracks[0].regions[0].notes.slice(1,5).map(n=>n.pitch),[76,72,64,60]);assert.ok(current.tracks[0].regions[0].notes.slice(1).every(n=>n.duration===.125));
  await form.locator('[name=scope]').selectOption('region');await form.locator('[name=octaves]').fill('5');assert.equal(await apply.isDisabled(),true);assert.deepEqual(await read(),current);
  await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).tracks,current.tracks);assert.deepEqual(errors,[]);console.log('PASS arpeggio controls, chart, selection, order/octaves/gate, real gated PCM, validation, undo/redo and reload.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
