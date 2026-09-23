const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true,args:['--disable-audio-output']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'transpose',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
  await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));
  await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));
  await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
  await page.getByText('Session restored on this device.',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('[data-audio-input-refresh]')?.disabled);await page.evaluate(()=>document.fonts.ready);
  await page.getByText('Command harness',{exact:true}).click();
  await page.locator('#daw-json').fill(JSON.stringify([{op:'track.add',values:{id:'t',kind:'midi',instrument:'sine'}},{op:'region.add',target:'t',values:{id:'r',duration:4}},...[60,64,67].map((pitch,i)=>({op:'note.add',target:'r',values:{id:'n'+i,pitch,start:0,duration:2,velocity:.7,channel:0}}))]));
  await page.getByRole('button',{name:'Execute commands',exact:true}).click();await page.locator('[data-region=r]').click();




  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose')));
  await page.locator('[data-mix-select=t]').click();await page.locator('[data-new-effect]').selectOption('distortion');await page.locator('[data-add-effect=t]').click();const form=page.locator('[data-effect-form]');await form.locator('[name=driveDb]').fill('24');await form.getByRole('button',{name:'Apply effect',exact:true}).click();assert.equal((await read()).tracks[0].effects[0].driveDb,24);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await read()).tracks[0].effects[0].driveDb,12);await page.getByRole('button',{name:'Redo',exact:true}).click();
  const open=async()=>{const scope=page.locator('[data-effect-presets]');if(!await scope.evaluate(e=>e.open))await scope.locator('summary').click();return scope;};
  let scope=await open();await scope.locator('[name=name]').fill('Warm master');await scope.getByRole('button',{name:'Save current chain',exact:true}).click();let state=await read();assert.equal(state.effectPresets.length,1);const preset=state.effectPresets[0];assert.equal(preset.effects[0].driveDb,24);
  await page.locator(`[data-mix-select="${state.id}"]`).click();scope=await open();await scope.locator('[data-effect-preset]').selectOption(preset.id);await scope.getByRole('button',{name:'Apply preset',exact:true}).click();state=await read();assert.equal(state.masterEffects[0].driveDb,24);assert.notEqual(state.masterEffects[0].id,preset.effects[0].id);
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await read()).masterEffects.length,0);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal((await read()).masterEffects.length,1);
  scope=await open();await scope.locator('[data-effect-preset]').selectOption(preset.id);await scope.locator('[data-effect-preset-mode]').selectOption('append');await scope.getByRole('button',{name:'Apply preset',exact:true}).click();assert.equal((await read()).masterEffects.length,2);
  scope=await open();await scope.locator('[data-effect-preset]').selectOption(preset.id);await scope.locator('[name=name]').fill('Saved grit');await scope.getByRole('button',{name:'Rename selected preset',exact:true}).click();assert.equal((await read()).effectPresets[0].name,'Saved grit');
  scope=await open();await scope.screenshot({path:'/tmp/cuestamp-effect-presets.png'});const saved=await read();await page.reload();await page.getByText('Session restored on this device.',{exact:true}).waitFor();assert.deepEqual((await read()).effectPresets,saved.effectPresets);assert.deepEqual((await read()).masterEffects,saved.masterEffects);
  await page.locator(`[data-mix-select="${saved.id}"]`).click();scope=await open();await scope.locator('[data-effect-preset]').selectOption(preset.id);await scope.getByRole('button',{name:'Delete preset',exact:true}).click();assert.equal((await read()).effectPresets.length,0);assert.equal((await read()).masterEffects.length,2);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await read()).effectPresets.length,1);
  scope=await open();await scope.locator('[data-effect-preset]').selectOption(preset.id);
  const downloadPromise=page.waitForEvent('download');await scope.getByRole('button',{name:'Export preset',exact:true}).click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/\.cuestamp-preset\.json$/);
  const bytes=require('node:fs').readFileSync(await download.path()),portable=JSON.parse(bytes.toString());assert.equal(portable.format,'cuestamp-effect-preset');assert.equal(portable.version,1);assert.equal(portable.name,'Saved grit');
  await scope.locator('[data-effect-preset-file]').setInputFiles({name:'chain.cuestamp-preset.json',mimeType:'application/json',buffer:bytes});await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:transpose')).effectPresets.length===2);
  state=await read();assert.equal(state.effectPresets[1].name,'Saved grit (2)');assert.equal(state.masterEffects.length,2);assert.notEqual(state.effectPresets[0].effects[0].id,state.effectPresets[1].effects[0].id);
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await read()).effectPresets.length,1);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal((await read()).effectPresets.length,2);
  scope=await open();const beforeBad=await read();await scope.locator('[data-effect-preset-file]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('not json')});await page.getByText('This file is not valid preset JSON.',{exact:true}).waitFor();assert.deepEqual(await read(),beforeBad);
  assert.deepEqual(errors,[]);console.log('PASS named effect presets: save track chain, apply and append to master, independent IDs, rename/delete, undo/redo, reload, portable download/import, duplicate names and invalid file rejection.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
