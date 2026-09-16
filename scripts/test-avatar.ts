import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { Vector3 } from 'three';
import { GaltisOriginalAvatar, KNOWN_MOCAP_WORDS, GaltisModelSource } from '../src/components/GaltisOriginalAvatar';

// Exercise the production controller with real FBX/animation files, using local
// file transport instead of browser networking.
FBXLoader.prototype.load = function(url, onLoad) {
  setTimeout(() => {
    const b = readFileSync(`public${url}`);
    onLoad(this.parse(b.buffer.slice(b.byteOffset, b.byteOffset+b.byteLength), ''));
  }, url.includes('hello') ? 25 : 0);
};
globalThis.fetch = (async (url: string) => ({ok:true, json:async()=>JSON.parse(readFileSync(`public${url}`, 'utf8'))})) as typeof fetch;
const loaded = (avatar: GaltisOriginalAvatar, skin: GaltisModelSource) => new Promise<void>(resolve=>avatar.loadModel(skin, resolve));
let avatar: GaltisOriginalAvatar;
await new Promise<void>(resolve=>{avatar = new GaltisOriginalAvatar('full_mesh',resolve)});
for (const skin of ['full_mesh','hello','charcoal_suit','full_mesh'] as const) {
  await loaded(avatar!,skin);
  const handName = skin!=='hello' ? 'Hand_R' : 'hand_r';
  const hand = avatar!.modelGroup.getObjectByName(handName)!;
  assert.ok(hand);
  avatar!.root.updateMatrixWorld(true);
  const shoulder = avatar!.modelGroup.getObjectByName(skin!=='hello'?'Bicep_R':'upperarm_r')!;
  assert.ok(hand.getWorldPosition(new Vector3()).y < shoulder.getWorldPosition(new Vector3()).y - 0.2, 'idle hands rest below shoulders');
  const testKeys = [...Object.keys(KNOWN_MOCAP_WORDS).slice(0, 20), 'APPLE 1', 'ASSIGN 1', 'DABBLE'];
  for (const key of testKeys) {
    avatar!.resetToReady();
    assert.ok(await avatar!.prepareMocapClip(key));
    const playback = avatar!.playMocapClip(key, 1);
    assert.ok(playback.started, `${skin}: ${key} starts`);
    const samples: Vector3[] = [];
    for(let i=0;i<30;i++) {
      avatar!.update(playback.durationMs/1000/30, i/30, 1);
      avatar!.root.updateMatrixWorld(true);
      samples.push(hand.getWorldPosition(new Vector3()));
    }
    assert.ok(samples.every(p=>Number.isFinite(p.length())), `${skin}: ${key} finite`);
    assert.ok(samples.some(p=>p.distanceTo(samples[0])>0.001), `${skin}: ${key} moves hand`);
  }
  avatar!.applyPose({rightHand:{thumb:0.9,index:0.8,middle:0.7,ring:0.6,pinky:0.5},durationMs:400});
  avatar!.update(0.1, 0.1, 1);
  const finger=avatar!.modelGroup.getObjectByName(skin!=='hello'?'Index1_R':'index_01_r')!;
  assert.ok(Math.abs(finger.rotation.x)>0.1, 'procedural fingers use current skeleton');
  console.log(`${skin}: ${testKeys.length} sign aliases and procedural fingers pass`);
}
const mesh = avatar!.modelGroup.getObjectByName('GaltisChest') as import('three').SkinnedMesh;
const geometry = mesh.geometry;
const skeleton = mesh.skeleton;
const morphs = mesh.morphTargetInfluences;
avatar!.playMocapClip('HELLO', 1);
avatar!.update(0.1, 0.1, 1);
const handBefore = avatar!.modelGroup.getObjectByName('Hand_R')!.quaternion.clone();
assert.ok(avatar!.setAppearance('charcoal_suit'));
assert.equal(mesh.geometry, geometry, 'skin preserves exact geometry');
assert.equal(mesh.skeleton, skeleton, 'skin preserves exact skeleton and weights');
assert.equal(mesh.morphTargetInfluences, morphs, 'skin preserves facial morph targets');
assert.ok(avatar!.isMocapActionPlaying, 'skin preserves active sign');
assert.ok(avatar!.modelGroup.getObjectByName('Hand_R')!.quaternion.equals(handBefore));
assert.ok((mesh.material as import('three').Material[]).some(m => m.name === 'Galtis_Charcoal_Suit'));
assert.ok(avatar!.setAppearance('full_mesh'));
assert.ok(!(mesh.material as import('three').Material[]).some(m => m.name === 'Galtis_Charcoal_Suit'));
console.log('Material-only switching preserves geometry, skeleton, facial morphs and active sign');
let staleCallback=false;
avatar!.loadModel('hello',()=>{staleCallback=true});
await loaded(avatar!,'full_mesh');
await new Promise(r=>setTimeout(r,100));
assert.equal(staleCallback,false);
assert.equal(avatar!.modelGroup.children.length,1);
assert.ok(avatar!.modelGroup.getObjectByName('Bicep_R'));
avatar!.dispose();
console.log('Rapid skin switch: latest skin wins');
