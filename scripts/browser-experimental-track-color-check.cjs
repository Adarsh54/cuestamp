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
  await page.getByText('Command harness',{exact:true}).click();
  await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'t',kind:'midi',instrument:'sine'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},...[60,64,67].map((pitch,i)=>({op:'note.add',target:'r',values:{id:'n'+i,pitch,start:0,duration:2,velocity:.7,channel:0}}))]));
  await page.getByRole('button',{name:'Execute commands',exact:true}).click();await page.locator('[data-region=r]').click();




  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose')));
  await page.locator('[data-track=t]').click();const color=page.locator('.daw-track-color');await color.getByRole('button',{name:'Blue track color',exact:true}).click();let state=await read();assert.equal(state.tracks[0].color,'#6488ed');
  assert.equal(await page.locator('[data-track-row=t]').evaluate(e=>getComputedStyle(e).borderLeftColor),'rgb(100, 136, 237)');assert.equal(await page.locator('[data-lane=t]').evaluate(e=>e.style.getPropertyValue('--daw-track-color')),'#6488ed');assert.equal(await page.locator('[data-mix-select=t]').evaluate(e=>e.parentElement.style.getPropertyValue('--daw-track-color')),'#6488ed');
  const before=await read();await color.locator('[data-track-color-custom]').evaluate(e=>{e.value='#ab23cd';e.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal((await read()).tracks[0].color,'#ab23cd');await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await read()).tracks[0].color,'#6488ed');await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal((await read()).tracks[0].color,'#ab23cd');
  await color.getByRole('button',{name:'Default color',exact:true}).click();assert.equal((await read()).tracks[0].color,null);assert.equal(await page.locator('[data-lane=t]').evaluate(e=>e.style.getPropertyValue('--daw-track-color')),'');await page.getByRole('button',{name:'Undo',exact:true}).click();
  await color.screenshot({path:'/tmp/cuestamp-track-color.png'});const saved=await read();await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).tracks,saved.tracks);assert.deepEqual(errors,[]);console.log('PASS track color swatch/custom/reset, arrangement and mixer styling, undo/redo and reload.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
