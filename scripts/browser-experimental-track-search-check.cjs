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
  await page.locator('#daw-track-search').fill('Lead');assert.equal(await page.locator('[data-region=r]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-region-group-move]').count(),0);
  await page.getByRole('button',{name:'Clear search',exact:true}).click();assert.equal(await page.locator('[data-region=other-region]').getAttribute('aria-pressed'),'false');
  const before=await read();
  const search=page.locator('#daw-track-search');await search.fill('missing');assert.equal(await page.locator('[data-track-row]').count(),0);await page.getByText('No matching tracks',{exact:true}).waitFor();assert.equal(await search.evaluate(e=>e===document.activeElement),true);
  await search.fill('Lead');assert.equal(await page.locator('[data-track-row]').count(),1);assert.deepEqual(await read(),before);
  await page.getByRole('button',{name:'Clear search',exact:true}).click();assert.equal(await search.inputValue(),'');assert.equal(await page.locator('[data-track-row]').count(),2);
  await page.getByRole('button',{name:'Play',exact:true}).click();await search.fill('hidden');await page.getByRole('button',{name:'Pause',exact:true}).waitFor();assert.deepEqual(await read(),before);await page.getByRole('button',{name:'Stop',exact:true}).click();
  await page.locator('[data-mix-select=t]').click();await page.locator('[data-reveal-arrangement=t]').click();assert.equal(await search.inputValue(),'');assert.equal(await page.locator('[data-track=t]').evaluate(e=>e===document.activeElement),true);assert.equal(await page.locator('[data-track-row=t]').evaluate(e=>e.classList.contains('selected')),true);
  await page.locator('#daw-json').evaluate(e=>e.closest('details').open=true);await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'bus',name:'Group',kind:'bus'}},{op:'track.set',target:'t',values:{output:'bus'}},{op:'track.set',target:'bus',values:{collapsed:true}}]));await page.getByRole('button',{name:'Execute commands',exact:true}).click();assert.equal(await page.locator('[data-track=t]').count(),0);
  await page.locator('[data-reveal-arrangement=t]').click();assert.equal(await page.locator('[data-track=t]').count(),1);assert.equal((await read()).tracks.find(t=>t.id==='bus').collapsed,false);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await read()).tracks.find(t=>t.id==='bus').collapsed,true);
  assert.deepEqual(errors,[]);console.log('PASS hidden regions deselected without edits; live search, focus, empty state, clear, unchanged session and uninterrupted playback.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
