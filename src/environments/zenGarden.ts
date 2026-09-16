import * as THREE from 'three';
import { EnvironmentDefinition, EnvironmentInstance } from './types';

export const zenGardenEnvironment: EnvironmentDefinition = {
  id: 'zen_garden',
  name: 'Zen Sakura Garden',
  tagline: 'Moonlit Serene Garden with Falling Cherry Blossom Petals',
  category: 'Nature',
  accentColor: '#f472b6',
  badgeBg: 'bg-rose-950/60 text-rose-200 border-rose-400/40',
  bgColor: 0x161e19,
  fogColor: 0x161e19,
  fogDensity: 0.024,
  ambientLightColor: 0x1c2b22,
  ambientLightIntensity: 1.6,
  keyLightColor: 0xfff1f2,
  keyLightIntensity: 2.1,
  rimLightColor: 0xf472b6,
  rimLightIntensity: 1.8,
  build: (glowHex: number): EnvironmentInstance => {
    const group = new THREE.Group();

    // 1. Zen Stepping Stone Platform (Dark River Granite)
    const stoneGeo = new THREE.CylinderGeometry(1.6, 1.75, 0.18, 36);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x1f2621,
      metalness: 0.2,
      roughness: 0.7,
    });
    const stonePlatform = new THREE.Mesh(stoneGeo, stoneMat);
    stonePlatform.position.y = -0.09;
    stonePlatform.receiveShadow = true;
    group.add(stonePlatform);

    // Inner Bamboo / Sand Concentric Ring
    const sandRingGeo = new THREE.RingGeometry(1.2, 1.28, 48);
    const sandRingMat = new THREE.MeshStandardMaterial({
      color: 0x2e3b31,
      side: THREE.DoubleSide,
      roughness: 0.8,
    });
    const sandRing = new THREE.Mesh(sandRingGeo, sandRingMat);
    sandRing.rotation.x = -Math.PI / 2;
    sandRing.position.y = 0.005;
    group.add(sandRing);

    // Bamboo Lantern Glowing Post
    const lanternGroup = new THREE.Group();
    lanternGroup.position.set(-1.8, 0, -1.2);

    const postGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.6, 12);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.8 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 0.8;
    lanternGroup.add(post);

    const boxGeo = new THREE.BoxGeometry(0.24, 0.3, 0.24);
    const boxMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 });
    const lanternLightBox = new THREE.Mesh(boxGeo, boxMat);
    lanternLightBox.position.y = 1.45;
    lanternGroup.add(lanternLightBox);

    group.add(lanternGroup);

    // 2. Falling Sakura (Cherry Blossom) Petals (300 Petals)
    const petalCount = 300;
    const petalGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(petalCount * 3);
    const rotations = new Float32Array(petalCount);
    const speeds = new Float32Array(petalCount);
    const sways = new Float32Array(petalCount);

    for (let i = 0; i < petalCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = Math.random() * 5 + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 0.5;
      rotations[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.25 + Math.random() * 0.35;
      sways[i] = Math.random() * 2 + 1;
    }
    petalGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const petalMat = new THREE.PointsMaterial({
      color: 0xfbcfe8,
      size: 0.11,
      transparent: true,
      opacity: 0.8,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const petals = new THREE.Points(petalGeo, petalMat);
    group.add(petals);

    const onAnimate = (delta: number, elapsed: number) => {
      // Gentle lantern flame flicker
      lanternLightBox.scale.setScalar(0.98 + Math.sin(elapsed * 8) * 0.04);

      // Sakura petals falling and drifting gracefully
      const pos = petalGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < petalCount; i++) {
        // Fall downwards
        pos[i * 3 + 1] -= delta * speeds[i];

        // Horizontal sinusoidal sway like a falling leaf
        pos[i * 3] += Math.sin(elapsed * sways[i] + i) * 0.003;
        pos[i * 3 + 2] += Math.cos(elapsed * (sways[i] * 0.7) + i) * 0.002;

        // Reset to top when touching ground
        if (pos[i * 3 + 1] < 0) {
          pos[i * 3 + 1] = 5.0 + Math.random();
          pos[i * 3] = (Math.random() - 0.5) * 8;
        }
      }
      petalGeo.attributes.position.needsUpdate = true;
    };

    const dispose = () => {
      stoneGeo.dispose();
      stoneMat.dispose();
      sandRingGeo.dispose();
      sandRingMat.dispose();
      postGeo.dispose();
      postMat.dispose();
      boxGeo.dispose();
      boxMat.dispose();
      petalGeo.dispose();
      petalMat.dispose();
    };

    return { group, onAnimate, dispose };
  },
};
