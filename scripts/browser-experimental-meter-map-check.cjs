const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'meters',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));await page.goto('http://127.0.0.1:5190/#/experimental');
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:meters')));
 await page.locator('[data-meter-panel] summary').click();const form=page.locator('[data-meter-add]');await form.locator('[name=numerator]').fill('6');await form.locator('[name=denominator]').selectOption('8');await form.getByRole('button').click();assert.equal((await read()).meterChanges[0].bar,2);
 await page.locator('[data-action=add-drums]').click();await page.locator('[data-action=add-region]').click();assert.equal((await read()).tracks[0].regions[0].duration,6.5);
 await page.locator('[data-pattern-bar]').selectOption({value:'1'});await page.waitForFunction(()=>document.querySelectorAll('[data-step-pitch="36"]').length===12,{},{timeout:3000});await page.locator('[data-step-pitch="36"]').first().click();assert.equal((await read()).tracks[0].regions[0].notes[0].start,2);
 await page.reload();await page.locator('[data-meter-panel]').waitFor();assert.equal((await read()).meterChanges[0].denominator,8);
 await page.locator('[data-meter-panel] summary').click();await page.locator('[data-meter-point] [name=bar]').fill('3');await page.locator('[data-meter-point]').getByRole('button',{name:'Update',exact:true}).click();assert.equal((await read()).meterChanges[0].bar,3);
 await page.locator('[data-meter-delete]').click();assert.equal((await read()).meterChanges.length,0);await page.locator('[data-action=undo]').click();assert.equal((await read()).meterChanges[0].bar,3);assert.deepEqual(errors,[]);console.log('PASS signature CRUD, mapped four-bar region, drum placement, reload and undo.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
