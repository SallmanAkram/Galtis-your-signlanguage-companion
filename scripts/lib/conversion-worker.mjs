import { parentPort } from 'node:worker_threads';
import { loadFBX, targetRig, retargetClip, disposeFBX, assignClipIdentity } from './retarget.mjs';

const full = targetRig(loadFBX('public/models/galtis_mesh.fbx'));
const hello = targetRig(loadFBX('public/models/galtis_hello.fbx'));
const baseBind = new Map([...full.bones].map(([key, b]) => [key, full.bind.get(b.name)]));
full.baseGaltisBind = baseBind; hello.baseGaltisBind = baseBind;
parentPort.on('message', ({ path, word }) => {
  let source;
  try {
    source = loadFBX(path);
    const clip = source.animations[0];
    const baked = retargetClip(source, clip, full, hello.root);
    const secondary = retargetClip(source, clip, hello, hello.root);
    baked.output.name = word; secondary.output.name = word;
    assignClipIdentity(baked.output); assignClipIdentity(secondary.output);
    parentPort.postMessage({ outputText: JSON.stringify(baked.output), secondaryText: JSON.stringify(secondary.output),
      family: baked.family, durationSec: baked.output.duration, mappedBones: baked.mappedBones, sourceClips: source.animations.length });
  } catch (error) { parentPort.postMessage({ error: error.message }); }
  finally { if (source) disposeFBX(source); }
});
