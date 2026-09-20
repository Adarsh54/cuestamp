// Freeze settings for a take so every note-off follows the same transform as
// its note-on. Never wrap out-of-range pitches or mutate Web MIDI message data.
export function createMidiInputTransform({channel=null,transpose=0}={}){
 if(channel!==null&&(!Number.isInteger(channel)||channel<0||channel>15))throw Error('Choose MIDI channel 1–16 or All channels.');
 if(!Number.isInteger(transpose)||transpose<-48||transpose>48)throw Error('Input transposition must be a whole number from -48 to 48 semitones.');
 return data=>{
  const status=data?.[0];if(!Number.isInteger(status)||status<0x80||status>0xff)return null;
  if(status>=0xf0)return data;
  if(channel!==null&&(status&15)!==channel)return null;
  const type=status>>4,length=type===12||type===13?2:3;
  if(data.length!==length||Array.from(data).slice(1).some(v=>!Number.isInteger(v)||v<0||v>127))return null;
  if(![8,9,10].includes(type)||transpose===0)return data;
  const pitch=data[1]+transpose;if(pitch<0||pitch>127)return null;
  const output=new Uint8Array(data);output[1]=pitch;return output;
 };
}
