// Names are display labels; the ID selects sampler mappings and the remaining
// fields determine external MIDI behavior. Compare fields in a stable order.
export function articulationIdentity(articulation){return articulation?JSON.stringify([articulation.id,articulation.type,articulation.channel,articulation.parameter,articulation.value,articulation.duration??.05]):null;}
