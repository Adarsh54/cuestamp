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

  await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'a',kind:'audio'}},{op:'track.add',values:{id:'m',kind:'midi'}},{op:'region.add',target:'a',values:{id:'short',duration:1}},{op:'region.add',target:'a',values:{id:'long',start:2,duration:10}},{op:'region.add',target:'m',values:{id:'midi',duration:4}}]));await page.getByRole('button',{name:'Execute commands',exact:true}).click();
  for(const id of ['short','long','midi'])await page.locator(`[data-region=${id}]`).click({modifiers:id==='short'?[]:['Control']});
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose'))),before=await read(),form=page.locator('[data-batch-fades]');await page.getByText('Fades · 2 selected audio clips',{exact:true}).waitFor();
  await form.locator('[name=fadeIn]').fill('1');await form.locator('[name=fadeOut]').fill('2');await form.getByRole('button',{name:'Apply audio fades',exact:true}).click();await page.getByText('Fades exceed a selected clip’s length. Shorten them or choose Scale to fit.',{exact:true}).waitFor();assert.deepEqual(await read(),before);
  assert.equal(await form.locator('[name=fadeIn]').inputValue(),'1');assert.equal(await form.locator('[name=fadeOut]').inputValue(),'2');
  await form.locator('[name=fit]').selectOption('scale');await form.locator('[name=shape]').selectOption('equalPower');await form.getByRole('button',{name:'Apply audio fades',exact:true}).click();let saved=await read();assert.equal(saved.tracks[0].regions[0].fadeIn,1/3);assert.equal(saved.tracks[0].regions[1].fadeOut,2);assert.equal(saved.tracks[0].regions[1].fadeInShape,'equalPower');assert.deepEqual(saved.tracks[1],before.tracks[1]);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).tracks,before.tracks);
  assert.deepEqual(errors,[]);console.log('PASS batch fades UI, mixed selection filtering, rejection without edits, proportional fit, curve choice and undo.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
