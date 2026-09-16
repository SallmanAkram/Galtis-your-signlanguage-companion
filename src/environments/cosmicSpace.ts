import * as THREE from 'three';
import { EnvironmentDefinition, EnvironmentInstance } from './types';

export const cosmicSpaceEnvironment: EnvironmentDefinition = {
  id: 'cosmic_space',
  name: 'Cosmic Nebula',
  tagline: 'Deep Interstellar Void with Starfield & Nebula Cloud',
  category: 'Sci-Fi',
  accentColor: '#38bdf8',
  badgeBg: 'bg-sky-950/60 text-sky-200 border-sky-400/40',
  bgColor: 0x02030a,
  fogColor: 0x02030a,
  fogDensity: 0.015,
  ambientLightColor: 0x0d1326,
  ambientLightIntensity: 1.4,
  keyLightColor: 0xe0f2fe,
  keyLightIntensity: 2.3,
  rimLightColor: 0x818cf8,
  rimLightIntensity: 2.0,
  build: (glowHex: number): EnvironmentInstance => {
    const group = new THREE.Group();

    // 1. Deep Space Starfield (1,400 Stars)
    const starCount = 1400;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      // Distribute stars on outer sphere
      const r = 18 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);

      // Star hues: bluish-white, silver, gentle amber
      const tint = Math.random();
      if (tint > 0.7) {
        starColors[i * 3] = 0.6; // R
        starColors[i * 3 + 1] = 0.8; // G
        starColors[i * 3 + 2] = 1.0; // B
      } else if (tint > 0.4) {
        starColors[i * 3] = 1.0;
        starColors[i * 3 + 1] = 0.95;
        starColors[i * 3 + 2] = 0.8;
      } else {
        starColors[i * 3] = 0.9;
        starColors[i * 3 + 1] = 0.9;
        starColors[i * 3 + 2] = 1.0;
      }
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    const starfield = new THREE.Points(starGeo, starMat);
    group.add(starfield);

    // 2. Swirling Nebula Stardust Ring
    const nebulaCount = 500;
    const nebulaGeo = new THREE.BufferGeometry();
    const nebulaPositions = new Float32Array(nebulaCount * 3);

    for (let i = 0; i < nebulaCount; i++) {
      const radius = 3.5 + Math.random() * 4.5;
      const angle = Math.random() * Math.PI * 2;
      nebulaPositions[i * 3] = Math.cos(angle) * radius;
      nebulaPositions[i * 3 + 1] = (Math.random() - 0.5) * 2.0;
      nebulaPositions[i * 3 + 2] = Math.sin(angle) * radius - 2;
    }
    nebulaGeo.setAttribute('position', new THREE.BufferAttribute(nebulaPositions, 3));

    const nebulaMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.25,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const nebulaPoints = new THREE.Points(nebulaGeo, nebulaMat);
    group.add(nebulaPoints);

    // 3. Dark Obsidian Cosmic Platform
    const platformGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.2, 40);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x060913,
      metalness: 0.95,
      roughness: 0.1,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -0.1;
    platform.receiveShadow = true;
    group.add(platform);

    // Constellation Glowing Celestial Orbit Ring
    const orbitRingGeo = new THREE.RingGeometry(1.35, 1.38, 64);
    const orbitRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRing.rotation.x = -Math.PI / 2;
    orbitRing.position.y = 0.005;
    group.add(orbitRing);

    // Mini orbiting celestial moon satellite
    const moonGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    group.add(moon);

    const onAnimate = (delta: number, elapsed: number) => {
      // Rotate deep starfield slowly
      starfield.rotation.y += delta * 0.015;
      starfield.rotation.x += delta * 0.005;

      // Swirl nebula dust
      nebulaPoints.rotation.y -= delta * 0.04;

      // Orbiting celestial beacon
      const moonAngle = elapsed * 0.8;
      moon.position.set(Math.cos(moonAngle) * 1.365, 0.06, Math.sin(moonAngle) * 1.365);
    };

    const dispose = () => {
      starGeo.dispose();
      starMat.dispose();
      nebulaGeo.dispose();
      nebulaMat.dispose();
      platformGeo.dispose();
      platformMat.dispose();
      orbitRingGeo.dispose();
      orbitRingMat.dispose();
      moonGeo.dispose();
      moonMat.dispose();
    };

    return { group, onAnimate, dispose };
  },
};
