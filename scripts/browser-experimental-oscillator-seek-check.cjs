const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE,headless:true});try{
 const page=await browser.newPage();await page.goto(process.env.CUESTAMP_URL||'http://127.0.0.1:5190/');
 const results=await page.evaluate(async()=>{
  const {SessionHistory}=await import('/src/experimental/session.js'),{scheduleTrackVoices}=await import('/src/experimental/audio-voices.js');
  const rate=44000,h=new SessionHistory();h.execute([{op:'track.add',values:{id:'t',kind:'midi',instrument:'sine'}},{op:'region.add',target:'t',values:{id:'r',duration:1}},{op:'note.add',target:'r',values:{pitch:69,start:0,duration:1,velocity:1}}]);
  const render=async(position,duration=1)=>{const track=structuredClone(h.session.tracks[0]);track.regions[0].notes[0].duration=duration;const context=new OfflineAudioContext(1,rate,rate),voices=scheduleTrackVoices(context,track,new Map(),context.destination,position,0);voices.open(0);return (await context.startRendering()).getChannelData(0);};
  const full=await render(0),result=[];
  // Whole oscillator periods isolate envelope continuity from oscillator phase.
  for(const [name,offset,duration] of [['attack',200,1],['sustain',22000,1],['release',43600,1],['short',200,.006]]){
   const reference=duration===1?full:await render(0,duration),seek=await render(offset/rate,duration);let maximum=0,energy=0;
   for(let i=0;i<Math.ceil(duration*rate)-offset;i++){maximum=Math.max(maximum,Math.abs(reference[i+offset]-seek[i]));energy+=seek[i]*seek[i];}
   result.push({name,maximum,energy});
  }
  return result;
 });
 for(const result of results){assert.ok(result.maximum<.0001,JSON.stringify(result));assert.ok(result.energy>0,JSON.stringify(result));}
 console.log('PASS oscillator seek PCM matches uninterrupted attack, sustain, release and short-note envelopes.',results);
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1);});
