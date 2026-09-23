const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true,args:['--disable-audio-output']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'transpose',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
  await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));
  await page.route('**/api/daw',r=>{if(r.request().method()==='GET')return r.fulfill({json:{configured:true}});const body=r.request().postDataJSON();requests.push(body);return r.fulfill({json:{revision:body.session.revision,commands:[],summary:'Compression reading received.'}});});
  await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
  await page.getByText('Session restored on this device.',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('[data-audio-input-refresh]')?.disabled);await page.evaluate(()=>document.fonts.ready);
  await page.getByText('Command harness',{exact:true}).click();
  await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'t',name:'Lead',kind:'midi',instrument:'sine'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},...[60,64,67].map((pitch,i)=>({op:'note.add',target:'r',values:{id:'n'+i,pitch,start:0,duration:2,velocity:.7,channel:0}}))]));
  await page.getByRole('button',{name:'Execute commands',exact:true}).click();await page.locator('[data-region=r]').click();




  await page.locator('#daw-json').evaluate(e=>e.closest('details').open=true);
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose')));
  await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'other',name:'Other instrument',kind:'midi'}},{op:'region.add',target:'other',values:{id:'other-region',duration:4}}]));
  await page.getByRole('button',{name:'Execute commands',exact:true}).click();
  await page.locator('[data-region=r]').click();await page.locator('[data-region=other-region]').click({modifiers:['Control']});
  await page.getByText('2 regions selected',{exact:true}).waitFor();

  await page.locator('[data-ruler-mode]').selectOption('seconds');await page.getByRole('textbox',{name:'Go to position',exact:true}).fill('10');await page.getByRole('button',{name:'Go to position',exact:true}).click();
  const before=await read();await page.getByRole('button',{name:'Align starts to playhead',exact:true}).click();assert.deepEqual((await read()).tracks.map(t=>t.regions[0].start),[10,10]);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).tracks,before.tracks);
  await page.getByRole('button',{name:'Align ends to playhead',exact:true}).click();assert.deepEqual((await read()).tracks.map(t=>t.regions[0].start),[6,6]);
  const aligned=await read();await page.getByRole('textbox',{name:'Go to position',exact:true}).fill('1');await page.getByRole('button',{name:'Go to position',exact:true}).click();await page.getByRole('button',{name:'Align ends to playhead',exact:true}).click();await page.getByText('Aligning region ends here would place a region before the project start.',{exact:true}).waitFor();assert.deepEqual(await read(),aligned);
  assert.deepEqual(errors,[]);console.log('PASS multi-track start/end alignment at playhead, undo, and atomic invalid-end feedback.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
