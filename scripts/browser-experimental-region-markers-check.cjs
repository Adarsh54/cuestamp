const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'region-markers',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));
 await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');await page.getByText('Session restored on this device.',{exact:true}).waitFor();
 const button=page.locator('[data-markers-from-regions]');assert.equal(await button.isDisabled(),true);
 await page.getByText('Command harness',{exact:true}).click();await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'a',name:'Opening',start:1.25,duration:2}},{op:'region.add',target:'t',values:{id:'b',name:'Arrival',start:4,duration:2}}]));await page.getByRole('button',{name:'Execute commands',exact:true}).click();
 await page.locator('[data-region="a"]').click({position:{x:30,y:15}});await page.locator('[data-region="b"]').click({position:{x:30,y:15},modifiers:['Control']});
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:region-markers'))),before=await read();await button.click();const after=await read();
 assert.deepEqual(after.markers.map(({name,time})=>({name,time})),[{name:'Opening',time:1.25},{name:'Arrival',time:4}]);assert.deepEqual(after.tracks,before.tracks);
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await read()).markers.length,0);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal((await read()).markers.length,2);assert.deepEqual(errors,[]);console.log('PASS selected-region marker creation, exact names/times, unchanged clips, Undo/Redo and empty-selection control.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
