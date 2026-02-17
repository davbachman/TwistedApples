import { CAMERA_SETTINGS, LIGHT_SETTINGS } from '../game/config';
import type { CalibrationSettings } from './types';

function formatNumber(value: number, digits = 6): string {
  const rounded = Number(value.toFixed(digits));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatHexColor(value: number): string {
  return `0x${Math.round(value).toString(16)}`;
}

function normalizeSettings(settings: CalibrationSettings): CalibrationSettings {
  return {
    worldScale: {
      x: Number(settings.worldScale.x),
      y: Number(settings.worldScale.y),
      z: Number(settings.worldScale.z),
    },
    camera: {
      x: Number(settings.camera.x),
      y: Number(settings.camera.y),
      z: Number(settings.camera.z),
      lookAtX: Number(settings.camera.lookAtX),
      lookAtY: Number(settings.camera.lookAtY),
      lookAtZ: Number(settings.camera.lookAtZ),
      fov: Number(settings.camera.fov),
    },
    lighting: {
      hemi: Number(settings.lighting.hemi),
      key: Number(settings.lighting.key),
      back: Number(settings.lighting.back),
      ambient: Number(settings.lighting.ambient),
    },
    seed: Math.floor(Number(settings.seed)),
    applePlacements: settings.applePlacements.map((apple) => ({
      u: Number(apple.u),
      laneIndex: Math.floor(Number(apple.laneIndex)),
      polarity: apple.polarity,
    })),
  };
}

export function serializeCalibrationSettings(settings: CalibrationSettings): string {
  return JSON.stringify(normalizeSettings(settings), null, 2);
}

export function parseCalibrationSettings(raw: string): CalibrationSettings {
  return normalizeSettings(JSON.parse(raw) as CalibrationSettings);
}

export function exportCalibrationPatch(settings: CalibrationSettings): string {
  const normalized = normalizeSettings(settings);
  return [
    '// Paste these values into src/game/config.ts',
    'export const WORLD_SCALE = {',
    `  x: ${formatNumber(normalized.worldScale.x)},`,
    `  y: ${formatNumber(normalized.worldScale.y)},`,
    `  z: ${formatNumber(normalized.worldScale.z)},`,
    '};',
    '',
    'export const CAMERA_SETTINGS = {',
    `  fov: ${formatNumber(normalized.camera.fov)},`,
    `  near: ${formatNumber(CAMERA_SETTINGS.near)},`,
    `  far: ${formatNumber(CAMERA_SETTINGS.far)},`,
    `  position: { x: ${formatNumber(normalized.camera.x)}, y: ${formatNumber(normalized.camera.y)}, z: ${formatNumber(normalized.camera.z)} },`,
    `  lookAt: { x: ${formatNumber(normalized.camera.lookAtX)}, y: ${formatNumber(normalized.camera.lookAtY)}, z: ${formatNumber(normalized.camera.lookAtZ)} },`,
    `  roll: ${formatNumber(CAMERA_SETTINGS.roll)},`,
    '};',
    '',
    'export const LIGHT_SETTINGS = {',
    `  fog: { color: ${formatHexColor(LIGHT_SETTINGS.fog.color)}, near: ${formatNumber(LIGHT_SETTINGS.fog.near)}, far: ${formatNumber(LIGHT_SETTINGS.fog.far)} },`,
    `  hemisphere: { skyColor: ${formatHexColor(LIGHT_SETTINGS.hemisphere.skyColor)}, groundColor: ${formatHexColor(LIGHT_SETTINGS.hemisphere.groundColor)}, intensity: ${formatNumber(normalized.lighting.hemi)} },`,
    `  key: { color: ${formatHexColor(LIGHT_SETTINGS.key.color)}, intensity: ${formatNumber(normalized.lighting.key)}, position: { x: ${formatNumber(LIGHT_SETTINGS.key.position.x)}, y: ${formatNumber(LIGHT_SETTINGS.key.position.y)}, z: ${formatNumber(LIGHT_SETTINGS.key.position.z)} } },`,
    `  back: { color: ${formatHexColor(LIGHT_SETTINGS.back.color)}, intensity: ${formatNumber(normalized.lighting.back)}, position: { x: ${formatNumber(LIGHT_SETTINGS.back.position.x)}, y: ${formatNumber(LIGHT_SETTINGS.back.position.y)}, z: ${formatNumber(LIGHT_SETTINGS.back.position.z)} } },`,
    `  ambient: { color: ${formatHexColor(LIGHT_SETTINGS.ambient.color)}, intensity: ${formatNumber(normalized.lighting.ambient)} },`,
    '};',
  ].join('\n');
}
