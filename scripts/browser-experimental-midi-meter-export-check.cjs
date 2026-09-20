const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');const fs=require('node:fs/promises');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'meter-export',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));
 await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
 await page.getByText('Command harness',{exact:true}).click();await page.locator('#daw-json').fill(JSON.stringify([{op:'session.set',values:{meter:7}},{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},{op:'note.add',target:'r',values:{pitch:60,start:1,duration:1}}]));await page.getByRole('button',{name:'Execute commands',exact:true}).click();
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Export MIDI',exact:true}).click();const download=await wait,bytes=await fs.readFile(await download.path()),{readMidi}=await import('../src/experimental/midi.js'),midi=readMidi(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 assert.match(download.suggestedFilename(),/\.mid$/);assert.deepEqual([...bytes.slice(22,30)],[0,255,88,4,7,2,24,8]);assert.equal(midi.timeSignatures[0].numerator,7);assert.equal(midi.tracks[0].notes[0].start,1);assert.equal(midi.tracks[0].notes[0].duration,1);assert.deepEqual(errors,[]);
 console.log('PASS actual MIDI download carries 7/4 time signature and unchanged note timing.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
