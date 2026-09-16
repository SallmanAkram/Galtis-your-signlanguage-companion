import { EnvironmentDefinition, EnvironmentId } from './types';
import { studioMistEnvironment } from './studioMist';
import { cyberpunkGridEnvironment } from './cyberpunkGrid';
import { cosmicSpaceEnvironment } from './cosmicSpace';
import { zenGardenEnvironment } from './zenGarden';
import { sunsetHorizonEnvironment } from './sunsetHorizon';
import { deepOceanEnvironment } from './deepOcean';

export * from './types';

export const ALL_ENVIRONMENTS: EnvironmentDefinition[] = [
  studioMistEnvironment,
  cyberpunkGridEnvironment,
  cosmicSpaceEnvironment,
  zenGardenEnvironment,
  sunsetHorizonEnvironment,
  deepOceanEnvironment,
];

export const ENVIRONMENTS_BY_ID: Record<EnvironmentId, EnvironmentDefinition> = {
  studio_mist: studioMistEnvironment,
  cyberpunk_grid: cyberpunkGridEnvironment,
  cosmic_space: cosmicSpaceEnvironment,
  zen_garden: zenGardenEnvironment,
  sunset_horizon: sunsetHorizonEnvironment,
  deep_ocean: deepOceanEnvironment,
};

export const getEnvironment = (id?: string | EnvironmentId): EnvironmentDefinition => {
  if (id && id in ENVIRONMENTS_BY_ID) {
    return ENVIRONMENTS_BY_ID[id as EnvironmentId];
  }
  return studioMistEnvironment;
};
