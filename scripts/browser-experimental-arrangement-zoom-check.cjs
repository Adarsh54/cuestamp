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

  await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'t',kind:'midi'}},{op:'region.add',target:'t',values:{id:'early',duration:4}},{op:'region.add',target:'t',values:{id:'late',start:500,duration:20}}]));await page.getByRole('button',{name:'Execute commands',exact:true}).click();
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose'))),before=await read();
  await page.locator('[data-region=late]').click();await page.getByRole('button',{name:'Zoom to selection',exact:true}).click();
  const framed=await page.evaluate(()=>{const scroll=document.querySelector('.daw-scroll'),region=document.querySelector('[data-region=late]'),box=region.getBoundingClientRect(),view=scroll.getBoundingClientRect();return {left:box.left-view.left,right:box.right-view.left,width:scroll.clientWidth};});assert.ok(framed.left>=-1&&framed.right<=framed.width+1,JSON.stringify(framed));
  await page.getByRole('button',{name:'Fit project',exact:true}).click();const fit=await page.evaluate(()=>{const scroll=document.querySelector('.daw-scroll');return {left:scroll.scrollLeft,zoom:Number(document.querySelector('#daw-zoom').value),width:scroll.clientWidth};});assert.equal(fit.left,0);assert.ok(520*fit.zoom<=fit.width);assert.ok(fit.zoom<8);assert.deepEqual(await read(),before);
  await page.getByRole('button',{name:'Play',exact:true}).click();await page.getByRole('button',{name:'Zoom to selection',exact:true}).click();await page.getByRole('button',{name:'Pause',exact:true}).waitFor();await page.getByRole('button',{name:'Stop',exact:true}).click();assert.deepEqual(await read(),before);
  assert.deepEqual(errors,[]);console.log('PASS zoom frames selected region, fit project supports long arrangements, no document mutation, playback continues.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
