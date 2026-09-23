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
  const meter=page.locator('[data-compressor-meter]');assert.match(await meter.textContent(),/Play to measure/);
  const before=await read();await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-compressor-meter] meter')?.value>1);assert.match(await meter.textContent(),/dB gain reduction/);assert.deepEqual(await read(),before);
  await meter.screenshot({path:'/tmp/cuestamp-compressor-meter.png'});await page.getByRole('button',{name:'Stop',exact:true}).click();assert.match(await meter.textContent(),/Play to measure/);assert.equal(await meter.locator('meter').evaluate(e=>e.value),0);
  await form.locator('[name=enabled]').uncheck();await form.getByRole('button',{name:'Apply effect',exact:true}).click();assert.match(await meter.textContent(),/Bypassed/);await form.locator('[name=enabled]').check();await form.getByRole('button',{name:'Apply effect',exact:true}).click();
  await page.locator('[data-cycle-form] [name=enabled]').check();await page.locator('[data-cycle-form] [name=end]').fill('1');await page.getByRole('button',{name:'Apply cycle',exact:true}).click();await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-compressor-meter]')?.textContent.includes('Unavailable during cycle'));assert.equal(await meter.locator('meter').evaluate(e=>e.value),0);await page.getByRole('button',{name:'Stop',exact:true}).click();
  assert.deepEqual(errors,[]);console.log('PASS real-time compressor reduction, unchanged document, stop reset, bypass state and explicit unavailable cycle readout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
