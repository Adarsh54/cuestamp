import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
import {validateSceneTakeBundle} from './scene-takes.js';
import {availableScenePerformance} from './scene-performance.js';
import {createSceneSourceReader} from './scene-source.js';
export const takeBundleFingerprint=bundle=>bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(bundle))));
export function prepareTakeTransfer(bundle,session){const parsed=validateSceneTakeBundle(bundle,session.id);return {bundle:parsed,compatible:new Set(parsed.takes.filter(t=>availableScenePerformance(session,t.performance)).map(t=>t.id))};}
export function finishTakeTransfer(prepared,session,{freshIds=false}={}){const bundle=structuredClone(prepared.bundle),read=bundle.takes.length?createSceneSourceReader(session):null,ids=new Map();for(const take of bundle.takes){const oldId=take.id;if(freshIds)take.id=crypto.randomUUID();ids.set(oldId,take.id);take.performance.sessionId=session.id;take.performance.revision=session.revision;for(const event of take.performance.events){if(prepared.compatible.has(oldId))event.sourceSignature=read(event.sceneId,event.trackId);else if(!event.sourceSignature)event.sourceSignature='0'.repeat(64);}}bundle.selectedId=ids.get(bundle.selectedId)??null;return bundle;}
