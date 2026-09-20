export function validateAudioStretch({sampleRate,frames,channels,ratio}){
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw Error('Choose audio sampled between 8 and 192 kHz.');
 if(!Number.isInteger(frames)||frames<Math.ceil(sampleRate*.05)||frames>sampleRate*600)throw Error('Time stretching supports audio from 50 ms to 10 minutes.');
 if(channels!==1&&channels!==2)throw Error('Time stretching supports mono or stereo audio.');
 if(!Number.isFinite(ratio)||ratio<.5||ratio>2)throw Error('Choose a duration between 50% and 200% of the original.');
 const outputFrames=Math.round(frames*ratio);if((frames+outputFrames)*channels*4>250*1024*1024)throw Error('Stretching this audio exceeds the 250 MB processing limit.');
 return outputFrames;
}
