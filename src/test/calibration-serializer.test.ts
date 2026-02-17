import { describe, expect, it } from 'vitest';

import { exportCalibrationPatch, parseCalibrationSettings, serializeCalibrationSettings } from '../calibrator/serializer';
import type { CalibrationSettings } from '../calibrator/types';

function createSettings(): CalibrationSettings {
  return {
    worldScale: { x: 1.2, y: 2.4, z: 0.9 },
    camera: {
      x: 10,
      y: 8,
      z: 1.5,
      lookAtX: 0,
      lookAtY: 0.5,
      lookAtZ: -0.4,
      fov: 48,
    },
    lighting: {
      hemi: 1.1,
      key: 1.7,
      back: 0.8,
      ambient: 0.3,
    },
    seed: 12345,
    applePlacements: [
      { u: 0.5, laneIndex: 2, polarity: 'ok' },
      { u: -1.4, laneIndex: 5, polarity: 'poison' },
    ],
  };
}

describe('calibration serializer', () => {
  it('exports JSON with required top-level keys', () => {
    const json = serializeCalibrationSettings(createSettings());
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed.worldScale).toBeDefined();
    expect(parsed.camera).toBeDefined();
    expect(parsed.lighting).toBeDefined();
    expect(parsed.seed).toBeDefined();
    expect(parsed.applePlacements).toBeDefined();
  });

  it('exports patch text including camera, world scale, and lighting blocks', () => {
    const patch = exportCalibrationPatch(createSettings());

    expect(patch).toContain('export const WORLD_SCALE');
    expect(patch).toContain('export const CAMERA_SETTINGS');
    expect(patch).toContain('export const LIGHT_SETTINGS');
    expect(patch).toContain('position: { x: 10');
    expect(patch).toContain('intensity: 1.7');
  });

  it('round-trips through serialize + parse without changing values', () => {
    const settings = createSettings();
    const json = serializeCalibrationSettings(settings);
    const parsed = parseCalibrationSettings(json);

    expect(parsed).toEqual(settings);
  });
});
