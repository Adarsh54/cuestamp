const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true,args:['--disable-audio-output']});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],requests=[];let action={operation:'seek',position:5},gate=null;page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'agent-transport',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));
 await page.route('**/api/daw',async r=>{if(r.request().method()==='GET')return r.fulfill({json:{configured:true}});const b=r.request().postDataJSON(),chosen={...action};requests.push(b);if(gate)await gate;await r.fulfill({json:{revision:b.session.revision,commands:[],action:'transport',transport:chosen,transportEpoch:b.transport.epoch,summary:'MODEL CLAIM MUST NOT APPEAR'}}).catch(()=>{});});
 await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');await page.getByText('Session restored on this device.',{exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('[data-audio-input-refresh]')?.disabled);await page.evaluate(()=>document.fonts.ready);
 const command=async batch=>{if(!await page.locator('#daw-json').isVisible())await page.getByText('Command harness',{exact:true}).click();await page.locator('#daw-json').fill(JSON.stringify(batch));await page.getByRole('button',{name:'Execute commands',exact:true}).click();};
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:agent-transport')));
 await command([{op:'track.add',values:{id:'t',kind:'midi',instrument:'sine'}},{op:'region.add',target:'t',values:{id:'r',duration:1}},{op:'note.add',target:'r',values:{id:'n',pitch:60,duration:.8}},{op:'effect.add',target:'t',values:{id:'eq',kind:'eq',type:'bandpass',frequency:100,q:20}}]);
 for(const duration of [1,2.5]){
  if(duration>1)await command([{op:'region.set',target:'r',values:{duration}},{op:'note.set',target:'n',values:{duration:2.3}}]);
  const snapshot=await read(),expected=await page.evaluate(async s=>(await import('/src/experimental/audio-engine.js')).sessionDuration(s),snapshot);
  const start=Date.now();await page.getByRole('button',{name:'Play',exact:true}).click();await page.getByRole('button',{name:'Pause',exact:true}).waitFor();await page.getByRole('button',{name:'Play',exact:true}).waitFor({timeout:10000});
  assert.ok((Date.now()-start)/1000>=expected-.15);assert.equal(parseFloat(await page.locator('[data-clock]').textContent()),0);assert.deepEqual(await read(),snapshot);
 }
 assert.deepEqual(errors,[]);console.log('PASS automatic playback end includes EQ tail, resets playhead, and recomputes after a duration edit.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
