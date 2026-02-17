import * as THREE from 'three';
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js';

import type { CalibrationApplePlacement, CalibrationSettings } from './calibrator/types';
import { exportCalibrationPatch, parseCalibrationSettings, serializeCalibrationSettings } from './calibrator/serializer';
import {
  APPLE_DECAL_HEIGHT,
  APPLE_DECAL_WIDTH,
  BASKET_DECAL_HEIGHT,
  BASKET_DECAL_WIDTH,
  CAMERA_SETTINGS,
  LANE_COUNT,
  LIGHT_SETTINGS,
  MOBIUS_HALF_WIDTH,
  MOBIUS_PITCH,
  MOBIUS_ROLL,
  MOBIUS_YAW_TILT,
  TAU,
  U_CATCH,
  WORLD_SCALE,
} from './game/config';
import { laneIndexToV, lerp, mobiusPoint } from './game/mobius';
import { createAppleTexture, createBasketTexture } from './game/rendering';
import { createSurfaceDecalGeometry, updateSurfaceDecalGeometry } from './game/surfaceDecal';
import type { ApplePolarity } from './game/types';

declare global {
  interface Window {
    exportCalibrationSettings: () => string;
    exportCalibrationPatch: () => string;
  }
}

interface ParameterDefinition {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  get: (settings: CalibrationSettings) => number;
  set: (settings: CalibrationSettings, value: number) => void;
}

interface ParameterRow {
  container: HTMLDivElement;
  button: HTMLButtonElement;
  value: HTMLSpanElement;
}

const STORAGE_KEY = 'twisted_apples_calibration_v1';
const APPLE_COUNT = 8;
const DECAL_OFFSET = 0.012;

const DEFAULT_SETTINGS: CalibrationSettings = {
  worldScale: {
    x: WORLD_SCALE.x,
    y: WORLD_SCALE.y,
    z: WORLD_SCALE.z,
  },
  camera: {
    x: CAMERA_SETTINGS.position.x,
    y: CAMERA_SETTINGS.position.y,
    z: CAMERA_SETTINGS.position.z,
    lookAtX: CAMERA_SETTINGS.lookAt.x,
    lookAtY: CAMERA_SETTINGS.lookAt.y,
    lookAtZ: CAMERA_SETTINGS.lookAt.z,
    fov: CAMERA_SETTINGS.fov,
  },
  lighting: {
    hemi: LIGHT_SETTINGS.hemisphere.intensity,
    key: LIGHT_SETTINGS.key.intensity,
    back: LIGHT_SETTINGS.back.intensity,
    ambient: LIGHT_SETTINGS.ambient.intensity,
  },
  seed: 1337,
  applePlacements: [],
};

const PARAMS: ParameterDefinition[] = [
  {
    key: 'worldScale.x',
    label: 'Scale X',
    min: 0.2,
    max: 4,
    step: 0.02,
    get: (s) => s.worldScale.x,
    set: (s, v) => {
      s.worldScale.x = v;
    },
  },
  {
    key: 'worldScale.y',
    label: 'Scale Y',
    min: 0.2,
    max: 4,
    step: 0.02,
    get: (s) => s.worldScale.y,
    set: (s, v) => {
      s.worldScale.y = v;
    },
  },
  {
    key: 'worldScale.z',
    label: 'Scale Z',
    min: 0.2,
    max: 4,
    step: 0.02,
    get: (s) => s.worldScale.z,
    set: (s, v) => {
      s.worldScale.z = v;
    },
  },
  {
    key: 'camera.x',
    label: 'Camera X',
    min: -20,
    max: 20,
    step: 0.2,
    get: (s) => s.camera.x,
    set: (s, v) => {
      s.camera.x = v;
    },
  },
  {
    key: 'camera.y',
    label: 'Camera Y',
    min: -20,
    max: 20,
    step: 0.2,
    get: (s) => s.camera.y,
    set: (s, v) => {
      s.camera.y = v;
    },
  },
  {
    key: 'camera.z',
    label: 'Camera Z',
    min: -20,
    max: 20,
    step: 0.2,
    get: (s) => s.camera.z,
    set: (s, v) => {
      s.camera.z = v;
    },
  },
  {
    key: 'camera.lookAtX',
    label: 'LookAt X',
    min: -8,
    max: 8,
    step: 0.1,
    get: (s) => s.camera.lookAtX,
    set: (s, v) => {
      s.camera.lookAtX = v;
    },
  },
  {
    key: 'camera.lookAtY',
    label: 'LookAt Y',
    min: -8,
    max: 8,
    step: 0.1,
    get: (s) => s.camera.lookAtY,
    set: (s, v) => {
      s.camera.lookAtY = v;
    },
  },
  {
    key: 'camera.lookAtZ',
    label: 'LookAt Z',
    min: -8,
    max: 8,
    step: 0.1,
    get: (s) => s.camera.lookAtZ,
    set: (s, v) => {
      s.camera.lookAtZ = v;
    },
  },
  {
    key: 'camera.fov',
    label: 'Camera FOV',
    min: 20,
    max: 100,
    step: 1,
    get: (s) => s.camera.fov,
    set: (s, v) => {
      s.camera.fov = v;
    },
  },
  {
    key: 'lighting.hemi',
    label: 'Light Hemi',
    min: 0,
    max: 4,
    step: 0.05,
    get: (s) => s.lighting.hemi,
    set: (s, v) => {
      s.lighting.hemi = v;
    },
  },
  {
    key: 'lighting.key',
    label: 'Light Key',
    min: 0,
    max: 4,
    step: 0.05,
    get: (s) => s.lighting.key,
    set: (s, v) => {
      s.lighting.key = v;
    },
  },
  {
    key: 'lighting.back',
    label: 'Light Back',
    min: 0,
    max: 4,
    step: 0.05,
    get: (s) => s.lighting.back,
    set: (s, v) => {
      s.lighting.back = v;
    },
  },
  {
    key: 'lighting.ambient',
    label: 'Light Ambient',
    min: 0,
    max: 4,
    step: 0.05,
    get: (s) => s.lighting.ambient,
    set: (s, v) => {
      s.lighting.ambient = v;
    },
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function cloneSettings(source: CalibrationSettings): CalibrationSettings {
  return {
    worldScale: {
      x: source.worldScale.x,
      y: source.worldScale.y,
      z: source.worldScale.z,
    },
    camera: {
      x: source.camera.x,
      y: source.camera.y,
      z: source.camera.z,
      lookAtX: source.camera.lookAtX,
      lookAtY: source.camera.lookAtY,
      lookAtZ: source.camera.lookAtZ,
      fov: source.camera.fov,
    },
    lighting: {
      hemi: source.lighting.hemi,
      key: source.lighting.key,
      back: source.lighting.back,
      ambient: source.lighting.ambient,
    },
    seed: source.seed,
    applePlacements: source.applePlacements.map((apple) => ({ ...apple })),
  };
}

function generateApplePlacements(seed: number, count: number): CalibrationApplePlacement[] {
  const rng = createSeededRng(seed);
  const placements: CalibrationApplePlacement[] = [];
  for (let index = 0; index < count; index += 1) {
    const polarity: ApplePolarity = rng() < 0.5 ? 'ok' : 'poison';
    placements.push({
      u: -Math.PI + rng() * TAU,
      laneIndex: randomInt(rng, 0, LANE_COUNT - 1),
      polarity,
    });
  }
  return placements;
}

function createDefaultSettings(): CalibrationSettings {
  const settings = cloneSettings(DEFAULT_SETTINGS);
  settings.applePlacements = generateApplePlacements(settings.seed, APPLE_COUNT);
  return settings;
}

function normalizeLoadedSettings(settings: CalibrationSettings): CalibrationSettings {
  const normalized = cloneSettings(settings);

  normalized.seed = Math.floor(normalized.seed);
  if (!Number.isFinite(normalized.seed)) {
    normalized.seed = DEFAULT_SETTINGS.seed;
  }

  normalized.worldScale.x = clamp(normalized.worldScale.x, 0.2, 4);
  normalized.worldScale.y = clamp(normalized.worldScale.y, 0.2, 4);
  normalized.worldScale.z = clamp(normalized.worldScale.z, 0.2, 4);

  normalized.camera.x = clamp(normalized.camera.x, -20, 20);
  normalized.camera.y = clamp(normalized.camera.y, -20, 20);
  normalized.camera.z = clamp(normalized.camera.z, -20, 20);
  normalized.camera.lookAtX = clamp(normalized.camera.lookAtX, -8, 8);
  normalized.camera.lookAtY = clamp(normalized.camera.lookAtY, -8, 8);
  normalized.camera.lookAtZ = clamp(normalized.camera.lookAtZ, -8, 8);
  normalized.camera.fov = clamp(normalized.camera.fov, 20, 100);

  normalized.lighting.hemi = clamp(normalized.lighting.hemi, 0, 4);
  normalized.lighting.key = clamp(normalized.lighting.key, 0, 4);
  normalized.lighting.back = clamp(normalized.lighting.back, 0, 4);
  normalized.lighting.ambient = clamp(normalized.lighting.ambient, 0, 4);

  normalized.applePlacements = normalized.applePlacements
    .filter((apple) => Number.isFinite(apple.u))
    .map((apple) => ({
      u: apple.u,
      laneIndex: clamp(Math.floor(apple.laneIndex), 0, LANE_COUNT - 1),
      polarity: apple.polarity === 'poison' ? 'poison' : 'ok',
    }));

  if (normalized.applePlacements.length === 0) {
    normalized.applePlacements = generateApplePlacements(normalized.seed, APPLE_COUNT);
  }

  return normalized;
}

function loadSettings(): CalibrationSettings {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createDefaultSettings();
  }

  try {
    return normalizeLoadedSettings(parseCalibrationSettings(raw));
  } catch {
    return createDefaultSettings();
  }
}

function saveSettings(settings: CalibrationSettings): void {
  window.localStorage.setItem(STORAGE_KEY, serializeCalibrationSettings(settings));
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element as T;
}

const canvas = byId<HTMLCanvasElement>('calibrate-canvas');
const parameterList = byId<HTMLDivElement>('param-list');
const exportOutput = byId<HTMLTextAreaElement>('export-output');
const copyButton = byId<HTMLButtonElement>('copy-button');
const copyState = byId<HTMLSpanElement>('copy-state');
const seedLabel = byId<HTMLSpanElement>('seed-value');

let renderer: THREE.WebGLRenderer | null = null;
let fallbackContext: CanvasRenderingContext2D | null = null;
const fallbackDpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
const originalConsoleError = console.error;

try {
  console.error = () => undefined;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
} catch (error) {
  console.warn('WebGL unavailable in calibration helper, using 2D fallback.', error);
  fallbackContext = canvas.getContext('2d');
  if (!fallbackContext) {
    throw new Error('Unable to create a rendering context');
  }
} finally {
  console.error = originalConsoleError;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(LIGHT_SETTINGS.fog.color);
scene.fog = new THREE.Fog(LIGHT_SETTINGS.fog.color, LIGHT_SETTINGS.fog.near, LIGHT_SETTINGS.fog.far);

const camera = new THREE.PerspectiveCamera(CAMERA_SETTINGS.fov, 1, CAMERA_SETTINGS.near, CAMERA_SETTINGS.far);

const world = new THREE.Group();
world.rotation.set(MOBIUS_PITCH, MOBIUS_YAW_TILT, MOBIUS_ROLL);
scene.add(world);

const stripGeometry = new ParametricGeometry((u, v, target) => {
  const mappedU = u * TAU;
  const mappedV = lerp(-MOBIUS_HALF_WIDTH, MOBIUS_HALF_WIDTH, v);
  const point = mobiusPoint(mappedU, mappedV);
  target.set(point.x, point.y, point.z);
}, 260, 44);

const stripMaterial = new THREE.MeshStandardMaterial({
  color: 0x466073,
  roughness: 0.74,
  metalness: 0.18,
  side: THREE.DoubleSide,
});

const stripMesh = new THREE.Mesh(stripGeometry, stripMaterial);
world.add(stripMesh);

const wireframe = new THREE.LineSegments(
  new THREE.WireframeGeometry(stripGeometry),
  new THREE.LineBasicMaterial({ color: 0x8cc2da, transparent: true, opacity: 0.17 }),
);
world.add(wireframe);

const hemi = new THREE.HemisphereLight(
  LIGHT_SETTINGS.hemisphere.skyColor,
  LIGHT_SETTINGS.hemisphere.groundColor,
  LIGHT_SETTINGS.hemisphere.intensity,
);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(LIGHT_SETTINGS.key.color, LIGHT_SETTINGS.key.intensity);
keyLight.position.set(LIGHT_SETTINGS.key.position.x, LIGHT_SETTINGS.key.position.y, LIGHT_SETTINGS.key.position.z);
scene.add(keyLight);

const backLight = new THREE.DirectionalLight(LIGHT_SETTINGS.back.color, LIGHT_SETTINGS.back.intensity);
backLight.position.set(LIGHT_SETTINGS.back.position.x, LIGHT_SETTINGS.back.position.y, LIGHT_SETTINGS.back.position.z);
scene.add(backLight);

const ambientLight = new THREE.AmbientLight(LIGHT_SETTINGS.ambient.color, LIGHT_SETTINGS.ambient.intensity);
scene.add(ambientLight);

const basketMaterial = new THREE.MeshStandardMaterial({
  map: createBasketTexture(),
  transparent: true,
  alphaTest: 0.08,
  roughness: 0.6,
  metalness: 0.02,
  emissive: new THREE.Color(0x1b0f05),
  emissiveIntensity: 0.2,
  side: THREE.DoubleSide,
  depthTest: false,
  depthWrite: false,
});

const appleMaterials: Record<ApplePolarity, THREE.MeshStandardMaterial> = {
  ok: new THREE.MeshStandardMaterial({
    map: createAppleTexture(false),
    transparent: true,
    alphaTest: 0.16,
    roughness: 0.52,
    metalness: 0.03,
    emissive: new THREE.Color(0x1b0b05),
    emissiveIntensity: 0.3,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  }),
  poison: new THREE.MeshStandardMaterial({
    map: createAppleTexture(true),
    transparent: true,
    alphaTest: 0.16,
    roughness: 0.52,
    metalness: 0.03,
    emissive: new THREE.Color(0x1b0b05),
    emissiveIntensity: 0.3,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  }),
};

const basketMesh = new THREE.Mesh(createSurfaceDecalGeometry(20, 14), basketMaterial);
basketMesh.frustumCulled = false;
basketMesh.renderOrder = 3;
world.add(basketMesh);

const appleMeshes: Array<THREE.Mesh<ReturnType<typeof createSurfaceDecalGeometry>, THREE.MeshStandardMaterial>> = [];

let settings = loadSettings();
let activeParam = 0;
const parameterRows = new Map<string, ParameterRow>();

function disposeAppleMeshes(): void {
  for (const mesh of appleMeshes) {
    world.remove(mesh);
    mesh.geometry.dispose();
  }
  appleMeshes.length = 0;
}

function rebuildAppleMeshes(): void {
  disposeAppleMeshes();

  for (const apple of settings.applePlacements) {
    const mesh = new THREE.Mesh(createSurfaceDecalGeometry(16, 12), appleMaterials[apple.polarity]);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    world.add(mesh);
    appleMeshes.push(mesh);
  }
}

function updateDecals(): void {
  const basketLane = (LANE_COUNT - 1) * 0.5;

  updateSurfaceDecalGeometry(basketMesh.geometry, {
    centerU: U_CATCH,
    centerV: laneIndexToV(basketLane),
    width: BASKET_DECAL_WIDTH,
    height: BASKET_DECAL_HEIGHT,
    normalOffset: DECAL_OFFSET,
  });

  for (let index = 0; index < appleMeshes.length; index += 1) {
    const mesh = appleMeshes[index];
    const apple = settings.applePlacements[index];

    updateSurfaceDecalGeometry(mesh.geometry, {
      centerU: apple.u,
      centerV: laneIndexToV(apple.laneIndex),
      width: APPLE_DECAL_WIDTH,
      height: APPLE_DECAL_HEIGHT,
      normalOffset: DECAL_OFFSET,
    });
  }
}

function applyCameraAndWorldSettings(): void {
  world.scale.set(settings.worldScale.x, settings.worldScale.y, settings.worldScale.z);

  camera.position.set(settings.camera.x, settings.camera.y, settings.camera.z);
  camera.up.set(0, 1, 0);
  camera.lookAt(settings.camera.lookAtX, settings.camera.lookAtY, settings.camera.lookAtZ);
  camera.rotateZ(CAMERA_SETTINGS.roll);
  camera.fov = settings.camera.fov;
  camera.updateProjectionMatrix();

  hemi.intensity = settings.lighting.hemi;
  keyLight.intensity = settings.lighting.key;
  backLight.intensity = settings.lighting.back;
  ambientLight.intensity = settings.lighting.ambient;
}

function resizeRenderer(): void {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  if (renderer) {
    renderer.setSize(width, height, false);
    return;
  }

  canvas.width = Math.floor(width * fallbackDpr);
  canvas.height = Math.floor(height * fallbackDpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function refreshExportText(): void {
  exportOutput.value = exportCalibrationPatch(settings);
  seedLabel.textContent = String(settings.seed);

  window.exportCalibrationSettings = () => serializeCalibrationSettings(settings);
  window.exportCalibrationPatch = () => exportCalibrationPatch(settings);
}

function renderNow(): void {
  applyCameraAndWorldSettings();
  updateDecals();
  refreshExportText();

  if (renderer) {
    renderer.render(scene, camera);
    return;
  }

  if (!fallbackContext) {
    return;
  }

  const width = canvas.width / fallbackDpr;
  const height = canvas.height / fallbackDpr;
  fallbackContext.setTransform(fallbackDpr, 0, 0, fallbackDpr, 0, 0);
  fallbackContext.fillStyle = '#130d06';
  fallbackContext.fillRect(0, 0, width, height);
  fallbackContext.fillStyle = '#f7ebcf';
  fallbackContext.font = '12px Silkscreen, monospace';
  fallbackContext.fillText('Calibrator fallback mode (WebGL unavailable)', 18, 24);
}

function saveAndRender(): void {
  saveSettings(settings);
  updateParameterRows();
  renderNow();
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 100) {
    return value.toFixed(1);
  }
  if (Math.abs(value) >= 10) {
    return value.toFixed(2);
  }
  return value.toFixed(3);
}

function updateParameterRows(): void {
  for (let index = 0; index < PARAMS.length; index += 1) {
    const param = PARAMS[index];
    const row = parameterRows.get(param.key);
    if (!row) {
      continue;
    }

    row.value.textContent = formatValue(param.get(settings));
    row.container.classList.toggle('active', index === activeParam);
  }
}

function buildParameterRows(): void {
  parameterList.innerHTML = '';

  for (let index = 0; index < PARAMS.length; index += 1) {
    const param = PARAMS[index];
    const row = document.createElement('div');
    row.className = 'param-row';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'param-main';

    const label = document.createElement('span');
    label.className = 'param-label';
    label.textContent = param.label;

    const value = document.createElement('span');
    value.className = 'param-value';

    const decrementButton = document.createElement('button');
    decrementButton.type = 'button';
    decrementButton.className = 'param-step';
    decrementButton.textContent = '-';
    decrementButton.addEventListener('click', (event) => {
      event.stopPropagation();
      activeParam = index;
      applyStepDelta(-1, false, false);
    });

    const incrementButton = document.createElement('button');
    incrementButton.type = 'button';
    incrementButton.className = 'param-step';
    incrementButton.textContent = '+';
    incrementButton.addEventListener('click', (event) => {
      event.stopPropagation();
      activeParam = index;
      applyStepDelta(1, false, false);
    });

    button.append(label, value);
    button.addEventListener('click', () => {
      activeParam = index;
      copyState.textContent = '';
      updateParameterRows();
    });

    row.append(button, decrementButton, incrementButton);
    parameterList.appendChild(row);
    parameterRows.set(param.key, { container: row, button, value });
  }

  updateParameterRows();
}

function applyStepDelta(direction: number, shift: boolean, alt: boolean): void {
  const param = PARAMS[activeParam];
  const fineMultiplier = shift ? 0.2 : 1;
  const coarseMultiplier = alt ? 5 : 1;
  const delta = direction * param.step * fineMultiplier * coarseMultiplier;

  const next = clamp(param.get(settings) + delta, param.min, param.max);
  param.set(settings, next);

  copyState.textContent = '';
  saveAndRender();
}

function applyWheelDelta(deltaY: number, shift: boolean, alt: boolean): void {
  const direction = -deltaY / 100;
  if (direction === 0) {
    return;
  }
  applyStepDelta(direction, shift, alt);
}

function randomizeSeedAndApples(): void {
  settings.seed = Math.floor(Math.random() * 0x7fffffff);
  settings.applePlacements = generateApplePlacements(settings.seed, APPLE_COUNT);
  rebuildAppleMeshes();
  copyState.textContent = '';
  saveAndRender();
}

function resetDefaults(): void {
  settings = createDefaultSettings();
  rebuildAppleMeshes();
  copyState.textContent = '';
  saveAndRender();
}

async function copyPatchToClipboard(): Promise<void> {
  const patchText = exportCalibrationPatch(settings);
  try {
    await navigator.clipboard.writeText(patchText);
    copyState.textContent = 'Copied patch';
  } catch {
    exportOutput.focus();
    exportOutput.select();
    document.execCommand('copy');
    copyState.textContent = 'Copied patch';
  }
}

canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    applyWheelDelta(event.deltaY, event.shiftKey, event.altKey);
  },
  { passive: false },
);

let dragPointerId: number | null = null;
let dragLastY = 0;
canvas.addEventListener('pointerdown', (event) => {
  dragPointerId = event.pointerId;
  dragLastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (dragPointerId !== event.pointerId) {
    return;
  }
  const deltaY = event.clientY - dragLastY;
  if (Math.abs(deltaY) < 1) {
    return;
  }
  dragLastY = event.clientY;
  applyWheelDelta(deltaY, event.shiftKey, event.altKey);
});
const clearDrag = (event: PointerEvent) => {
  if (dragPointerId === event.pointerId) {
    dragPointerId = null;
  }
};
canvas.addEventListener('pointerup', clearDrag);
canvas.addEventListener('pointercancel', clearDrag);
canvas.addEventListener('pointerleave', clearDrag);

window.addEventListener('keydown', (event) => {
  if (event.key === '[' || event.key === 'ArrowLeft') {
    activeParam = (activeParam + PARAMS.length - 1) % PARAMS.length;
    copyState.textContent = '';
    updateParameterRows();
    event.preventDefault();
    return;
  }

  if (event.key === ']' || event.key === 'ArrowRight') {
    activeParam = (activeParam + 1) % PARAMS.length;
    copyState.textContent = '';
    updateParameterRows();
    event.preventDefault();
    return;
  }

  if (event.key === 'ArrowUp' || event.key === '=') {
    applyStepDelta(1, event.shiftKey, event.altKey);
    event.preventDefault();
    return;
  }

  if (event.key === 'ArrowDown' || event.key === '-') {
    applyStepDelta(-1, event.shiftKey, event.altKey);
    event.preventDefault();
    return;
  }

  if (event.key === 'r' || event.key === 'R') {
    randomizeSeedAndApples();
    event.preventDefault();
    return;
  }

  if (event.key === '0') {
    resetDefaults();
    event.preventDefault();
    return;
  }

  if (event.key === 's' || event.key === 'S') {
    void copyPatchToClipboard();
    event.preventDefault();
  }
});

window.addEventListener('resize', () => {
  resizeRenderer();
  renderNow();
});

copyButton.addEventListener('click', () => {
  void copyPatchToClipboard();
});

buildParameterRows();
rebuildAppleMeshes();
resizeRenderer();
renderNow();

window.addEventListener('beforeunload', () => {
  disposeAppleMeshes();

  stripGeometry.dispose();
  stripMaterial.dispose();
  (wireframe.geometry as THREE.BufferGeometry).dispose();
  (wireframe.material as THREE.LineBasicMaterial).dispose();

  basketMesh.geometry.dispose();
  basketMaterial.map?.dispose();
  basketMaterial.dispose();

  appleMaterials.ok.map?.dispose();
  appleMaterials.ok.dispose();
  appleMaterials.poison.map?.dispose();
  appleMaterials.poison.dispose();

  renderer?.dispose();
});
