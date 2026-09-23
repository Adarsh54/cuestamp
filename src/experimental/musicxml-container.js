export const musicxmlByteLimit=8*1024*1024;
export function musicxmlRootPath(source){
 if(typeof source!=='string'||source.length>65536||/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(source))throw Error('Invalid MusicXML container manifest.');
 const document=new DOMParser().parseFromString(source,'application/xml'),root=document.documentElement;
 if(document.querySelector('parsererror')||root.localName!=='container')throw Error('Invalid MusicXML container manifest.');
 const groups=[...root.children].filter(n=>n.localName==='rootfiles');
 if(groups.length!==1)throw Error('MusicXML container must identify its root score.');
 const first=[...groups[0].children].find(n=>n.localName==='rootfile'),path=first?.getAttribute('full-path'),type=first?.getAttribute('media-type');
 if(type&&type!=='application/vnd.recordare.musicxml+xml')throw Error('The first MusicXML rootfile must be a MusicXML score.');
 return validateMusicxmlPath(path);
}
export function validateMusicxmlPath(path){
 if(typeof path!=='string'||!path||path.length>1024||/[\\\x00-\x1f]/.test(path)||path.startsWith('/')||path.includes(':')||path.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('MusicXML rootfile must use a relative archive path.');
 return path;
}
export function readMusicxmlEntry(entry,limit){
 if(!entry||entry.dir)throw Error('The MusicXML archive is missing a required file.');
 return new Promise((resolve,reject)=>{let length=0,failed=false;const chunks=[],stream=entry.internalStream('uint8array');
  stream.on('data',chunk=>{if(failed)return;length+=chunk.length;if(length>limit){failed=true;stream.pause();reject(Error('Expanded MusicXML file exceeds its size limit.'));return;}chunks.push(chunk);}).on('error',reject).on('end',()=>{if(failed)return;const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}try{resolve(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{reject(Error('Use UTF-8 encoded MusicXML files.'));}}).resume();
 });
}
export async function readCompressedMusicxml(data){
 if(!data?.byteLength||data.byteLength>musicxmlByteLimit)throw Error('Compressed MusicXML imports support files up to 8 MB.');
 const {default:JSZip}=await import('jszip');let zip;try{zip=await JSZip.loadAsync(data);}catch{throw Error('Unable to read this compressed MusicXML archive.');}
 if(Object.keys(zip.files).length>1024)throw Error('MusicXML archive contains too many files.');
 const entry=path=>{const file=zip.file(path);if(file?.unsafeOriginalName&&file.unsafeOriginalName!==path)throw Error('MusicXML archive contains an invalid root path.');return file;};
 const mime=entry('mimetype');if(mime&&(await readMusicxmlEntry(mime,128))!=='application/vnd.recordare.musicxml')throw Error('This archive is not compressed MusicXML.');
 const path=musicxmlRootPath(await readMusicxmlEntry(entry('META-INF/container.xml'),65536));
 return readMusicxmlEntry(entry(path),musicxmlByteLimit);
}
export async function musicxmlFileText(file){
 if(file.size>musicxmlByteLimit)throw Error('MusicXML imports support files up to 8 MB.');
 return /\.mxl$/i.test(file.name)?readCompressedMusicxml(await file.arrayBuffer()):file.text();
}
