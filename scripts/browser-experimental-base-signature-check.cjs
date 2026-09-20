const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'signature',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:signature'))),form=page.locator('[data-metronome-form]');
 await form.locator('[name=meter]').fill('6');await form.locator('[name=denominator]').selectOption('8');await page.getByRole('button',{name:'Apply metronome',exact:true}).click();assert.equal((await read()).meterDenominator,8);
 await page.locator('[data-action=add-drums]').click();await page.locator('[data-action=add-region]').click();let s=await read();assert.equal(s.tracks[0].regions[0].duration,6);
 assert.equal(await page.locator('[data-step-pitch="36"]').count(),12);await page.locator('[data-step-pitch="36"]').nth(11).click();s=await read();assert.equal(s.tracks[0].regions[0].notes[0].start,1.375);
 await page.reload();await page.locator('[data-metronome-form]').waitFor();assert.equal(await page.locator('[name=denominator]').inputValue(),'8');
 const decoded=await page.evaluate(async()=>{const s=JSON.parse(localStorage.getItem('cuestamp-experimental:signature')),{writeMidi,readMidi}=await import('/src/experimental/midi.js');return readMidi(writeMidi(s).buffer);});assert.equal(decoded.timeSignatures[0].denominator,8);assert.equal(decoded.timeSignatures[0].numerator,6);assert.deepEqual(errors,[]);
 console.log('PASS 6/8 signature controls, four-bar region length, 12-step drum bar, hit placement, reload and MIDI metadata.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
