import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { AnimationClip, AnimationMixer, LoopOnce, Matrix4, Quaternion, QuaternionKeyframeTrack, Vector3 } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export function loadFBX(path) {
  const bytes = readFileSync(path);
  return new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}

export function assignClipIdentity(json) {
  const digest = createHash('sha256').update(JSON.stringify([json.name, json.tracks])).digest('hex');
  json.uuid = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  return json;
}

export const normalizeBone = name => name.split(/[|:]/).at(-1).replace(/^mixamorig\d*/i, '').replace(/[ ._-]/g, '').toLowerCase();

// Semantic names refer to the deform bones, never the IK/FK control bones.
const aliases = {
  Hip: ['Hip', 'Hips', 'Hip_Root', 'pelvis', 'pelvisinte'],
  Chest_1: ['Chest_1', 'Spine', 'spine_01', 'spineinte_01'],
  Chest_2: ['Chest_2', 'Spine1', 'spine_02', 'spineinte_02'],
  Chest_3: ['Chest_3', 'Spine2', 'spine_03', 'spineinte_03'],
  Chest_4: ['Chest_4', 'Spine2', 'spine_05', 'spineinte_05'],
  Neck: ['Neck', 'neck_02', 'neck_01', 'neckinte_02'], Head: ['Head', 'headinte'],
};
for (const side of ['L', 'R']) {
  const long = side === 'L' ? 'Left' : 'Right';
  for (const [galtis, ue, mixamo] of [
    ['Collar', 'clavicle', 'Shoulder'], ['Bicep', 'upperarm', 'Arm'],
    ['Forearm', 'lowerarm', 'ForeArm'], ['Hand', 'hand', 'Hand'],
    ['Thigh', 'thigh', 'UpLeg'], ['Shin', 'calf', 'Leg'], ['Foot', 'foot', 'Foot'], ['Toe', 'ball', 'ToeBase'],
  ]) aliases[`${galtis}_${side}`] = [`${galtis}_${side}`, `${ue}_${side}`, `${long}${mixamo}`, `${ue}inte_${side}`];
  for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
    for (let i = 1; i <= 3; i++) aliases[`${finger}${i}_${side}`] = [`${finger}${i}_${side}`, `${finger}_0${i}_${side}`, `${long}Hand${finger}${i}`, `${finger}inte_0${i}_${side}`];
    if (finger !== 'Thumb') aliases[`${finger}Palm_${side}`] = [`${finger}Palm_${side}`, `${finger}_metacarpal_${side}`];
  }
}
const rigify = { Hip: 'spine', Chest_1: 'spine001', Chest_2: 'spine002', Chest_3: 'spine003', Chest_4: 'spine004', Neck: 'spine005', Head: 'spine006' };
for (const side of ['L', 'R']) {
  for (const [a, b] of Object.entries({ Collar: 'shoulder', Bicep: 'upper_arm', Forearm: 'forearm', Hand: 'hand', Thigh: 'thigh', Shin: 'shin', Foot: 'foot', Toe: 'toe' })) rigify[`${a}_${side}`] = b + side;
  for (const [f, palm] of [['Index', '01'], ['Middle', '02'], ['Ring', '03'], ['Pinky', '04'], ['Thumb', null]]) {
    for (let i = 1; i <= 3; i++) rigify[`${f}${i}_${side}`] = `${f === 'Thumb' ? 'thumb' : 'f_' + f.toLowerCase()}0${i}${side}`;
    if (palm) rigify[`${f}Palm_${side}`] = `palm${palm}${side}`;
  }
}

export function semanticBones(root) {
  const bones = new Map();
  root.traverse(b => { if (b.isBone) bones.set(normalizeBone(b.name), b); });
  const isRigify = bones.has('upperarml') && bones.has('spine006');
  const result = new Map();
  for (const [name, candidates] of Object.entries(aliases)) {
    const bone = (isRigify ? [rigify[name]] : candidates).filter(Boolean).map(n => bones.get(normalizeBone(n))).find(Boolean);
    if (bone) result.set(name, bone);
  }
  return { bones: result, family: isRigify ? 'rigify' : root.getObjectByName('pelvis') ? 'unreal' : [...bones.keys()].some(n => n === 'rightarm') ? 'mixamo' : 'galtis' };
}

export function bindWorld(root) {
  const result = new Map();
  root.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    mesh.skeleton.bones.forEach((bone, i) => {
      if (!result.has(bone.name)) result.set(bone.name, mesh.skeleton.boneInverses[i].clone().invert());
    });
  });
  return result;
}
const rotation = matrix => new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(matrix)).normalize();
const position = matrix => new Vector3().setFromMatrixPosition(matrix);

export function targetRig(root) {
  root.updateMatrixWorld(true);
  const { bones } = semanticBones(root);
  const bind = bindWorld(root);
  const ordered = [];
  root.traverse(b => { if (b.isBone) ordered.push(b); });
  // Skeleton.pose() assumes bone roots have identity parents, which these FBXs do not.
  for (const b of ordered) {
    const matrix = bind.get(b.name);
    if (matrix) b.quaternion.copy(b.parent.getWorldQuaternion(new Quaternion()).normalize().invert().multiply(rotation(matrix))).normalize();
    b.updateMatrixWorld(true);
  }
  const locals = ordered.map(b => [b, b.quaternion.clone()]);
  return { root, bones, bind, ordered, reset() { for (const [b, q] of locals) b.quaternion.copy(q); root.updateMatrixWorld(true); } };
}

function frame(direction, normal) {
  const y = direction.clone().normalize();
  const z = normal.clone().addScaledVector(y, -normal.dot(y)).normalize();
  if (y.lengthSq() < .9 || z.lengthSq() < .9) throw new Error('Degenerate anatomical frame');
  const x = new Vector3().crossVectors(y, z).normalize();
  z.crossVectors(x, y);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
}

// Meshless Rigify files have no bind matrices, and their initial pose is an A-pose
// with bent fingers. Calibrate bone axes from anatomical directions instead of
// treating that pose as a T-pose (which would add a permanent arm/finger offset).
function anatomicalCorrection(name, sourceBones, target) {
  const b = sourceBones.get(name), t = target.bones.get(name);
  const sq = b.getWorldQuaternion(new Quaternion());
  const targetReference = target.baseGaltisBind?.get(name) ?? target.bind.get(t.name);
  const tq = rotation(targetReference);
  const targetBindQ = rotation(target.bind.get(t.name));
  // Rigify's rest spine/hip curvature and leg roll are rig geometry, not a
  // performed sign. Transfer their motion relative to rest. Only the arms and
  // fingers need the A-pose's anatomical direction preserved across rigs.
  if (!/^(Bicep|Forearm|Hand|Thumb|Index|Middle|Ring|Pinky)/.test(name)) return sq.clone().invert().multiply(targetBindQ);
  const sDirection = new Vector3(0, 1, 0).applyQuaternion(sq);
  const tDirection = new Vector3(0, 1, 0).applyQuaternion(tq);
  let sn = new Vector3(0, 0, 1), tn = sn.clone();
  if (/^(Hand|Thumb|Index|Middle|Ring|Pinky)/.test(name)) {
    const side = name.at(-1);
    const palmNormal = get => {
      const hand = get(`Hand_${side}`), index = get(`Index1_${side}`), pinky = get(`Pinky1_${side}`);
      const middle = index.clone().add(pinky).multiplyScalar(.5).sub(hand);
      return new Vector3().crossVectors(index.clone().sub(pinky), middle).normalize();
    };
    sn = palmNormal(n => sourceBones.get(n).getWorldPosition(new Vector3()));
    tn = palmNormal(n => position(target.baseGaltisBind?.get(n) ?? target.bind.get(target.bones.get(n).name)));
  }
  const sf = frame(sDirection, sn), tf = frame(tDirection, tn);
  return sq.clone().invert().multiply(sf).multiply(tf.invert()).multiply(targetBindQ);
}

export function makeMappings(source, target, unrealReference) {
  source.updateMatrixWorld(true);
  target.reset();
  const { bones, family } = semanticBones(source);
  for (const side of ['L', 'R']) for (const n of ['Bicep', 'Forearm', 'Hand', 'Thumb1', 'Index1', 'Middle1', 'Ring1', 'Pinky1']) {
    if (!bones.has(`${n}_${side}`)) throw new Error(`Missing essential source bone ${n}_${side}`);
  }
  const sourceBind = bindWorld(source);
  const ue = semanticBones(unrealReference).bones, ueBind = bindWorld(unrealReference);
  const byBone = new Map([...target.bones].map(([n, b]) => [b, n]));
  const mappings = [];
  for (const t of target.ordered) {
    const name = byBone.get(t), s = bones.get(name);
    if (!s || !target.bind.has(t.name)) continue;
    let correction;
    if (family === 'rigify' || (!sourceBind.size && family !== 'unreal')) correction = anatomicalCorrection(name, bones, target);
    else {
      let reference = sourceBind.get(s.name);
      if (!reference && family === 'unreal') reference = ueBind.get(ue.get(name)?.name);
      // Mini and Mixamo are exports of the same StudioGalt bone axes as the
      // old mesh. Use that shared bind reference, NOT a recording's first pose.
      if (!reference && (family === 'galtis' || family === 'mixamo')) reference = target.baseGaltisBind?.get(name) ?? target.bind.get(t.name);
      if (!reference) throw new Error(`No bind reference for ${name}`);
      correction = rotation(reference).invert().multiply(rotation(target.bind.get(t.name)));
    }
    mappings.push({ name, s, t, correction });
  }
  return { mappings, family };
}

// Quaternion Ramer-Douglas-Peucker: bound interpolation error rather than simply
// throwing away every other sample. Fingers use the same tight angular tolerance.
function reduce(times, values, tolerance = .001) {
  const count = times.length, keep = new Set([0, count - 1]), stack = [[0, count - 1]];
  const a = new Quaternion(), b = new Quaternion(), q = new Quaternion(), actual = new Quaternion();
  while (stack.length) {
    const [start, end] = stack.pop();
    if (end <= start + 1) continue;
    a.fromArray(values, start * 4).normalize(); b.fromArray(values, end * 4).normalize();
    let max = tolerance, split = -1;
    for (let i = start + 1; i < end; i++) {
      q.copy(a).slerp(b, (times[i] - times[start]) / (times[end] - times[start]));
      const error = q.angleTo(actual.fromArray(values, i * 4).normalize());
      if (error > max) { max = error; split = i; }
    }
    if (split !== -1) { keep.add(split); stack.push([start, split], [split, end]); }
  }
  const indices = [...keep].sort((a, b) => a - b);
  return { times: indices.map(i => times[i]), values: indices.flatMap(i => values.slice(i * 4, i * 4 + 4)) };
}

export function retargetClip(source, clip, target, reference, options = {}) {
  if (!clip?.tracks.length || !Number.isFinite(clip.duration) || clip.duration <= 0) throw new Error('No usable animation');
  const { mappings, family } = makeMappings(source, target, reference);
  const mixer = new AnimationMixer(source);
  const action = mixer.clipAction(clip).setLoop(LoopOnce, 1);
  action.clampWhenFinished = true; action.play();
  const fps = options.fps ?? 30;
  // StudioGalt T-pose exports include two setup frames. Rigify starts in its A-pose.
  const start = options.trimStart ?? (family === 'rigify' ? 0 : Math.min(2 / fps, clip.duration / 4));
  const duration = clip.duration - start;
  const frames = Math.max(2, Math.ceil(duration * fps) + 1);
  const times = Array.from({ length: frames }, (_, i) => i * duration / (frames - 1));
  const values = mappings.map(() => []);
  const world = new Quaternion(), parent = new Quaternion(), tempMatrix = new Matrix4();
  const mappingIndex = new Map(mappings.map((m, i) => [m.t, i]));
  const targetWorld = new Map(target.ordered.map(b => [b, b.getWorldQuaternion(new Quaternion())]));
  const parentWorld = new Map(target.ordered.filter(b => !targetWorld.has(b.parent)).map(b => [b.parent, b.parent.getWorldQuaternion(new Quaternion())]));
  for (const time of times) {
    mixer.setTime(Math.min(start + time, clip.duration - 1e-6));
    source.updateMatrixWorld(true);
    // Evaluate the hierarchy once in parent-first order. Updating every bone's
    // entire subtree per sample is quadratic and makes a large archive needlessly slow.
    for (const t of target.ordered) {
      const parentQ = targetWorld.get(t.parent) ?? parentWorld.get(t.parent);
      const i = mappingIndex.get(t);
      if (i === undefined) { targetWorld.get(t).copy(parentQ).multiply(t.quaternion); continue; }
      const { s, correction } = mappings[i];
      world.setFromRotationMatrix(tempMatrix.extractRotation(s.matrixWorld)).normalize().multiply(correction);
      t.quaternion.copy(parent.copy(parentQ).invert().multiply(world)).normalize();
      if (values[i].length) {
        const v = values[i], p = v.length - 4;
        if (t.quaternion.x * v[p] + t.quaternion.y * v[p + 1] + t.quaternion.z * v[p + 2] + t.quaternion.w * v[p + 3] < 0) {
          t.quaternion.set(-t.quaternion.x, -t.quaternion.y, -t.quaternion.z, -t.quaternion.w);
        }
      }
      t.quaternion.toArray(values[i], values[i].length);
      targetWorld.get(t).copy(parentQ).multiply(t.quaternion);
    }
  }
  const tracks = mappings.map(({ t }, i) => {
    const reduced = reduce(times, values[i], options.tolerance ?? .001);
    return new QuaternionKeyframeTrack(`${t.name}.quaternion`, reduced.times, reduced.values);
  });
  mixer.stopAllAction(); mixer.uncacheRoot(source); target.reset();
  // The runtime starts in the model's recorded pose, not its bind pose. Bind
  // unmapped deform helpers too, so prior signs cannot leave stale wrist/palm,
  // knee, or corrective-bone rotations underneath a newly retargeted clip.
  for (const bone of target.ordered) {
    if (mappingIndex.has(bone) || !target.bind.has(bone.name)) continue;
    const q = bone.quaternion.toArray();
    tracks.push(new QuaternionKeyframeTrack(`${bone.name}.quaternion`, [0, duration], [...q, ...q]));
  }
  const output = AnimationClip.toJSON(new AnimationClip(clip.name, duration, tracks));
  output.tracks.forEach(t => {
    t.times = t.times.map(v => +v.toFixed(5));
    t.values = t.values.map(v => +v.toFixed(t.type === 'quaternion' ? 4 : 3));
  });
  assignClipIdentity(output);
  validateClip(output, target.root);
  return { output, family, mappedBones: mappings.length };
}

export function validateClip(json, root) {
  const clip = AnimationClip.parse(json);
  if (!clip.validate() || !clip.tracks.length) throw new Error('Invalid serialized clip');
  for (const t of clip.tracks) {
    if (!root.getObjectByName(t.name.split('.')[0])) throw new Error(`Unbound track ${t.name}`);
    if (![...t.times, ...t.values].every(Number.isFinite)) throw new Error(`Non-finite track ${t.name}`);
    for (let i = 0; i < t.values.length; i += 4) {
      const norm = Math.hypot(...t.values.slice(i, i + 4));
      if (Math.abs(norm - 1) > .0003) throw new Error(`Invalid quaternion ${t.name}`);
    }
  }
  return clip;
}

export function disposeFBX(root) {
  root.traverse(o => {
    o.geometry?.dispose();
    for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) m.dispose();
  });
  root.clear();
}
