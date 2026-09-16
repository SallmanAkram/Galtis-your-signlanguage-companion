import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { AnimationClip, AnimationMixer, LoopOnce, Quaternion, Vector3 } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GaltisOriginalAvatar, KNOWN_MOCAP_WORDS } from '../src/components/GaltisOriginalAvatar';
import { STUDIO_GALT_DICTIONARY } from '../src/data/studioGaltDictionary';
import { parseSpeechToSigns } from '../src/data/aslDictionary';

const report = JSON.parse(readFileSync('scripts/reports/dictionary-conversion.json', 'utf8'));
const playbackOnly = process.argv.includes('--playback-only');
const records = Object.values(report.files) as { status: string; animationFile: string; outputHash: string; secondaryHash: string }[];
if (!playbackOnly) assert.equal(records.length, report.sourceFiles, 'Every FBX has an outcome');
assert.ok(records.every(r => r.status === 'ok'), 'All source recordings converted');
assert.equal(new Set(records.map(r => r.animationFile)).size, records.length, 'No filenames collided');
const words = new Set<string>();
for (const entry of STUDIO_GALT_DICTIONARY) {
  assert.ok(entry.animationFile, `${entry.word}: explicit file`);
  assert.ok(!words.has(entry.word), `${entry.word}: unique dictionary label`); words.add(entry.word);
  assert.equal(KNOWN_MOCAP_WORDS[entry.word], `/animations/${entry.animationFile}`);
}

let requests: string[] = [], failPath = '', delayedPath = '', release: (() => void) | undefined;
FBXLoader.prototype.load = function(url, onLoad) {
  setTimeout(() => {
    const bytes = readFileSync(`public${url}`);
    onLoad(this.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), ''));
  }, 0);
};
globalThis.fetch = (async (url: string) => {
  requests.push(url);
  if (url === delayedPath) await new Promise<void>(resolve => { release = resolve; });
  if (url === failPath) return { ok: false, status: 404 };
  return { ok: true, json: async () => JSON.parse(readFileSync(`public${url}`, 'utf8')) };
}) as typeof fetch;
let avatar: GaltisOriginalAvatar;
await new Promise<void>(resolve => { avatar = new GaltisOriginalAvatar('full_mesh', resolve); });
assert.ok(requests.length <= 14, 'Startup loads only the small existing clip set');
const fullBones = new Set<string>();
avatar!.modelGroup.traverse(b => { if ((b as any).isBone) fullBones.add(b.name); });
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
let totalBytes = 0;
for (const r of playbackOnly ? [] : records) {
  for (const [directory, expected] of [['full_mesh/', r.outputHash], ['', r.secondaryHash]]) {
    const text = readFileSync(`public/animations/${directory}${r.animationFile}`, 'utf8');
    assert.equal(hash(text), expected, `${r.animationFile}: output integrity`);
    const clip = AnimationClip.parse(JSON.parse(text));
    assert.ok(clip.uuid, `${r.animationFile}: required mixer identity`);
    assert.ok(clip.validate() && clip.duration > 0);
    if (directory) totalBytes += Buffer.byteLength(text);
    for (const track of clip.tracks) {
      if (directory) assert.ok(fullBones.has(track.name.split('.')[0]), `Unbound ${track.name}`);
      assert.ok([...track.times, ...track.values].every(Number.isFinite));
      assert.ok(Math.abs(track.times[0]) < .0001 && Math.abs(track.times.at(-1)! - clip.duration) < .0001);
      for (let i = 0; i < track.values.length; i += 4) assert.ok(Math.abs(Math.hypot(...track.values.slice(i, i + 4)) - 1) < .0003);
    }
  }
}
if (!playbackOnly) console.log(`${records.length} clips validated for both avatars; full-mesh size ${(totalBytes / 1024 / 1024).toFixed(1)} MiB`);

const samples = ['APPLE 1', 'ASSIGN 1', 'DABBLE'];
const sourceHands = ['mixamorig1RightHand', 'handinte_R', 'handR'];
for (const word of samples) {
  avatar!.resetToReady();
  const beforeRequests = requests.length;
  const [one, two] = await Promise.all([avatar!.prepareMocapClip(word), avatar!.prepareMocapClip(word)]);
  assert.ok(one && two); assert.equal(requests.length - beforeRequests, 1, 'Concurrent loads deduplicate');
  const playback = avatar!.playMocapClip(word);
  assert.ok(playback.started);
  const entry = STUDIO_GALT_DICTIONARY.find(e => e.word === word)!;
  const bytes = readFileSync(`public/animations/SignLanguage_Dictionary/${entry.parentMotion}`);
  const source = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const sourceMixer = new AnimationMixer(source);
  const sourceAction = sourceMixer.clipAction(source.animations[0]).setLoop(LoopOnce, 1);
  sourceAction.clampWhenFinished = true; sourceAction.play();
  const sourceHand = source.getObjectByName(sourceHands[samples.indexOf(word)])!;
  assert.ok(sourceHand);
  assert.ok(Math.abs(playback.durationMs / 1000 - entry.durationSec!) < .001, 'Queue uses the full recorded duration');
  const hand = avatar!.modelGroup.getObjectByName('Hand_R')!;
  const finger = avatar!.modelGroup.getObjectByName('Index1_R')!;
  const localPositions = new Map<string, Vector3>();
  avatar!.modelGroup.traverse(b => { if ((b as any).isBone) localPositions.set(b.name, b.position.clone()); });
  const positions: Vector3[] = [], fingerRotations = [];
  for (let i = 0; i < 60; i++) {
    avatar!.update(playback.durationMs / 60000, i / 60, 1);
    avatar!.root.updateMatrixWorld(true);
    // Compare after the previous sign's 250 ms crossfade has finished.
    if (playback.durationMs / 1000 * (i + 1) / 60 > .3 && i < 59) {
      sourceMixer.setTime(playback.durationMs / 1000 * (i + 1) / 60 + (word === 'DABBLE' ? 0 : 2 / 30));
      source.updateMatrixWorld(true);
      const originalQ = sourceHand.getWorldQuaternion(new Quaternion()).normalize();
      const playedQ = hand.getWorldQuaternion(new Quaternion()).normalize();
      assert.ok(new Vector3(0, 1, 0).applyQuaternion(originalQ).angleTo(new Vector3(0, 1, 0).applyQuaternion(playedQ)) < .03, `${word}: recorded hand direction preserved`);
      const palmNormal = (root: import('three').Object3D, handName: string, indexName: string, pinkyName: string) => {
        const h = root.getObjectByName(handName)!.getWorldPosition(new Vector3());
        const index = root.getObjectByName(indexName)!.getWorldPosition(new Vector3());
        const pinky = root.getObjectByName(pinkyName)!.getWorldPosition(new Vector3());
        return new Vector3().crossVectors(index.clone().sub(pinky), index.clone().add(pinky).multiplyScalar(.5).sub(h)).normalize();
      };
      const sourceFingers = word === 'APPLE 1' ? ['mixamorig1RightHandIndex1', 'mixamorig1RightHandPinky1'] : word === 'ASSIGN 1' ? ['indexinte_01_R', 'pinkyinte_01_R'] : ['f_index01R', 'f_pinky01R'];
      const originalPalm = palmNormal(source, sourceHand.name, sourceFingers[0], sourceFingers[1]);
      const playedPalm = palmNormal(avatar!.modelGroup, 'Hand_R', 'Index1_R', 'Pinky1_R');
      assert.ok(originalPalm.dot(playedPalm) > .8, `${word}: palm is not rolled or mirrored`);
    }
    positions.push(hand.getWorldPosition(new Vector3())); fingerRotations.push(finger.quaternion.clone());
    avatar!.modelGroup.traverse(b => {
      if (!(b as any).isBone) return;
      assert.ok(b.position.distanceTo(localPositions.get(b.name)!) < 1e-6, 'Bone lengths/positions preserved');
      assert.ok(b.quaternion.toArray().every(Number.isFinite));
    });
  }
  assert.ok(positions.every(p => p.length() < 3 && p.y > -.5), `${word}: hand stays within the avatar stage`);
  assert.ok(positions.some(p => p.distanceTo(positions[0]) > .01), `${word}: hand articulates`);
  assert.ok(fingerRotations.some(q => q.angleTo(fingerRotations[0]) > .01), `${word}: fingers articulate`);
  sourceMixer.stopAllAction(); sourceMixer.uncacheRoot(source);
  console.log(`${word}: real Galtis playback, hands, fingers, finite transforms, bone lengths, duration pass`);
}
assert.equal(parseSpeechToSigns('apple').signQueue[0]?.name, 'APPLE 1');
assert.equal(parseSpeechToSigns('my name is').signQueue.length, 1);
for (const word of samples) assert.equal(parseSpeechToSigns(word).signQueue[0]?.name, word);
const phrase = STUDIO_GALT_DICTIONARY.find(e => e.word.split(' ').length > 3 && /^[A-Z ]+$/.test(e.word));
if (phrase) assert.equal(parseSpeechToSigns(phrase.word).signQueue[0]?.name, phrase.word, 'Long phrases match as a unit');

const unloaded = STUDIO_GALT_DICTIONARY.filter(e => e.source === 'StudioGalt FBX Dictionary' && !samples.includes(e.word)).slice(0, 2);
failPath = `/animations/full_mesh/${unloaded[0].animationFile}`;
assert.equal(await avatar!.prepareMocapClip(unloaded[0].word), false);
assert.equal(avatar!.playMocapClip(unloaded[0].word).started, false, 'Failed loads never pretend to play');
delayedPath = `/animations/full_mesh/${unloaded[1].animationFile}`;
const pending = avatar!.prepareMocapClip(unloaded[1].word);
const changed = new Promise<void>(resolve => avatar!.loadModel('hello', resolve));
assert.ok(release); release!();
assert.equal(await pending, false, 'Old rig request invalidated by avatar change');
await changed;
assert.equal(avatar!.isMocapActionPlaying, false, 'Stale request did not start playback');
assert.ok(await avatar!.prepareMocapClip('APPLE 1'));
assert.ok(avatar!.playMocapClip('APPLE 1').started, 'Secondary rig has its own converted clip');
avatar!.dispose();
console.log('Dictionary matching, failed loads, deduplication, skin changes, and stale loads pass');
