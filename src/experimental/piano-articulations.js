// Stable per-ID colors keep a technique recognizable across selections and regions.
export function articulationColor(id){let hash=2166136261;for(const character of id){hash^=character.codePointAt(0);hash=Math.imul(hash,16777619);}return `hsl(${(hash>>>0)%360} 65% 68%)`;}
