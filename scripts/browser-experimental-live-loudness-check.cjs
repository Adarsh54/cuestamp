const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true,args:['--disable-audio-output']});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'live-loudness',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));await page.route('**/api/daw',r=>r.fulfill({json:{configured:true}}));
 await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');await page.getByText('Session restored on this device.',{exact:true}).waitFor();await page.getByText('Command harness',{exact:true}).click();
 const edit=async commands=>{await page.locator('#daw-json').fill(JSON.stringify(commands));await page.getByRole('button',{name:'Execute commands',exact:true}).click();};
 await edit([{op:'track.add',values:{id:'t',kind:'midi',instrument:'sine'}},{op:'region.add',target:'t',values:{id:'r',duration:8}},{op:'note.add',target:'r',values:{pitch:69,duration:7.8,velocity:1}}]);
 const meter=page.locator('[data-live-loudness]');
 const play=async()=>{await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForFunction(()=>/Short-term -?\d/.test(document.querySelector('[data-live-loudness]')?.textContent));};
 await play();assert.match(await meter.textContent(),/Momentary -?\d/);assert.doesNotMatch(await meter.textContent(),/unavailable/);
 await page.getByRole('button',{name:'Stop',exact:true}).click();assert.match(await meter.textContent(),/Play to measure/);
 await page.getByRole('button',{name:'Play',exact:true}).click();assert.match(await meter.textContent(),/Play to measure|Short-term —/);await page.getByRole('button',{name:'Stop',exact:true}).click();
 await edit([{op:'session.set',values:{loopEnabled:true,loopStart:0,loopEnd:1}}]);await play();assert.match(await meter.textContent(),/Short-term -?\d/);await page.getByRole('button',{name:'Stop',exact:true}).click();assert.match(await meter.textContent(),/Play to measure/);
 assert.deepEqual(errors,[]);console.log('PASS real AudioWorklet live loudness in linear/cycle playback, startup windows and stop/restart reset.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
