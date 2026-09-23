import {z} from 'zod';
export const sampleMarkersSchema=z.array(z.number().finite().positive().max(86400)).max(10000).refine(markers=>markers.every((t,i)=>i===0||t>markers[i-1]),'Sample markers must be sorted and unique.');
export function sampleMarkersForBuffer(markers,buffer){const values=sampleMarkersSchema.parse(markers).map(t=>Math.round(t*buffer.sampleRate)/buffer.sampleRate);if(values.some(t=>t<=0||t>=buffer.duration)||values.some((t,i)=>i>0&&t<=values[i-1]))throw Error('Sample markers must be distinct frames inside the source.');return values;}
