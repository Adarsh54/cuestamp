const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true,args:['--disable-audio-output']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'transpose',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
  await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));
  await page.route('**/api/daw',r=>{if(r.request().method()==='GET')return r.fulfill({json:{configured:true}});const body=r.request().postDataJSON();requests.push(body);return r.fulfill({json:{revision:body.session.revision,commands:[],summary:'Compression reading received.'}});});
  await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
  await page.getByText('Session restored on this device.',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('[data-audio-input-refresh]')?.disabled);await page.evaluate(()=>document.fonts.ready);

  const bytes=await page.evaluate(async()=>{const {encodeWav}=await import('/src/experimental/audio-engine.js');const c=new OfflineAudioContext(1,48000*4,48000),b=c.createBuffer(1,48000*4,48000);for(let i=0;i<b.length;i++)b.getChannelData(0)[i]=.2*Math.sin(i*440*2*Math.PI/48000);return Array.from(new Uint8Array(await encodeWav(b).arrayBuffer()));});await page.locator('#daw-files').setInputFiles({name:'slip.wav',mimeType:'audio/wav',buffer:Buffer.from(bytes)});await page.locator('[data-region]').waitFor();
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose')));const id=(await read()).tracks[0].regions[0].id;
  await page.getByText('Command harness',{exact:true}).click();await page.locator('#daw-json').fill(JSON.stringify([{op:'region.set',target:id,values:{duration:1,offset:1,reverse:true}}]));await page.getByRole('button',{name:'Execute commands',exact:true}).click();await page.locator('[data-region]').click();const before=await read(),form=page.locator('[data-source-slip]');await form.locator('[name=seconds]').fill('1');await form.getByRole('button',{name:'Slip source',exact:true}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose')).tracks[0].regions[0].offset===2);assert.deepEqual((await read()).tracks[0].regions[0],{...before.tracks[0].regions[0],offset:2});
  const slipped=await read();await form.locator('[name=seconds]').fill('2');await form.getByRole('button',{name:'Slip source',exact:true}).click();await page.getByText('The slipped clip must stay inside the original recording.',{exact:true}).waitFor();assert.deepEqual(await read(),slipped);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).tracks,before.tracks);
  const clip=page.locator('[data-region]');await clip.scrollIntoViewIfNeeded();let box=await clip.boundingBox();await page.keyboard.down('Alt');await page.keyboard.down('Shift');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+16,box.y+box.height/2,{steps:4});assert.deepEqual(await read(),{...(await read()),tracks:before.tracks});await page.mouse.up();await page.keyboard.up('Shift');await page.keyboard.up('Alt');assert.equal((await read()).tracks[0].regions[0].offset,1.5);assert.equal((await read()).tracks[0].regions[0].start,before.tracks[0].regions[0].start);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await read()).tracks,before.tracks);
  box=await clip.boundingBox();await page.keyboard.down('Alt');await page.keyboard.down('Shift');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+16,box.y+box.height/2);await clip.dispatchEvent('pointercancel');await page.mouse.up();await page.keyboard.up('Shift');await page.keyboard.up('Alt');assert.deepEqual((await read()).tracks,before.tracks);
  assert.deepEqual(errors,[]);console.log('PASS real WAV import, relative source slip, reverse/timeline preservation, boundary feedback, Alt-drag reverse slip, cancel and undo.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
