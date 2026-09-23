const children=(node,name)=>[...node.children].filter(n=>n.localName===name);
// Reorganize measures without altering their musical contents. The common parser
// subsequently validates durations, notes, voices, ties and instrument transposition.
export function partwiseMusicxmlRoot(root){
 if(root.localName!=='score-timewise')return root;
 const document=root.ownerDocument,lists=children(root,'part-list');
 if(lists.length!==1)throw Error('Timewise MusicXML requires one part list.');
 const ids=children(lists[0],'score-part').map(part=>part.getAttribute('id'));
 if(!ids.length||ids.length>128||ids.some(id=>!id)||new Set(ids).size!==ids.length)throw Error('Timewise MusicXML requires 1–128 distinct named part IDs.');
 const measures=children(root,'measure');if(!measures.length||measures.length>2048)throw Error('Import between 1 and 2,048 timewise measures.');
 const result=document.createElementNS(root.namespaceURI,'score-partwise');
 for(const attribute of root.attributes)result.setAttribute(attribute.name,attribute.value);
 for(const element of root.children)if(element.localName!=='measure')result.append(element.cloneNode(true));
 const parts=new Map(ids.map(id=>{const part=document.createElementNS(root.namespaceURI,'part');part.setAttribute('id',id);result.append(part);return [id,part];}));
 for(const measure of measures){
  if(measure.getAttribute('non-controlling')==='yes')throw Error('Timewise polymetric measures require a performed MIDI export.');
  const entries=children(measure,'part'),seen=new Set();
  for(const entry of entries){const id=entry.getAttribute('id');if(!parts.has(id)||seen.has(id))throw Error('Each timewise measure must contain each declared part exactly once.');seen.add(id);
   const target=document.createElementNS(root.namespaceURI,'measure');for(const attribute of measure.attributes)target.setAttribute(attribute.name,attribute.value);
   for(const content of entry.childNodes)target.append(content.cloneNode(true));parts.get(id).append(target);
  }
  if(seen.size!==parts.size)throw Error('Timewise measures with omitted parts are not supported yet. Include explicit rests or export MIDI.');
 }
 return result;
}
export function validateTimewiseBoundaries(tracks){
 const reference=tracks[0]?.measureEnds??[];
 for(const track of tracks)if(track.measureEnds.length!==reference.length||track.measureEnds.some((end,i)=>Math.abs(end-reference[i])>1e-7))throw Error('Timewise parts have inconsistent measure lengths. Include explicit rests or export MIDI.');
}
