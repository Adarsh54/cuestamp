const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'musical-reverse',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));
 await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');const notes=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:musical-reverse')).tracks[0].regions[0].notes.map(n=>[n.start,n.duration]));
 await page.getByText('Command harness',{exact:true}).click();await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'r',duration:8}},...[{start:1,duration:.5},{start:2,duration:1},{start:4,duration:2}].map(values=>({op:'note.add',target:'r',values})),{op:'tempo.add',values:{beat:8,bpm:60}}]));await page.getByRole('button',{name:'Execute commands',exact:true}).click();
 await page.locator('[data-region=r]').click();await page.getByText('Reverse note timing',{exact:true}).click();assert.equal(await page.locator('[data-reverse-form] [name=timing]').inputValue(),'beats');
 await page.getByRole('button',{name:'Reverse notes',exact:true}).click();assert.deepEqual(await notes(),[[7,1],[4,2],[1,2]]);
 await page.getByRole('button',{name:'Reverse notes',exact:true}).click();assert.deepEqual(await notes(),[[1,.5],[2,1],[4,4]]);
 await page.locator('[data-reverse-form] [name=timing]').selectOption('seconds');await page.getByRole('button',{name:'Reverse notes',exact:true}).click();assert.deepEqual(await notes(),[[7.5,.5],[6,1],[1,4]]);
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await notes(),[[1,.5],[2,1],[4,4]]);await page.reload();await page.locator('[data-region=r]').waitFor();assert.deepEqual(await notes(),[[1,.5],[2,1],[4,4]]);assert.deepEqual(errors,[]);
 console.log('PASS mapped musical reversal, inverse reversal, elapsed-time alternative, undo and reload.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
