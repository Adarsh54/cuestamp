const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'meter-import',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
 await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));
 await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
 await page.getByText('Session restored on this device.',{exact:true}).waitFor();
 const result=await page.evaluate(async()=>{
  const {parseMusicxml,musicxmlMidi}=await import('/src/experimental/musicxml-import.js');
  const {readMidi}=await import('/src/experimental/midi.js');
  const note='<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>';
  const xml=`<score-partwise version="4.0"><part-list><score-part id="p"><part-name>Mixed meter</part-name></score-part></part-list><part id="p"><measure number="1"><attributes><divisions>1</divisions><time><beats>3+2</beats><beat-type>8</beat-type></time></attributes>${note}</measure><measure number="2"><attributes><time><beats>2</beats><beat-type>4</beat-type><beats>3</beats><beat-type>8</beat-type></time></attributes>${note}</measure><measure number="3">${note}</measure></part></score-partwise>`;
  const score=parseMusicxml(xml),midi=readMidi(musicxmlMidi(score).buffer),rejected=[];
  for(const invalid of [xml.replace('3+2','2++3'),xml.replace('<time>','<time number="1">'),xml.replace('<beats>3+2</beats><beat-type>8</beat-type>','<beat-type>8</beat-type><beats>3+2</beats>'),xml.replace('3+2','32+1')]){
   try{parseMusicxml(invalid);rejected.push(false);}catch{rejected.push(true);}
  }
  return {xml,score,midi,rejected};
 });
 assert.deepEqual(result.score.meters,[[0,{beats:5,denominator:8}],[2400,{beats:7,denominator:8}]]);
 assert.deepEqual(result.score.tracks[0].notes.map(n=>n.start),[0,2.5,6]);
 assert.deepEqual(result.midi.tracks[0].notes.map(n=>n.start),[0,1.25,3]);
 assert.ok(result.rejected.every(Boolean));
 await page.locator('#daw-files').setInputFiles({name:'additive.musicxml',mimeType:'application/vnd.recordare.musicxml+xml',buffer:Buffer.from(result.xml)});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:meter-import')).tracks.length===1);
 const session=await page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:meter-import')));
 assert.equal(session.tracks[0].regions[0].notes.length,3);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:meter-import')).tracks.length===0);
 assert.deepEqual(errors,[]);
 console.log('PASS: additive/composite score parsing, measure alignment, MIDI timing, invalid inputs, UI import and Undo');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
