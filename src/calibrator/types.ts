import type { ApplePolarity } from '../game/types';

export interface CalibrationWorldScale {
  x: number;
  y: number;
  z: number;
}

export interface CalibrationCamera {
  x: number;
  y: number;
  z: number;
  lookAtX: number;
  lookAtY: number;
  lookAtZ: number;
  fov: number;
}

export interface CalibrationLighting {
  hemi: number;
  key: number;
  back: number;
  ambient: number;
}

export interface CalibrationApplePlacement {
  u: number;
  laneIndex: number;
  polarity: ApplePolarity;
}

export interface CalibrationSettings {
  worldScale: CalibrationWorldScale;
  camera: CalibrationCamera;
  lighting: CalibrationLighting;
  seed: number;
  applePlacements: CalibrationApplePlacement[];
}
