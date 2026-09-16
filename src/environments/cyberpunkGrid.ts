import * as THREE from 'three';
import { EnvironmentDefinition, EnvironmentInstance } from './types';

export const cyberpunkGridEnvironment: EnvironmentDefinition = {
  id: 'cyberpunk_grid',
  name: 'Cyberpunk Grid',
  tagline: 'Neon Laser Grid & Holographic High-Tech Cityscape',
  category: 'Futuristic',
  accentColor: '#00f3ff',
  badgeBg: 'bg-cyan-950/60 text-cyan-200 border-cyan-400/40',
  bgColor: 0x070913,
  fogColor: 0x070913,
  fogDensity: 0.028,
  ambientLightColor: 0x0a192f,
  ambientLightIntensity: 1.5,
  keyLightColor: 0x00f3ff,
  keyLightIntensity: 2.4,
  rimLightColor: 0xff007f,
  rimLightIntensity: 2.2,
  build: (glowHex: number): EnvironmentInstance => {
    const group = new THREE.Group();

    // 1. Neon Grid Ground Plane
    const gridHelper = new THREE.GridHelper(30, 40, 0x00f3ff, 0x1f2942);
    gridHelper.position.y = -0.05;
    group.add(gridHelper);

    // 2. High-Tech Hexagonal Cyber Podium
    const hexGeo = new THREE.CylinderGeometry(1.5, 1.65, 0.15, 6);
    const hexMat = new THREE.MeshStandardMaterial({
      color: 0x0d111d,
      metalness: 0.95,
      roughness: 0.12,
    });
    const hexPodium = new THREE.Mesh(hexGeo, hexMat);
    hexPodium.position.y = -0.075;
    hexPodium.receiveShadow = true;
    group.add(hexPodium);

    // Glowing Cyan Hex Ring Wireframe
    const hexWireGeo = new THREE.EdgesGeometry(hexGeo);
    const hexWireMat = new THREE.LineBasicMaterial({
      color: 0x00f3ff,
      linewidth: 2,
    });
    const hexWire = new THREE.LineSegments(hexWireGeo, hexWireMat);
    hexWire.position.y = -0.075;
    group.add(hexWire);

    // Inner Neon Ring Pulse
    const innerRingGeo = new THREE.RingGeometry(1.0, 1.05, 36);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xff007f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.005;
    group.add(innerRing);

    // 3. Background Holographic Cyber Monoliths (Distant Skyline)
    const monolithsCount = 14;
    const monolithsGeo = new THREE.BoxGeometry(0.6, 6.0, 0.6);
    const monolithsMat = new THREE.MeshStandardMaterial({
      color: 0x0b1329,
      metalness: 0.8,
      roughness: 0.3,
    });

    const monolithEdgesMat = new THREE.LineBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.45,
    });

    for (let i = 0; i < monolithsCount; i++) {
      const angle = (i / monolithsCount) * Math.PI * 1.6 - Math.PI * 0.8;
      const radius = 9 + Math.random() * 3;
      const heightScale = 0.5 + Math.random() * 1.2;

      const monolith = new THREE.Mesh(monolithsGeo, monolithsMat);
      monolith.position.set(Math.sin(angle) * radius, heightScale * 3 - 2, -Math.cos(angle) * radius);
      monolith.scale.set(1 + Math.random() * 0.5, heightScale, 1 + Math.random() * 0.5);

      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(monolithsGeo), monolithEdgesMat);
      monolith.add(wire);
      group.add(monolith);
    }

    // 4. Upward Rising Cyber Data Dust Particles
    const particleCount = 350;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = Math.random() * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 1;
      speeds[i] = 0.4 + Math.random() * 0.8;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x00f3ff,
      size: 0.08,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    group.add(particleSystem);

    const onAnimate = (delta: number, elapsed: number) => {
      // Pulse inner ring
      innerRing.rotation.z -= delta * 0.4;
      innerRingMat.opacity = 0.6 + Math.sin(elapsed * 3) * 0.25;

      // Ascending data dust
      const pos = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        pos[i * 3 + 1] += delta * speeds[i];
        if (pos[i * 3 + 1] > 6) {
          pos[i * 3 + 1] = 0;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;
    };

    const dispose = () => {
      gridHelper.dispose();
      hexGeo.dispose();
      hexMat.dispose();
      hexWireGeo.dispose();
      hexWireMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
      monolithsGeo.dispose();
      monolithsMat.dispose();
      monolithEdgesMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };

    return { group, onAnimate, dispose };
  },
};
