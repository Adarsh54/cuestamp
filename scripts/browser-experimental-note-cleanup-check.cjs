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
  if(!await page.locator('#daw-json').isVisible())await page.getByText('Command harness',{exact:true}).click();await page.locator('#daw-json').fill(JSON.stringify([{op:'note.add',target:'r',values:{id:'copy',pitch:60,start:0,duration:2,velocity:.7}},{op:'note.add',target:'r',values:{id:'long',pitch:60,start:0,duration:3,velocity:.2}},{op:'note.add',target:'r',values:{id:'channel',pitch:60,start:0,duration:2,channel:1}}]));await page.getByRole('button',{name:'Execute commands',exact:true}).click();
  await page.getByText('Remove duplicate notes',{exact:true}).click();const form=page.locator('[data-cleanup-form]'),preview=page.locator('[data-cleanup-preview]');assert.match(await preview.textContent(),/^2 duplicate/);await form.locator('[name=match]').selectOption('identical');assert.match(await preview.textContent(),/^1 duplicate/);await form.locator('[name=match]').selectOption('onset');await form.locator('[name=keep]').selectOption('longest');const before=await read();
  await page.locator('.daw-note-cleanup').screenshot({path:'/tmp/cuestamp-note-cleanup.png'});await form.getByRole('button',{name:'Remove duplicates',exact:true}).click();const after=await read();assert.deepEqual(after.tracks[0].regions[0].notes.map(n=>n.id),['n1','n2','long','channel']);assert.equal(after.revision,before.revision+1);assert.ok(await form.getByRole('button',{name:'Remove duplicates',exact:true}).isDisabled());await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).tracks,before.tracks);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.deepEqual((await read()).tracks,after.tracks);
  if(!await form.isVisible())await page.getByText('Remove duplicate notes',{exact:true}).click();await form.locator('[name=scope]').selectOption('selected');assert.ok(await form.getByRole('button',{name:'Remove duplicates',exact:true}).isDisabled());await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).tracks,after.tracks);assert.deepEqual(errors,[]);console.log('PASS duplicate cleanup preview, exact-performance match, longest survivor, channel isolation, one-step undo/redo, no-op disable, empty selection and reload.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
