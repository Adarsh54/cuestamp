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




  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose'))),pitches=s=>s.tracks[0].regions[0].notes.map(n=>n.pitch);
  await page.getByText('Invert note pitches',{exact:true}).click();const form=page.locator('[data-invert-form]');assert.match(await page.locator('[data-invert-preview]').textContent(),/2 of 3/);const before=await read();
  await form.getByRole('button',{name:'Invert pitches',exact:true}).click();assert.deepEqual(pitches(await read()),[60,56,53]);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).tracks,before.tracks);
  if(!await form.isVisible())await page.getByText('Invert note pitches',{exact:true}).click();await form.getByRole('button',{name:'Use pitch-range center',exact:true}).click();assert.equal(await form.locator('[name=pivot]').inputValue(),'63.5');await form.getByRole('button',{name:'Invert pitches',exact:true}).click();assert.deepEqual(pitches(await read()),[67,63,60]);
  if(!await form.isVisible())await page.getByText('Invert note pitches',{exact:true}).click();await form.locator('[name=pivot]').fill('0');assert.ok(await form.getByRole('button',{name:'Invert pitches',exact:true}).isDisabled());assert.match(await page.locator('[data-invert-preview]').textContent(),/within MIDI/);
  await form.locator('[name=pivot]').fill('60');await form.locator('[name=scope]').selectOption('selected');assert.ok(await form.getByRole('button',{name:'Invert pitches',exact:true}).isDisabled());
  await form.locator('[name=scope]').selectOption('region');await page.locator('.daw-invert-tools').screenshot({path:'/tmp/cuestamp-note-invert.png'});const saved=await read();await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).tracks,saved.tracks);assert.deepEqual(errors,[]);console.log('PASS pitch inversion UI, pivot preview, range center, invalid bounds, empty selection, undo and reload.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
