const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/auth?*',r=>r.fulfill({json:{configured:true,user:{id:'timing-import',email:'test@example.com'},profile:{name:'Test',occupation:'Composer',complete:true}}}));
 await page.route('**/api/projects*',r=>r.fulfill({json:{projects:[]}}));
 await page.goto((process.env.CUESTAMP_URL||'http://127.0.0.1:5190/')+'#/experimental');
 await page.getByText('Session restored on this device.',{exact:true}).waitFor();
 const result=await page.evaluate(async()=>{
  const {parseMusicxml,musicxmlMidi}=await import('/src/experimental/musicxml-import.js');
  const {readMidi}=await import('/src/experimental/midi.js');
  const note=(attributes,duration,ties='',chord='')=>`<note ${attributes}>${chord}<pitch><step>C</step><octave>4</octave></pitch><duration>${duration}</duration>${ties}</note>`;
  const xml=`<score-partwise version="4.0"><part-list><score-part id="p"><part-name>Performed timing</part-name></score-part></part-list><part id="p"><measure number="1"><attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>${note('attack="1"',16,'<tie type="start"/>')}</measure><measure number="2"><attributes><divisions>8</divisions></attributes>${note('release="-2"',8,'<tie type="stop"/>')}${note('attack="-2" release="2"',8)}${note('attack="2" release="-2"',8,'','<chord/>')}${note('',16)}</measure><measure number="3">${note('',8)}</measure></part></score-partwise>`;
  const score=parseMusicxml(xml),midi=readMidi(musicxmlMidi(score).buffer),rejected=[];
  for(const invalid of [xml.replace('attack="1"','attack="-1"'),xml.replace('attack="1"','attack="NaN"'),xml.replace('attack="1"','release="0"'),xml.replace('release="-2"','attack="0"'),xml.replace('attack="2" release="-2"','attack="8" release="-2"')]){
   try{parseMusicxml(invalid);rejected.push(false);}catch{rejected.push(true);}
  }
  return {xml,score,midi,rejected};
 });
 assert.deepEqual(result.score.tracks[0].notes.map(n=>[n.start,n.duration]),[[.25,4.5],[4.75,1.5],[5.25,.5],[6,2],[8,1]]);
 assert.deepEqual(result.midi.tracks[0].notes.map(n=>[n.start,n.duration]).sort((a,b)=>a[0]-b[0]),[[.125,2.25],[2.375,.75],[2.625,.25],[3,1],[4,.5]]);
 assert.ok(result.rejected.every(Boolean));
 await page.locator('#daw-files').setInputFiles({name:'performed.musicxml',mimeType:'application/vnd.recordare.musicxml+xml',buffer:Buffer.from(result.xml)});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:timing-import')).tracks.length===1);
 const session=await page.evaluate(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:timing-import')));
 assert.equal(session.tracks[0].regions[0].notes.length,5);
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cuestamp-experimental:timing-import')).tracks.length===0);
 assert.deepEqual(errors,[]);
 console.log('PASS: performed attack/release, ties with changing divisions, chords, bar alignment, MIDI conversion, rejection, UI import and Undo');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
