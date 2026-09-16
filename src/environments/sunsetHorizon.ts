import * as THREE from 'three';
import { EnvironmentDefinition, EnvironmentInstance } from './types';

export const sunsetHorizonEnvironment: EnvironmentDefinition = {
  id: 'sunset_horizon',
  name: 'Sunset Horizon',
  tagline: 'Warm Golden Hour Loft with Floating Amber Bokeh Motes',
  category: 'Atmospheric',
  accentColor: '#f97316',
  badgeBg: 'bg-amber-950/60 text-amber-200 border-amber-400/40',
  bgColor: 0x240d18,
  fogColor: 0x240d18,
  fogDensity: 0.022,
  ambientLightColor: 0x3d1722,
  ambientLightIntensity: 1.8,
  keyLightColor: 0xffedd5,
  keyLightIntensity: 2.3,
  rimLightColor: 0xf97316,
  rimLightIntensity: 2.4,
  build: (glowHex: number): EnvironmentInstance => {
    const group = new THREE.Group();

    // 1. Sleek Modern Architectural Loft Stage (Warm Espresso & Bronze)
    const loftGeo = new THREE.CylinderGeometry(1.65, 1.8, 0.18, 48);
    const loftMat = new THREE.MeshStandardMaterial({
      color: 0x1c1214,
      metalness: 0.6,
      roughness: 0.25,
    });
    const loftMesh = new THREE.Mesh(loftGeo, loftMat);
    loftMesh.position.y = -0.09;
    loftMesh.receiveShadow = true;
    group.add(loftMesh);

    // Warm Sunset Inlaid Bronze Ring
    const bronzeRingGeo = new THREE.RingGeometry(1.25, 1.3, 48);
    const bronzeRingMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.9,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });
    const bronzeRing = new THREE.Mesh(bronzeRingGeo, bronzeRingMat);
    bronzeRing.rotation.x = -Math.PI / 2;
    bronzeRing.position.y = 0.005;
    group.add(bronzeRing);

    // Subtle Horizon Sun Arc in Background
    const sunArcGeo = new THREE.RingGeometry(4.8, 4.88, 64, 1, 0, Math.PI);
    const sunArcMat = new THREE.MeshBasicMaterial({
      color: 0xfb923c,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });
    const sunArc = new THREE.Mesh(sunArcGeo, sunArcMat);
    sunArc.position.set(0, -0.4, -4.5);
    group.add(sunArc);

    // 2. Floating Golden Sun-Dust / Bokeh Motes (260 particles)
    const moteCount = 260;
    const moteGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(moteCount * 3);
    const scales = new Float32Array(moteCount);

    for (let i = 0; i < moteCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = Math.random() * 4.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 7 - 1.5;
      scales[i] = Math.random() * 0.15 + 0.05;
    }
    moteGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const moteMat = new THREE.PointsMaterial({
      color: 0xfde047,
      size: 0.14,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const motes = new THREE.Points(moteGeo, moteMat);
    group.add(motes);

    const onAnimate = (delta: number, elapsed: number) => {
      // Gentle lazy drifting of warm golden motes in sunlight
      const pos = moteGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < moteCount; i++) {
        pos[i * 3 + 1] += Math.sin(elapsed * 0.8 + i) * 0.001;
        pos[i * 3] += Math.cos(elapsed * 0.5 + i) * 0.0012;
      }
      moteGeo.attributes.position.needsUpdate = true;

      // Pulse sun arc
      sunArcMat.opacity = 0.22 + Math.sin(elapsed * 1.5) * 0.06;
    };

    const dispose = () => {
      loftGeo.dispose();
      loftMat.dispose();
      bronzeRingGeo.dispose();
      bronzeRingMat.dispose();
      sunArcGeo.dispose();
      sunArcMat.dispose();
      moteGeo.dispose();
      moteMat.dispose();
    };

    return { group, onAnimate, dispose };
  },
};
