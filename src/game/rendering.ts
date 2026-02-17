import * as THREE from 'three';
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js';

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
} from './config';
import { laneIndexToV, lerp, mobiusFrame, mobiusPoint } from './mobius';
import { createSurfaceDecalGeometry, updateSurfaceDecalGeometry } from './surfaceDecal';
import type { SurfaceDecalGeometry } from './surfaceDecal';
import type { ApplePolarity, GameState } from './types';

interface AppleMeshEntry {
  geometry: SurfaceDecalGeometry;
  frontMesh: THREE.Mesh<SurfaceDecalGeometry, THREE.MeshStandardMaterial>;
  backMesh: THREE.Mesh<SurfaceDecalGeometry, THREE.MeshStandardMaterial>;
  polarity: ApplePolarity;
}

export interface RendererAdapter {
  resize(width: number, height: number): void;
  render(state: GameState): void;
  dispose(): void;
}

export function createAppleTexture(mirror: boolean): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create 2D context for apple texture');
  }

  ctx.clearRect(0, 0, size, size);

  if (mirror) {
    ctx.save();
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  }

  const centerX = size * 0.5;
  const centerY = size * 0.58;

  const bodyGradient = ctx.createRadialGradient(centerX - 30, centerY - 38, 20, centerX, centerY, 102);
  bodyGradient.addColorStop(0, '#ffb37a');
  bodyGradient.addColorStop(0.3, '#f94b36');
  bodyGradient.addColorStop(1, '#8c1713');

  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - 86);
  ctx.bezierCurveTo(centerX + 78, centerY - 112, centerX + 104, centerY - 8, centerX + 42, centerY + 72);
  ctx.bezierCurveTo(centerX + 5, centerY + 104, centerX - 6, centerY + 104, centerX - 42, centerY + 72);
  ctx.bezierCurveTo(centerX - 104, centerY - 8, centerX - 78, centerY - 112, centerX, centerY - 86);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 240, 214, 0.22)';
  ctx.beginPath();
  ctx.ellipse(centerX - 24, centerY - 34, 22, 36, -0.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#6d441f';
  ctx.lineCap = 'round';
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(centerX + 3, centerY - 88);
  ctx.bezierCurveTo(centerX - 8, centerY - 126, centerX - 42, centerY - 128, centerX - 58, centerY - 102);
  ctx.stroke();

  ctx.fillStyle = '#67cf56';
  ctx.beginPath();
  ctx.ellipse(centerX + 38, centerY - 109, 26, 14, -0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '700 72px Silkscreen, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(61, 11, 8, 0.95)';
  ctx.lineWidth = 12;
  ctx.strokeText('OK', centerX, centerY + 14);
  ctx.fillStyle = '#fff89b';
  ctx.fillText('OK', centerX, centerY + 14);

  if (mirror) {
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  return texture;
}

export function createBasketTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create 2D context for basket texture');
  }

  ctx.clearRect(0, 0, size, size);
  ctx.translate(size * 0.5, size * 0.5);

  const bodyGradient = ctx.createLinearGradient(0, -70, 0, 68);
  bodyGradient.addColorStop(0, '#e8c28d');
  bodyGradient.addColorStop(1, '#8f5a2c');

  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.moveTo(-80, -24);
  ctx.lineTo(80, -24);
  ctx.lineTo(64, 56);
  ctx.lineTo(-64, 56);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#f0d5a8';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, -24, 82, Math.PI, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(63, 40, 21, 0.48)';
  ctx.lineWidth = 4;
  for (let i = -56; i <= 56; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, -20);
    ctx.lineTo(i * 0.8, 50);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  return texture;
}

export class GameRenderer implements RendererAdapter {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly world: THREE.Group;
  private readonly appleMaterialsFront: Record<ApplePolarity, THREE.MeshStandardMaterial>;
  private readonly appleMaterialsBack: Record<ApplePolarity, THREE.MeshStandardMaterial>;
  private readonly appleMeshes = new Map<number, AppleMeshEntry>();
  private readonly basketMesh: THREE.Mesh<SurfaceDecalGeometry, THREE.MeshStandardMaterial>;

  private static readonly DECAL_OFFSET = 0.012;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(LIGHT_SETTINGS.fog.color);
    this.scene.fog = new THREE.Fog(LIGHT_SETTINGS.fog.color, LIGHT_SETTINGS.fog.near, LIGHT_SETTINGS.fog.far);

    this.camera = new THREE.PerspectiveCamera(CAMERA_SETTINGS.fov, 1, CAMERA_SETTINGS.near, CAMERA_SETTINGS.far);
    this.camera.position.set(CAMERA_SETTINGS.position.x, CAMERA_SETTINGS.position.y, CAMERA_SETTINGS.position.z);
    this.camera.lookAt(CAMERA_SETTINGS.lookAt.x, CAMERA_SETTINGS.lookAt.y, CAMERA_SETTINGS.lookAt.z);
    this.camera.rotateZ(CAMERA_SETTINGS.roll);

    const hemi = new THREE.HemisphereLight(
      LIGHT_SETTINGS.hemisphere.skyColor,
      LIGHT_SETTINGS.hemisphere.groundColor,
      LIGHT_SETTINGS.hemisphere.intensity,
    );
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(LIGHT_SETTINGS.key.color, LIGHT_SETTINGS.key.intensity);
    key.position.set(LIGHT_SETTINGS.key.position.x, LIGHT_SETTINGS.key.position.y, LIGHT_SETTINGS.key.position.z);
    this.scene.add(key);

    const back = new THREE.DirectionalLight(LIGHT_SETTINGS.back.color, LIGHT_SETTINGS.back.intensity);
    back.position.set(LIGHT_SETTINGS.back.position.x, LIGHT_SETTINGS.back.position.y, LIGHT_SETTINGS.back.position.z);
    this.scene.add(back);

    const fill = new THREE.AmbientLight(LIGHT_SETTINGS.ambient.color, LIGHT_SETTINGS.ambient.intensity);
    this.scene.add(fill);

    this.world = new THREE.Group();
    this.world.rotation.set(MOBIUS_PITCH, MOBIUS_YAW_TILT, MOBIUS_ROLL);
    this.world.scale.set(WORLD_SCALE.x, WORLD_SCALE.y, WORLD_SCALE.z);
    this.scene.add(this.world);

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
    this.world.add(stripMesh);

    const wireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(stripGeometry),
      new THREE.LineBasicMaterial({ color: 0x8cc2da, transparent: true, opacity: 0.17 }),
    );
    this.world.add(wireframe);

    const catchPoints: THREE.Vector3[] = [];
    for (let i = 0; i < 36; i += 1) {
      const t = i / 35;
      const v = lerp(-MOBIUS_HALF_WIDTH, MOBIUS_HALF_WIDTH, t);
      const frame = mobiusFrame(U_CATCH, v);
      catchPoints.push(frame.point.clone().add(frame.normal.multiplyScalar(0.012)));
    }
    const catchLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(catchPoints),
      new THREE.LineBasicMaterial({ color: 0xffc26f, transparent: true, opacity: 0.92 }),
    );
    this.world.add(catchLine);

    const okTexture = createAppleTexture(false);
    const poisonTexture = createAppleTexture(true);

    this.appleMaterialsFront = {
      ok: new THREE.MeshStandardMaterial({
        map: okTexture,
        transparent: true,
        alphaTest: 0.16,
        roughness: 0.52,
        metalness: 0.03,
        emissive: new THREE.Color(0x1b0b05),
        emissiveIntensity: 0.3,
        side: THREE.FrontSide,
        depthTest: false,
        depthWrite: false,
      }),
      poison: new THREE.MeshStandardMaterial({
        map: poisonTexture,
        transparent: true,
        alphaTest: 0.16,
        roughness: 0.52,
        metalness: 0.03,
        emissive: new THREE.Color(0x1b0b05),
        emissiveIntensity: 0.3,
        side: THREE.FrontSide,
        depthTest: false,
        depthWrite: false,
      }),
    };

    // Backfaces mirror UV orientation on screen; swap maps so polarity visuals stay consistent.
    this.appleMaterialsBack = {
      ok: new THREE.MeshStandardMaterial({
        map: poisonTexture,
        transparent: true,
        alphaTest: 0.16,
        roughness: 0.52,
        metalness: 0.03,
        emissive: new THREE.Color(0x1b0b05),
        emissiveIntensity: 0.3,
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
      }),
      poison: new THREE.MeshStandardMaterial({
        map: okTexture,
        transparent: true,
        alphaTest: 0.16,
        roughness: 0.52,
        metalness: 0.03,
        emissive: new THREE.Color(0x1b0b05),
        emissiveIntensity: 0.3,
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
      }),
    };

    this.basketMesh = this.createBasketMesh();
    this.world.add(this.basketMesh);

    this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
  }

  public resize(width: number, height: number): void {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));

    this.camera.aspect = safeWidth / safeHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(safeWidth, safeHeight, false);
  }

  public render(state: GameState): void {
    this.updateBasket(state.basketLane);
    this.updateApples(state);
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.appleMeshes.forEach((entry) => {
      entry.geometry.dispose();
    });
    this.appleMeshes.clear();

    const seenTextures = new Set<THREE.Texture>();
    const allAppleMaterials = [
      this.appleMaterialsFront.ok,
      this.appleMaterialsFront.poison,
      this.appleMaterialsBack.ok,
      this.appleMaterialsBack.poison,
    ];
    for (const material of allAppleMaterials) {
      const map = material.map;
      if (map && !seenTextures.has(map)) {
        map.dispose();
        seenTextures.add(map);
      }
      material.dispose();
    }

    this.renderer.dispose();
  }

  private updateBasket(basketLane: number): void {
    updateSurfaceDecalGeometry(this.basketMesh.geometry, {
      centerU: U_CATCH,
      centerV: laneIndexToV(basketLane),
      width: BASKET_DECAL_WIDTH,
      height: BASKET_DECAL_HEIGHT,
      normalOffset: GameRenderer.DECAL_OFFSET,
    });
  }

  private updateApples(state: GameState): void {
    const seen = new Set<number>();

    for (const apple of state.apples) {
      seen.add(apple.id);

      let entry = this.appleMeshes.get(apple.id);
      if (!entry) {
        const geometry = createSurfaceDecalGeometry(16, 12);
        const frontMesh = new THREE.Mesh(geometry, this.appleMaterialsFront[apple.polarity]);
        frontMesh.renderOrder = 2;
        frontMesh.frustumCulled = false;
        const backMesh = new THREE.Mesh(geometry, this.appleMaterialsBack[apple.polarity]);
        backMesh.renderOrder = 2;
        backMesh.frustumCulled = false;
        this.world.add(frontMesh);
        this.world.add(backMesh);
        entry = { geometry, frontMesh, backMesh, polarity: apple.polarity };
        this.appleMeshes.set(apple.id, entry);
      }

      if (entry.polarity !== apple.polarity) {
        entry.frontMesh.material = this.appleMaterialsFront[apple.polarity];
        entry.backMesh.material = this.appleMaterialsBack[apple.polarity];
        entry.polarity = apple.polarity;
      }

      updateSurfaceDecalGeometry(entry.geometry, {
        centerU: apple.u,
        centerV: laneIndexToV(apple.laneIndex),
        width: APPLE_DECAL_WIDTH,
        height: APPLE_DECAL_HEIGHT,
        normalOffset: GameRenderer.DECAL_OFFSET,
      });
    }

    for (const [id, entry] of this.appleMeshes.entries()) {
      if (seen.has(id)) {
        continue;
      }

      this.world.remove(entry.frontMesh);
      this.world.remove(entry.backMesh);
      entry.geometry.dispose();
      this.appleMeshes.delete(id);
    }
  }

  private createBasketMesh(): THREE.Mesh<SurfaceDecalGeometry, THREE.MeshStandardMaterial> {
    const basketTexture = createBasketTexture();
    const basketMaterial = new THREE.MeshStandardMaterial({
      map: basketTexture,
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
    const basket = new THREE.Mesh(createSurfaceDecalGeometry(20, 14), basketMaterial);
    basket.renderOrder = 3;
    basket.frustumCulled = false;
    return basket;
  }
}

class FallbackRenderer implements RendererAdapter {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private width = 1;
  private height = 1;
  private readonly dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('2D rendering context is unavailable');
    }
    this.context = context;
    this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
  }

  public resize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  public render(state: GameState): void {
    const ctx = this.context;
    const w = this.width;
    const h = this.height;

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1a1207');
    bg.addColorStop(1, '#090603');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    this.drawFallbackMobius();

    const basketX = lerp(w * 0.36, w * 0.64, state.basketLane / (LANE_COUNT - 1));
    const basketY = h * 0.62;

    for (const apple of state.apples) {
      const laneX = lerp(w * 0.34, w * 0.66, apple.laneIndex / (LANE_COUNT - 1));
      const pathProgress = (Math.cos(apple.u) + 1) * 0.5;
      const verticalCurve = Math.sin(apple.u * 0.5);
      const y = h * 0.22 + pathProgress * h * 0.48 + verticalCurve * h * 0.08;
      const x = laneX + Math.sin(apple.u) * w * 0.08;
      this.drawFallbackApple(x, y, apple.polarity === 'poison');
    }

    this.drawFallbackBasket(basketX, basketY);
  }

  public dispose(): void {
    // No unmanaged GPU resources in fallback mode.
  }

  private drawFallbackMobius(): void {
    const ctx = this.context;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.scale(1.05, 1.2);
    ctx.rotate(0.14);

    ctx.lineWidth = Math.max(16, w * 0.02);
    ctx.strokeStyle = 'rgba(99, 139, 170, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.19, h * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = Math.max(6, w * 0.009);
    ctx.strokeStyle = 'rgba(176, 208, 228, 0.48)';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.17, h * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawFallbackBasket(x: number, y: number): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#ac7440';
    ctx.beginPath();
    ctx.moveTo(-24, -8);
    ctx.lineTo(24, -8);
    ctx.lineTo(20, 14);
    ctx.lineTo(-20, 14);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#e8b472';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -8, 24, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawFallbackApple(x: number, y: number, mirrored: boolean): void {
    const ctx = this.context;
    ctx.save();
    ctx.translate(x, y);
    if (mirrored) {
      ctx.scale(-1, 1);
    }

    const r = 16;
    const gradient = ctx.createRadialGradient(-4, -7, 4, 0, 0, r);
    gradient.addColorStop(0, '#ffc38d');
    gradient.addColorStop(0.35, '#f4543a');
    gradient.addColorStop(1, '#961e1a');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r, -r * 1.2, r * 1.25, -3, r * 0.6, r * 0.9);
    ctx.bezierCurveTo(r * 0.2, r * 1.25, -r * 0.2, r * 1.25, -r * 0.6, r * 0.9);
    ctx.bezierCurveTo(-r * 1.25, -3, -r, -r * 1.2, 0, -r);
    ctx.fill();

    ctx.strokeStyle = '#70461e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.quadraticCurveTo(-7, -28, -12, -20);
    ctx.stroke();

    ctx.fillStyle = '#70d95f';
    ctx.beginPath();
    ctx.ellipse(10, -21, 8, 4, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff4d8';
    ctx.font = 'bold 10px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OK', 0, 2);

    ctx.restore();
  }
}

export function createRenderer(canvas: HTMLCanvasElement): RendererAdapter {
  try {
    return new GameRenderer(canvas);
  } catch (error) {
    console.warn('WebGL unavailable, falling back to Canvas2D renderer.', error);
    return new FallbackRenderer(canvas);
  }
}

export function shouldShowTouchControls(width: number): boolean {
  return width <= 960 || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function basketLaneToPercent(lane: number): number {
  return (lane / (LANE_COUNT - 1)) * 100;
}
