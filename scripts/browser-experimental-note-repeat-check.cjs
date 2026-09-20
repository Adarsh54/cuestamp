const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'note-repeat',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
 await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:note-repeat')));
 await page.getByText('Command harness',{exact:true}).click();await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:8}},{op:'note.add',target:'r',values:{id:'n',start:3.5,duration:.5}},{op:'tempo.add',values:{beat:8,bpm:60}}]));await page.getByRole('button',{name:'Execute commands',exact:true}).click();
 await page.locator('[data-region=r]').click();await page.locator('[data-notes-all]').click();await page.locator('[data-note-copy]').click();assert.deepEqual((await saved()).tracks[0].regions[0].notes.map(n=>[n.start,n.duration]),[[3.5,.5],[4,1]]);await page.getByRole('button',{name:'Undo',exact:true}).click();await page.locator('[data-notes-all]').click();await page.locator('[data-notes-copy]').click();
 let s=await saved(),notes=s.tracks[0].regions[0].notes;assert.deepEqual(notes.map(n=>[n.start,n.duration]),[[3.5,.5],[4,1]]);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.locator('[data-notes-all]').click();
 await page.getByText('Repeat selected notes',{exact:true}).click();await page.locator('[data-note-repeat] [name=count]').fill('3');await page.locator('[data-note-repeat] [name=beats]').fill('4');await page.locator('[data-note-repeat] [name=extend]').check();await page.getByRole('button',{name:'Repeat notes',exact:true}).click();
 s=await saved();notes=s.tracks[0].regions[0].notes;assert.deepEqual(notes.map(n=>[n.start,n.duration]),[[3.5,.5],[7,1],[11,1],[15,1]]);assert.equal(s.tracks[0].regions[0].duration,16);
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await saved()).tracks[0].regions[0].notes.length,1);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await page.reload();await page.locator('[data-region=r]').waitFor();assert.equal((await saved()).tracks[0].regions[0].notes.length,4);
 assert.deepEqual(errors,[]);console.log('PASS musical duplicate and repeat UI, region extension, undo/redo and saved copies across tempo boundary.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
