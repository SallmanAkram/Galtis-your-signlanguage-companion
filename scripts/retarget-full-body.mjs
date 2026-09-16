import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { AnimationClip, AnimationMixer, Quaternion, QuaternionKeyframeTrack, LoopOnce, Matrix4 } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Bake world-space rotation deltas onto the older rig, preserving its bone lengths
// and bind axes. Run from the repository root when source recordings change.
function load(name) {
  const b = readFileSync(`public/models/${name}.fbx`);
  return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
}
const source = load('galtis_hello');
const target = load('galtis_mesh');
source.updateMatrixWorld(true);
target.updateMatrixWorld(true);
const names = { Hip: 'pelvis', Chest_1: 'spine_01', Chest_2: 'spine_02', Chest_3: 'spine_03', Chest_4: 'spine_05', Neck: 'neck_02', Head: 'head' };
for (const side of ['L', 'R']) {
  const s = side.toLowerCase();
  for (const [a,b] of Object.entries({Collar:'clavicle', Bicep:'upperarm', Elbow:'elbow', Forearm:'lowerarm', Hand:'hand', Wrist:'wrist', Thigh:'thigh', Knee:'knee', Shin:'calf', Foot:'foot', Toe:'ball'})) names[`${a}_${side}`] = `${b}_${s}`;
  for (const finger of ['Thumb','Index','Middle','Ring','Pinky']) {
    for (let i=1;i<=3;i++) names[`${finger}${i}_${side}`] = `${finger.toLowerCase()}_0${i}_${s}`;
    if (finger !== 'Thumb') names[`${finger}Palm_${side}`] = `${finger.toLowerCase()}_metacarpal_${s}`;
  }
}
// FBX files open in different poses; inverse bind matrices hold their shared
// T-pose reference. Using the loaded pose would offset every sign on the older rig.
function bindRotations(root) {
  let mesh;
  root.traverse(o=>{if(o.isSkinnedMesh && !mesh) mesh=o});
  return new Map(mesh.skeleton.bones.map((b,i)=>[b.name,
    new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(mesh.skeleton.boneInverses[i].clone().invert())).normalize()
  ]));
}
const sourceBind = bindRotations(source);
const targetBind = bindRotations(target);
const mappings = [];
target.traverse(b => {
  if (!b.isBone || !names[b.name]) return;
  const src = source.getObjectByName(names[b.name]);
  if (!src) throw new Error(`Missing source bone ${names[b.name]}`);
  mappings.push({ b, src, sourceBindInverse: sourceBind.get(src.name).clone().invert(), targetBind: targetBind.get(b.name).clone(), localBind: b.quaternion.clone() });
});
mkdirSync('public/animations/full_mesh', {recursive:true});
// Imported clips are already retargeted and optimized by the FBX batch pipeline.
const reportPath = 'scripts/reports/dictionary-conversion.json';
const imported = new Set(existsSync(reportPath) ? Object.values(JSON.parse(readFileSync(reportPath, 'utf8')).files).map(entry => entry.animationFile) : []);
for (const file of readdirSync('public/animations').filter(f=>f.endsWith('.json') && !imported.has(f))) {
  const clip = AnimationClip.parse(JSON.parse(readFileSync(`public/animations/${file}`, 'utf8')));
  clip.tracks = clip.tracks.filter(t=>source.getObjectByName(t.name.split('.')[0]));
  const mixer = new AnimationMixer(source);
  mixer.clipAction(clip).setLoop(LoopOnce, 1).play();
  const frames = Math.max(2, Math.ceil(clip.duration * 30) + 1);
  const times = Array.from({length:frames}, (_,i)=>i * clip.duration / (frames - 1));
  const values = mappings.map(()=>[]);
  for (const time of times) {
    mixer.setTime(Math.min(time, clip.duration - 0.000001));
    source.updateMatrixWorld(true);
    mappings.forEach(({b,src,sourceBindInverse,targetBind},i)=>{
      const desired = src.getWorldQuaternion(new Quaternion()).multiply(sourceBindInverse).multiply(targetBind);
      const parentInverse = b.parent.getWorldQuaternion(new Quaternion()).invert();
      b.quaternion.copy(parentInverse.multiply(desired)).normalize();
      b.updateMatrixWorld(true);
      b.quaternion.toArray(values[i], values[i].length);
    });
  }
  const result = new AnimationClip(clip.name, clip.duration, mappings.map(({b},i)=>new QuaternionKeyframeTrack(`${b.name}.quaternion`, times, values[i]))).optimize();
  writeFileSync(`public/animations/full_mesh/${file}`, JSON.stringify(AnimationClip.toJSON(result), (_,value)=>typeof value === 'number' ? Number(value.toFixed(6)) : value));
  mixer.stopAllAction();
  mappings.forEach(({b,localBind})=>b.quaternion.copy(localBind));
  target.updateMatrixWorld(true);
  console.log(`${file}: ${result.tracks.length} mapped tracks`);
}
