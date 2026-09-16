import * as THREE from 'three';
import { EnvironmentDefinition, EnvironmentInstance } from './types';

export const studioMistEnvironment: EnvironmentDefinition = {
  id: 'studio_mist',
  name: 'Studio Mist',
  tagline: 'Authentic Deep Purple Studio with Drifting Mist',
  category: 'Studio',
  accentColor: '#9333ea',
  badgeBg: 'bg-purple-900/60 text-purple-200 border-purple-500/40',
  bgColor: 0x26004d,
  fogColor: 0x26004d,
  fogDensity: 0.025,
  ambientLightColor: 0x202436,
  ambientLightIntensity: 1.8,
  keyLightColor: 0xffffff,
  keyLightIntensity: 2.2,
  rimLightColor: 0x7090ff,
  rimLightIntensity: 1.6,
  build: (glowHex: number): EnvironmentInstance => {
    const group = new THREE.Group();

    // Metallic Base Disc
    const baseGeo = new THREE.CylinderGeometry(1.6, 1.75, 0.2, 48);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0c0f17,
      metalness: 0.9,
      roughness: 0.18,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = -0.1;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // Inner Glowing Ring
    const ringGeo = new THREE.RingGeometry(1.2, 1.25, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: glowHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.005;
    group.add(ringMesh);

    // Outer Edge Accent Ring
    const outerRingGeo = new THREE.RingGeometry(1.48, 1.5, 48);
    const outerRingMesh = new THREE.Mesh(outerRingGeo, ringMat);
    outerRingMesh.rotation.x = -Math.PI / 2;
    outerRingMesh.position.y = 0.005;
    group.add(outerRingMesh);

    // Central circular stage podium
    const podiumGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.06, 36);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x121724,
      metalness: 0.85,
      roughness: 0.3,
    });
    const podiumMesh = new THREE.Mesh(podiumGeo, podiumMat);
    podiumMesh.position.y = 0.03;
    podiumMesh.receiveShadow = true;
    group.add(podiumMesh);

    // Volumetric Mist Cloud Particles in Background
    const mistCount = 280;
    const mistGeo = new THREE.BufferGeometry();
    const mistPos = new Float32Array(mistCount * 3);

    for (let i = 0; i < mistCount; i++) {
      mistPos[i * 3] = (Math.random() - 0.5) * 12;
      mistPos[i * 3 + 1] = Math.random() * 4 - 0.2;
      mistPos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2.5;
    }
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));

    const mistMat = new THREE.PointsMaterial({
      color: glowHex,
      size: 0.12,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mistPoints = new THREE.Points(mistGeo, mistMat);
    group.add(mistPoints);

    const onAnimate = (delta: number, elapsed: number) => {
      // Rotate glowing rings slowly
      ringMesh.rotation.z += delta * 0.15;
      outerRingMesh.rotation.z -= delta * 0.1;

      // Drift mist particles
      const positions = mistGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < mistCount; i++) {
        positions[i * 3] += Math.sin(elapsed * 0.5 + i) * 0.0015;
        positions[i * 3 + 1] += Math.cos(elapsed * 0.3 + i) * 0.0008;
      }
      mistGeo.attributes.position.needsUpdate = true;
    };

    const dispose = () => {
      baseGeo.dispose();
      baseMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      outerRingGeo.dispose();
      podiumGeo.dispose();
      podiumMat.dispose();
      mistGeo.dispose();
      mistMat.dispose();
    };

    return { group, onAnimate, dispose };
  },
};
