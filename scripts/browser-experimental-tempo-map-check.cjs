const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'tempo',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
 await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));
 await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:tempo')));
 await page.getByText('Command harness',{exact:true}).click();await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'m',kind:'midi'}},{op:'region.add',target:'m',values:{id:'r',duration:8}},{op:'note.add',target:'r',values:{id:'n',start:5,duration:1}}]));await page.getByRole('button',{name:'Execute commands',exact:true}).click();
 await page.locator('[data-tempo-panel] summary').click();
 await page.getByRole('spinbutton',{name:'New tempo change beat',exact:true}).fill('9');await page.getByRole('spinbutton',{name:'New tempo change BPM',exact:true}).fill('60');await page.getByRole('button',{name:'Add tempo change',exact:true}).click();
 let s=await saved();assert.equal(s.tempoChanges[0].beat,8);assert.equal(s.tracks[0].regions[0].notes[0].start,6);assert.equal(s.tracks[0].regions[0].notes[0].duration,2);
 const row=page.locator('[data-tempo-point]');await row.locator('[name=bpm]').fill('90');await row.getByRole('button',{name:'Update',exact:true}).click();assert.equal((await saved()).tempoChanges[0].bpm,90);
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await saved()).tempoChanges[0].bpm,60);
 await page.reload();await page.locator('[data-tempo-panel] summary').click();assert.equal(await page.locator('[data-tempo-point] [name=bpm]').inputValue(),'60');
 const pcm=await page.evaluate(async()=>{const s=JSON.parse(localStorage.getItem('cuestamp-experimental:tempo'));const {scheduleSession}=await import('/src/experimental/audio-engine.js');const context=new OfflineAudioContext(2,44100*9,44100);scheduleSession(context,s,new Map(),0,{baseTime:0});const data=(await context.startRendering()).getChannelData(0);const peak=(a,b)=>data.slice(a*44100,b*44100).reduce((m,v)=>Math.max(m,Math.abs(v)),0);return {before:peak(5,5.9),during:peak(6.1,7.8),after:peak(8.2,8.9)};});assert.equal(pcm.before,0);assert.ok(pcm.during>.01);assert.equal(pcm.after,0);
 await page.locator('[data-tempo-delete]').click();s=await saved();assert.equal(s.tempoChanges.length,0);assert.equal(s.tracks[0].regions[0].notes[0].start,5);assert.equal(s.tracks[0].regions[0].notes[0].duration,1);
 assert.deepEqual(errors,[]);console.log('PASS tempo UI add/edit/delete, undo, saved map reload, MIDI retiming and actual offline audio at mapped times.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
