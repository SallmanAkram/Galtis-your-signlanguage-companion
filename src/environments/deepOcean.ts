import * as THREE from 'three';
import { EnvironmentDefinition, EnvironmentInstance } from './types';

export const deepOceanEnvironment: EnvironmentDefinition = {
  id: 'deep_ocean',
  name: 'Deep Ocean Bioluminescence',
  tagline: 'Abyssal Marine Waters with Rising Air Bubbles & Plankton',
  category: 'Aquatic',
  accentColor: '#06b6d4',
  badgeBg: 'bg-teal-950/60 text-teal-200 border-teal-400/40',
  bgColor: 0x030f1c,
  fogColor: 0x030f1c,
  fogDensity: 0.03,
  ambientLightColor: 0x061e38,
  ambientLightIntensity: 1.7,
  keyLightColor: 0xcffafe,
  keyLightIntensity: 2.2,
  rimLightColor: 0x0284c7,
  rimLightIntensity: 2.3,
  build: (glowHex: number): EnvironmentInstance => {
    const group = new THREE.Group();

    // 1. Abyssal Trench Submersible Platform (Deep Navy Metallic)
    const trenchGeo = new THREE.CylinderGeometry(1.6, 1.75, 0.18, 48);
    const trenchMat = new THREE.MeshStandardMaterial({
      color: 0x091a29,
      metalness: 0.85,
      roughness: 0.25,
    });
    const trenchMesh = new THREE.Mesh(trenchGeo, trenchMat);
    trenchMesh.position.y = -0.09;
    trenchMesh.receiveShadow = true;
    group.add(trenchMesh);

    // Bioluminescent Sonar Pulse Ring
    const sonarRingGeo = new THREE.RingGeometry(1.2, 1.25, 48);
    const sonarRingMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const sonarRing = new THREE.Mesh(sonarRingGeo, sonarRingMat);
    sonarRing.rotation.x = -Math.PI / 2;
    sonarRing.position.y = 0.005;
    group.add(sonarRing);

    // Outer Bioluminescent Coral Accent Ring
    const outerRingGeo = new THREE.RingGeometry(1.48, 1.5, 48);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.005;
    group.add(outerRing);

    // 2. Rising Bubbles and Bioluminescent Plankton (320 Particles)
    const bubbleCount = 320;
    const bubbleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(bubbleCount * 3);
    const bubbleSpeeds = new Float32Array(bubbleCount);
    const bubbleWobbles = new Float32Array(bubbleCount);

    for (let i = 0; i < bubbleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = Math.random() * 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 7 - 1;
      bubbleSpeeds[i] = 0.35 + Math.random() * 0.55;
      bubbleWobbles[i] = Math.random() * 3 + 1.5;
    }
    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const bubbleMat = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 0.12,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const bubbles = new THREE.Points(bubbleGeo, bubbleMat);
    group.add(bubbles);

    const onAnimate = (delta: number, elapsed: number) => {
      // Rotate sonar ring
      sonarRing.rotation.z += delta * 0.2;
      sonarRingMat.opacity = 0.5 + Math.sin(elapsed * 2.5) * 0.3;

      // Rising bubbles with sinusoidal underwater buoyancy
      const pos = bubbleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < bubbleCount; i++) {
        pos[i * 3 + 1] += delta * bubbleSpeeds[i];
        pos[i * 3] += Math.sin(elapsed * bubbleWobbles[i] + i) * 0.002;

        // Reset to ocean floor
        if (pos[i * 3 + 1] > 5.5) {
          pos[i * 3 + 1] = -0.1;
          pos[i * 3] = (Math.random() - 0.5) * 8;
        }
      }
      bubbleGeo.attributes.position.needsUpdate = true;
    };

    const dispose = () => {
      trenchGeo.dispose();
      trenchMat.dispose();
      sonarRingGeo.dispose();
      sonarRingMat.dispose();
      outerRingGeo.dispose();
      outerRingMat.dispose();
      bubbleGeo.dispose();
      bubbleMat.dispose();
    };

    return { group, onAnimate, dispose };
  },
};
