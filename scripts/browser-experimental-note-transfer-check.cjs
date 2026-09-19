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
  if(!await page.locator('#daw-json').isVisible())await page.getByText('Command harness',{exact:true}).click();await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'target',kind:'midi',name:'Destination instrument'}},{op:'region.add',target:'target',values:{id:'destination',name:'Destination phrase',duration:1}}]));await page.getByRole('button',{name:'Execute commands',exact:true}).click();
  await page.getByText('Copy or move notes to another region',{exact:true}).click();const form=page.locator('[data-note-transfer]'),button=form.getByRole('button',{name:'Transfer notes',exact:true});assert.ok(await button.isDisabled());await form.locator('[name=scope]').selectOption('region');assert.ok(await button.isDisabled());assert.match(await page.locator('[data-transfer-preview]').textContent(),/do not fit/);await form.locator('[name=extend]').check();await form.locator('[name=position]').fill('1');const before=await read();await page.locator('.daw-note-transfer').screenshot({path:'/tmp/cuestamp-note-transfer.png'});await button.click();const copied=await read();assert.equal(copied.tracks[1].regions[0].notes.length,3);assert.equal(copied.tracks[1].regions[0].notes[0].start,.5);assert.equal(copied.tracks[1].regions[0].duration,2.5);assert.deepEqual(copied.tracks[0],before.tracks[0]);assert.notEqual(copied.tracks[1].regions[0].notes[0].id,'n0');
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).tracks,before.tracks);if(!await form.isVisible())await page.getByText('Copy or move notes to another region',{exact:true}).click();await form.locator('[name=mode]').selectOption('move');await button.click();const moved=await read();assert.equal(moved.tracks[0].regions[0].notes.length,0);assert.deepEqual(moved.tracks[1].regions[0].notes.map(n=>n.id),['n0','n1','n2']);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).tracks,before.tracks);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual((await read()).tracks,moved.tracks);
  await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).tracks,moved.tracks);assert.deepEqual(errors,[]);console.log('PASS note transfer UI, fit preview, beat-to-second placement, explicit extension, copy isolation, move identity, both-region undo/redo and reload.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
