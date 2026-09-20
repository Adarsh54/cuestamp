const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const {writeMidi}=await import('../src/experimental/midi.js');
 const {newSession}=await import('../src/experimental/session.js');
 const source={...newSession(),keySignature:{sharps:-2,mode:'minor'},keyChanges:[{id:'modulation',beat:8,sharps:3,mode:'major'}]};
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'key-test',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
  await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));
  await page.route('**/api/daw',r=>r.fulfill({json:{configured:false}}));
  await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
  await page.getByText('MIDI signature import',{exact:true}).click();
  await page.locator('[data-midi-import-key]').selectOption('adopt');
  await page.locator('#daw-files').setInputFiles({name:'modulations.mid',mimeType:'audio/midi',buffer:Buffer.from(writeMidi(source))});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:key-test'))?.keyChanges?.length===1);
  const session=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:key-test')));
  assert.deepEqual((await session()).keySignature,source.keySignature);
  await page.locator('[data-key-panel] > summary').click();
  const form=page.locator('[data-key-change]');await form.locator('[name=beat]').fill('12');await form.locator('[name=key]').selectOption('-1:major');await form.getByRole('button',{name:'Apply',exact:true}).click();
  assert.equal((await session()).keyChanges[0].beat,12);assert.equal((await session()).keyChanges[0].sharps,-1);
  const add=page.locator('[data-key-change-new]');await add.locator('[name=beat]').fill('16');await add.getByRole('button',{name:'Add key change',exact:true}).click();assert.equal((await session()).keyChanges.length,2);
  await page.locator('[data-key-change-delete]').last().click();assert.equal((await session()).keyChanges.length,1);
  await page.locator('[data-action=undo]').click();assert.equal((await session()).keyChanges.length,2);
  await page.reload();await page.locator('[data-key-panel]').waitFor();assert.equal((await session()).keyChanges.length,2);assert.deepEqual(errors,[]);
  console.log('PASS: MIDI key-map import, key-change edit/add/remove, undo and reload persistence.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
