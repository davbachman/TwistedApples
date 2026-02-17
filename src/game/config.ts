export const TAU = Math.PI * 2;

export const MOBIUS_RADIUS = 3.6;
export const MOBIUS_HALF_WIDTH = 1.8;
export const MOBIUS_U_OFFSET = 0;

export const MOBIUS_YAW_TILT = 0;
export const MOBIUS_ROLL = 0;
export const MOBIUS_PITCH = 0;

export const LANE_COUNT = 7;

export const U_CATCH = 0;
export const U_SPAWN = U_CATCH + Math.PI;

export const CATCH_WINDOW_RAD = 0.08;
export const CATCH_LANE_THRESHOLD = 0.35;

export const MAX_APPLES = 10;

export const APPLE_DECAL_WIDTH = 0.56;
export const APPLE_DECAL_HEIGHT = 0.62;
export const BASKET_DECAL_WIDTH = 1.0;
export const BASKET_DECAL_HEIGHT = 0.68;
export const DECAL_EDGE_PADDING = 0.02;

interface Vec3Config {
  x: number;
  y: number;
  z: number;
}

interface CameraConfig {
  fov: number;
  near: number;
  far: number;
  position: Vec3Config;
  lookAt: Vec3Config;
  roll: number;
}

interface LightConfig {
  color: number;
  intensity: number;
  position: Vec3Config;
}

interface LightNoPositionConfig {
  color: number;
  intensity: number;
}

interface FogConfig {
  color: number;
  near: number;
  far: number;
}

interface LightingConfig {
  fog: FogConfig;
  hemisphere: {
    skyColor: number;
    groundColor: number;
    intensity: number;
  };
  key: LightConfig;
  back: LightConfig;
  ambient: LightNoPositionConfig;
}

export const WORLD_SCALE: Vec3Config = {
  x: 1,
  y: 1,
  z: 1,
};

export const CAMERA_SETTINGS: CameraConfig = {
  fov: 42,
  near: 0.1,
  far: 100,
  position: { x: 10, y: 8.2, z: 2 },
  lookAt: { x: 0, y: 0, z: 0 },
  roll: 1.570796,
};

export const LIGHT_SETTINGS: LightingConfig = {
  fog: {
    color: 0x1a1208,
    near: 20,
    far: 44,
  },
  hemisphere: {
    skyColor: 0xf7e8cc,
    groundColor: 0x1f1813,
    intensity: 2.3,
  },
  key: {
    color: 0xffefcd,
    intensity: 1.45,
    position: { x: 2.8, y: 4.5, z: 3.6 },
  },
  back: {
    color: 0x8ec1ff,
    intensity: 0.5,
    position: { x: -4, y: -1.8, z: -3.2 },
  },
  ambient: {
    color: 0x705f4a,
    intensity: 0.53,
  },
};

export const SCORE_OK_CATCH = 10;
export const SCORE_POISON_CATCH = -20;
export const SCORE_POISON_MISS = 5;

export const STARTING_LIVES = 3;

export const BASE_SPEED_RAD_PER_SEC = 0.62;
export const MAX_SPEED_RAD_PER_SEC = 1.35;

export const BASE_SPAWN_INTERVAL_MS = 1600;
export const MIN_SPAWN_INTERVAL_MS = 650;

export const RAMP_DURATION_MS = 180_000;

export const BASKET_SPEED_LANES_PER_SEC = 5.5;

export const FIXED_STEP_MS = 1000 / 60;
