const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();await page.goto(process.env.CUESTAMP_URL||'http://127.0.0.1:5190/');
 const result=await page.evaluate(async()=>{const {scheduleMetronome}=await import('/src/experimental/metronome.js');
 const s={tempo:120,meter:4,metronomeEnabled:true,metronomeDb:0,tempoChanges:[{beat:8,bpm:60}],meterChanges:[{bar:3,numerator:6,denominator:8},{bar:5,numerator:7,denominator:4}]},rate=48000;
 const render=async(position,duration)=>{const c=new OfflineAudioContext(1,Math.round(duration*rate),rate);scheduleMetronome(c,s,{position,baseTime:0,duration});return (await c.startRendering()).getChannelData(0);};
 const data=await render(0,13),times=[0,.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10,11,12],accents=[0,2,4,7,10],peaks=times.map(t=>({time:t,accent:accents.includes(t),peak:data.slice(t*rate,(t+.04)*rate).reduce((m,v)=>Math.max(m,Math.abs(v)),0)}));
 let stray=0;for(let i=0;i<data.length;i++){const t=i/rate;if(!times.some(onset=>t>=onset&&t<onset+.041))stray=Math.max(stray,Math.abs(data[i]));}
 const tail=await render(4.01,.2);let error=0;for(let i=0;i<tail.length;i++)error=Math.max(error,Math.abs(tail[i]-data[Math.round(4.01*rate)+i]));return {peaks,stray,error};
 });for(const p of result.peaks)assert.ok(p.accent?p.peak>.8:p.peak>.4&&p.peak<.7,JSON.stringify(p));assert.equal(result.stray,0);assert.ok(result.error<.001);console.log('PASS actual metronome audio follows 4/4 → 6/8 → 7/4 beats, bar accents and seeking.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
