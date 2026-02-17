import { Euler, Vector3 } from 'three';

import {
  LANE_COUNT,
  MOBIUS_HALF_WIDTH,
  MOBIUS_PITCH,
  MOBIUS_RADIUS,
  MOBIUS_ROLL,
  MOBIUS_U_OFFSET,
  MOBIUS_YAW_TILT,
  TAU,
} from './config';

export interface MobiusFrame {
  point: Vector3;
  tangentU: Vector3;
  tangentV: Vector3;
  normal: Vector3;
}

const WORLD_ROTATION = new Euler(MOBIUS_PITCH, MOBIUS_YAW_TILT, MOBIUS_ROLL, 'XYZ');

export function wrapAngle(angle: number): number {
  let wrapped = (angle + Math.PI) % TAU;
  if (wrapped < 0) {
    wrapped += TAU;
  }
  return wrapped - Math.PI;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function laneIndexToV(laneIndex: number): number {
  const t = clamp(laneIndex / (LANE_COUNT - 1), 0, 1);
  return lerp(-MOBIUS_HALF_WIDTH, MOBIUS_HALF_WIDTH, t);
}

export function mobiusPoint(u: number, v: number, radius = MOBIUS_RADIUS): Vector3 {
  const offsetU = u + MOBIUS_U_OFFSET;
  const halfU = offsetU * 0.5;
  const cosU = Math.cos(offsetU);
  const sinU = Math.sin(offsetU);
  const cosHalf = Math.cos(halfU);
  const sinHalf = Math.sin(halfU);

  // Sweep the initial segment x=R, y in [-1,1], z=0 around the x-z circle while twisting 180 degrees.
  return new Vector3(
    radius * cosU - v * cosU * sinHalf,
    v * cosHalf,
    radius * sinU - v * sinU * sinHalf,
  );
}

export function mobiusWorldPoint(u: number, v: number, radius = MOBIUS_RADIUS): Vector3 {
  return mobiusPoint(u, v, radius).applyEuler(WORLD_ROTATION);
}

export function mobiusFrame(u: number, v: number, radius = MOBIUS_RADIUS): MobiusFrame {
  const offsetU = u + MOBIUS_U_OFFSET;
  const halfU = offsetU * 0.5;
  const cosU = Math.cos(offsetU);
  const sinU = Math.sin(offsetU);
  const cosHalf = Math.cos(halfU);
  const sinHalf = Math.sin(halfU);

  const point = new Vector3(
    radius * cosU - v * cosU * sinHalf,
    v * cosHalf,
    radius * sinU - v * sinU * sinHalf,
  );

  const tangentU = new Vector3(
    -radius * sinU + v * sinU * sinHalf - 0.5 * v * cosU * cosHalf,
    -0.5 * v * sinHalf,
    radius * cosU - v * cosU * sinHalf - 0.5 * v * sinU * cosHalf,
  ).normalize();

  const tangentV = new Vector3(-cosU * sinHalf, cosHalf, -sinU * sinHalf).normalize();

  const normal = new Vector3().crossVectors(tangentU, tangentV).normalize();

  return { point, tangentU, tangentV, normal };
}
