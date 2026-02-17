import * as THREE from 'three';

import { DECAL_EDGE_PADDING, MOBIUS_HALF_WIDTH, MOBIUS_RADIUS } from './config';
import { clamp, mobiusFrame } from './mobius';

export interface SurfaceDecalGeometry extends THREE.BufferGeometry {
  userData: {
    segmentsU: number;
    segmentsV: number;
  };
}

interface SurfaceDecalOptions {
  centerU: number;
  centerV: number;
  width: number;
  height: number;
  normalOffset: number;
}

export function createSurfaceDecalGeometry(segmentsU: number, segmentsV: number): SurfaceDecalGeometry {
  const geometry = new THREE.BufferGeometry() as SurfaceDecalGeometry;
  geometry.userData = { segmentsU, segmentsV };

  const vertexCount = (segmentsU + 1) * (segmentsV + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  let uvIndex = 0;
  for (let y = 0; y <= segmentsV; y += 1) {
    for (let x = 0; x <= segmentsU; x += 1) {
      uvs[uvIndex] = x / segmentsU;
      uvs[uvIndex + 1] = 1 - y / segmentsV;
      uvIndex += 2;
    }
  }

  const indices: number[] = [];
  for (let y = 0; y < segmentsV; y += 1) {
    for (let x = 0; x < segmentsU; x += 1) {
      const a = y * (segmentsU + 1) + x;
      const b = a + 1;
      const c = a + (segmentsU + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const positionAttr = new THREE.BufferAttribute(positions, 3);
  const normalAttr = new THREE.BufferAttribute(normals, 3);
  positionAttr.setUsage(THREE.DynamicDrawUsage);
  normalAttr.setUsage(THREE.DynamicDrawUsage);

  geometry.setAttribute('position', positionAttr);
  geometry.setAttribute('normal', normalAttr);
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  return geometry;
}

export function updateSurfaceDecalGeometry(geometry: SurfaceDecalGeometry, options: SurfaceDecalOptions): void {
  const { segmentsU, segmentsV } = geometry.userData;
  const { centerU, centerV, width, height, normalOffset } = options;
  const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normalAttr = geometry.getAttribute('normal') as THREE.BufferAttribute;

  // For current camera framing, keep decal art upright by mapping texture vertical axis along u.
  const uSpan = height / MOBIUS_RADIUS;
  const vSpan = width;
  const minV = -MOBIUS_HALF_WIDTH + DECAL_EDGE_PADDING;
  const maxV = MOBIUS_HALF_WIDTH - DECAL_EDGE_PADDING;

  let vertexIndex = 0;
  for (let y = 0; y <= segmentsV; y += 1) {
    const ty = y / segmentsV - 0.5;
    for (let x = 0; x <= segmentsU; x += 1) {
      const tx = x / segmentsU - 0.5;
      // Keep u unwrapped here so decals remain continuous across the Mobius seam.
      const u = centerU - ty * uSpan;
      const v = clamp(centerV + tx * vSpan, minV, maxV);
      const frame = mobiusFrame(u, v);
      const position = frame.point.clone().add(frame.normal.clone().multiplyScalar(normalOffset));
      positionAttr.setXYZ(vertexIndex, position.x, position.y, position.z);
      normalAttr.setXYZ(vertexIndex, frame.normal.x, frame.normal.y, frame.normal.z);
      vertexIndex += 1;
    }
  }

  positionAttr.needsUpdate = true;
  normalAttr.needsUpdate = true;
  geometry.computeBoundingSphere();
}
