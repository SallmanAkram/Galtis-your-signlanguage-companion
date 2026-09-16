// Local, reproducible visual QA. This page is not a production build entry.
import * as THREE from 'three';
import { GaltisOriginalAvatar, KNOWN_MOCAP_WORDS } from '../src/components/GaltisOriginalAvatar';
const stage = document.querySelector<HTMLElement>('#stage')!;
const select = document.querySelector<HTMLSelectElement>('#sample')!;
const slider = document.querySelector<HTMLInputElement>('#progress')!;
const status = document.querySelector<HTMLElement>('#status')!;
for (const [word, file] of Object.entries({ 'APPLE 1': 'apple_1', 'ASSIGN 1': 'assign_1', DABBLE: 'dabble' })) KNOWN_MOCAP_WORDS[word] = `/animations/${file}.json`;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); stage.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#242131');
const camera = new THREE.PerspectiveCamera(32, 1, .01, 100);
camera.position.set(0, 1.25, 3.2); camera.lookAt(0, 1, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x777799, 2.5));
const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(-2, 4, 3); scene.add(light);
const resize = () => { renderer.setSize(stage.clientWidth, stage.clientHeight); camera.aspect = stage.clientWidth / stage.clientHeight; camera.updateProjectionMatrix(); };
window.addEventListener('resize', resize); resize();
let avatar: GaltisOriginalAvatar;
await new Promise<void>(resolve => { avatar = new GaltisOriginalAvatar('full_mesh', resolve); });
scene.add(avatar!.root);
let playing = false, elapsed = 0, duration = 1, last = performance.now(), version = 0;
async function sample() {
  const current = ++version; playing = false;
  status.textContent = `Loading ${select.value}…`;
  if (!await avatar!.prepareMocapClip(select.value)) { status.textContent = 'FAILED to load clip'; return; }
  if (current !== version) return;
  const result = avatar!.playMocapClip(select.value);
  duration = result.durationMs / 1000;
  elapsed = Number(slider.value) * duration;
  avatar!.update(elapsed, elapsed, 1); avatar!.root.updateMatrixWorld(true);
  status.textContent = `${select.value} · ${duration.toFixed(3)} seconds · ${(Number(slider.value) * 100).toFixed(0)}% · Galtis full mesh`;
}
select.addEventListener('change', () => void sample());
slider.addEventListener('input', () => void sample());
document.querySelector('#middle')!.addEventListener('click', () => { slider.value = '.5'; void sample(); });
document.querySelector('#play')!.addEventListener('click', async () => { slider.value = '0'; await sample(); playing = true; });
function render(now: number) {
  const delta = Math.min((now - last) / 1000, .05); last = now;
  if (playing) { avatar!.update(delta, elapsed, 1); elapsed += delta; slider.value = String(Math.min(1, elapsed / duration)); if (elapsed >= duration) playing = false; }
  renderer.render(scene, camera); requestAnimationFrame(render);
}
await sample(); requestAnimationFrame(render);
