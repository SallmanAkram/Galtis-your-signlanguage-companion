import * as THREE from 'three';

export type EnvironmentId =
  | 'studio_mist'
  | 'cyberpunk_grid'
  | 'cosmic_space'
  | 'zen_garden'
  | 'sunset_horizon'
  | 'deep_ocean';

export interface EnvironmentInstance {
  group: THREE.Group;
  onAnimate: (delta: number, elapsed: number) => void;
  dispose: () => void;
}

export interface EnvironmentDefinition {
  id: EnvironmentId;
  name: string;
  tagline: string;
  category: 'Studio' | 'Futuristic' | 'Sci-Fi' | 'Nature' | 'Atmospheric' | 'Aquatic';
  accentColor: string;
  badgeBg: string;
  bgColor: number;
  fogColor: number;
  fogDensity: number;
  ambientLightColor: number;
  ambientLightIntensity: number;
  keyLightColor: number;
  keyLightIntensity: number;
  rimLightColor: number;
  rimLightIntensity: number;
  build: (glowHex: number) => EnvironmentInstance;
}
