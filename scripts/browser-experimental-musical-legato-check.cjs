const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'musical-legato',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));
 await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:musical-legato')));
 await page.getByText('Command harness',{exact:true}).click();await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:8}},{op:'tempo.add',values:{beat:8,bpm:60}},...[0,3,4.25].map(start=>({op:'note.add',target:'r',values:{start,duration:.2}}))]));await page.getByRole('button',{name:'Execute commands',exact:true}).click();
 await page.locator('[data-region=r]').click();await page.getByText('Legato & note lengths',{exact:true}).click();const form=page.locator('[data-legato-form]'),apply=page.getByRole('button',{name:'Apply note lengths',exact:true});
 await form.locator('[name=gap]').fill('100');await form.locator('[name=timing]').selectOption('beats');assert.equal(await form.locator('[name=gap]').inputValue(),'0');
 await form.locator('[name=gap]').fill('1');await apply.click();assert.deepEqual((await read()).tracks[0].regions[0].notes.map(n=>n.duration),[2.5,.625,.2]);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await form.locator('[name=timing]').selectOption('seconds');assert.equal(await form.locator('[name=gap]').inputValue(),'100');await form.locator('[name=timing]').selectOption('beats');assert.equal(await form.locator('[name=gap]').inputValue(),'1');
 await form.locator('[name=gap]').fill('3');assert.equal(await apply.isDisabled(),true);await form.locator('[name=gap]').fill('-1');await apply.click();const s=await read();assert.deepEqual(s.tracks[0].regions[0].notes.map(n=>n.duration),[3.5,2.25,.2]);
 await page.reload();await page.locator('[data-region=r]').waitFor();assert.deepEqual((await read()).tracks,s.tracks);assert.deepEqual(errors,[]);
 console.log('PASS beat gap/overlap UI, safe unit switching, invalid preview, undo and persisted durations.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
