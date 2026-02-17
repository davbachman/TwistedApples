import {
  APPLE_DECAL_WIDTH,
  BASE_SPAWN_INTERVAL_MS,
  BASKET_DECAL_WIDTH,
  BASE_SPEED_RAD_PER_SEC,
  BASKET_SPEED_LANES_PER_SEC,
  CATCH_LANE_THRESHOLD,
  CATCH_WINDOW_RAD,
  DECAL_EDGE_PADDING,
  LANE_COUNT,
  MAX_APPLES,
  MAX_SPEED_RAD_PER_SEC,
  MIN_SPAWN_INTERVAL_MS,
  MOBIUS_HALF_WIDTH,
  RAMP_DURATION_MS,
  SCORE_OK_CATCH,
  SCORE_POISON_CATCH,
  SCORE_POISON_MISS,
  STARTING_LIVES,
  U_CATCH,
  U_SPAWN,
} from './config';
import { clamp, laneIndexToV, lerp, mobiusWorldPoint, wrapAngle } from './mobius';
import type {
  AppleDescriptor,
  ApplePolarity,
  AppleState,
  DifficultyState,
  GameEvent,
  GameMode,
  GameState,
} from './types';

interface SimApple extends AppleState {
  inCatchWindow: boolean;
  inSpawnWindow: boolean;
}

const DIFFICULTY_TIER_COUNT = 5;
const SPAWN_FLIP_WINDOW_RAD = 0.12;
// Decal width spans the strip-width direction for the current on-surface UV orientation.
const APPLE_BAND_MARGIN = APPLE_DECAL_WIDTH * 0.5 + DECAL_EDGE_PADDING;
const BASKET_BAND_MARGIN = BASKET_DECAL_WIDTH * 0.5 + DECAL_EDGE_PADDING;

function laneFromV(v: number): number {
  const t = (v + MOBIUS_HALF_WIDTH) / (2 * MOBIUS_HALF_WIDTH);
  return t * (LANE_COUNT - 1);
}

const BASKET_MIN_LANE = laneFromV(-MOBIUS_HALF_WIDTH + BASKET_BAND_MARGIN);
const BASKET_MAX_LANE = laneFromV(MOBIUS_HALF_WIDTH - BASKET_BAND_MARGIN);
const ALLOWED_APPLE_LANES = Array.from({ length: LANE_COUNT }, (_, lane) => lane).filter((lane) => {
  const v = laneIndexToV(lane);
  return Math.abs(v) <= MOBIUS_HALF_WIDTH - APPLE_BAND_MARGIN;
});
const FALLBACK_APPLE_LANES = ALLOWED_APPLE_LANES.length > 0 ? ALLOWED_APPLE_LANES : [Math.floor((LANE_COUNT - 1) * 0.5)];

function flipPolarity(polarity: ApplePolarity): ApplePolarity {
  return polarity === 'ok' ? 'poison' : 'ok';
}

function createState(mode: GameMode): GameState {
  return {
    mode,
    score: 0,
    lives: STARTING_LIVES,
    elapsedMs: 0,
    basketLane: (LANE_COUNT - 1) * 0.5,
    apples: [],
  };
}

export class GameSimulation {
  private readonly rng: () => number;

  private state: GameState = createState('title');
  private apples: SimApple[] = [];

  private nextAppleId = 1;
  private spawnTimerMs = 0;
  private basketDirection = 0;
  private basketLane = clamp((LANE_COUNT - 1) * 0.5, BASKET_MIN_LANE, BASKET_MAX_LANE);

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  public getMode(): GameMode {
    return this.state.mode;
  }

  public getDifficulty(): DifficultyState {
    const t = clamp(this.state.elapsedMs / RAMP_DURATION_MS, 0, 1);
    return {
      spawnIntervalMs: lerp(BASE_SPAWN_INTERVAL_MS, MIN_SPAWN_INTERVAL_MS, t),
      speedRadPerSec: lerp(BASE_SPEED_RAD_PER_SEC, MAX_SPEED_RAD_PER_SEC, t),
    };
  }

  public getDifficultyTier(): number {
    const t = clamp(this.state.elapsedMs / RAMP_DURATION_MS, 0, 1);
    return 1 + Math.floor(t * (DIFFICULTY_TIER_COUNT - 1));
  }

  public getSnapshot(): GameState {
    return {
      mode: this.state.mode,
      score: this.state.score,
      lives: this.state.lives,
      elapsedMs: this.state.elapsedMs,
      basketLane: this.basketLane,
      apples: this.apples.map((apple) => ({
        id: apple.id,
        u: apple.u,
        laneIndex: apple.laneIndex,
        polarity: apple.polarity,
        pendingFlipOnReturn: apple.pendingFlipOnReturn,
        active: apple.active,
      })),
    };
  }

  public renderToText(): string {
    const snapshot = this.getSnapshot();
    const difficulty = this.getDifficulty();
    const basketV = laneIndexToV(snapshot.basketLane);
    const basketWorldPoint = mobiusWorldPoint(U_CATCH, basketV);

    return JSON.stringify({
      mode: snapshot.mode,
      score: snapshot.score,
      lives: snapshot.lives,
      elapsedMs: Math.round(snapshot.elapsedMs),
      coordinateSystem:
        'world origin at loop center; +x right, +y up, +z toward camera. Mobius coordinates: u radians around loop, v across strip from left(-) to right(+).',
      basket: {
        u: U_CATCH,
        v: basketV,
        laneIndex: Number(snapshot.basketLane.toFixed(3)),
        worldX: Number(basketWorldPoint.x.toFixed(4)),
        worldY: Number(basketWorldPoint.y.toFixed(4)),
        worldZ: Number(basketWorldPoint.z.toFixed(4)),
      },
      apples: snapshot.apples.map((apple) => ({
        ...(function buildAppleCoordinates() {
          const appleV = laneIndexToV(apple.laneIndex);
          const worldPoint = mobiusWorldPoint(apple.u, appleV);
          return {
            v: appleV,
            worldX: Number(worldPoint.x.toFixed(4)),
            worldY: Number(worldPoint.y.toFixed(4)),
            worldZ: Number(worldPoint.z.toFixed(4)),
          };
        })(),
        id: apple.id,
        u: Number(apple.u.toFixed(4)),
        laneIndex: apple.laneIndex,
        polarity: apple.polarity,
        state: apple.active ? 'active' : 'inactive',
      })),
      difficulty: {
        spawnIntervalMs: Number(difficulty.spawnIntervalMs.toFixed(2)),
        speedRadPerSec: Number(difficulty.speedRadPerSec.toFixed(4)),
      },
    });
  }

  public setBasketDirection(direction: number): void {
    this.basketDirection = clamp(direction, -1, 1);
  }

  public startNewRun(): GameEvent[] {
    this.state = createState('playing');
    this.apples = [];
    this.spawnTimerMs = 0;
    this.basketLane = clamp((LANE_COUNT - 1) * 0.5, BASKET_MIN_LANE, BASKET_MAX_LANE);
    this.basketDirection = 0;
    return [{ type: 'start' }];
  }

  public resetToTitle(): void {
    this.state = createState('title');
    this.apples = [];
    this.spawnTimerMs = 0;
    this.basketDirection = 0;
    this.basketLane = clamp((LANE_COUNT - 1) * 0.5, BASKET_MIN_LANE, BASKET_MAX_LANE);
  }

  public togglePause(): GameEvent[] {
    if (this.state.mode === 'playing') {
      this.state.mode = 'paused';
      return [{ type: 'pause' }];
    }

    if (this.state.mode === 'paused') {
      this.state.mode = 'playing';
      return [{ type: 'resume' }];
    }

    return [];
  }

  public update(dtSeconds: number): GameEvent[] {
    const events: GameEvent[] = [];
    if (this.state.mode !== 'playing') {
      return events;
    }

    const dtMs = dtSeconds * 1000;
    this.state.elapsedMs += dtMs;

    this.basketLane = clamp(
      this.basketLane + this.basketDirection * BASKET_SPEED_LANES_PER_SEC * dtSeconds,
      BASKET_MIN_LANE,
      BASKET_MAX_LANE,
    );

    const difficulty = this.getDifficulty();

    this.spawnTimerMs += dtMs;
    while (this.spawnTimerMs >= difficulty.spawnIntervalMs) {
      this.spawnTimerMs -= difficulty.spawnIntervalMs;
      this.spawnApple();
    }

    for (let index = this.apples.length - 1; index >= 0; index -= 1) {
      const apple = this.apples[index];
      const previousU = apple.u;

      // Keep u continuous to avoid visual jumps at the Mobius seam.
      apple.u -= difficulty.speedRadPerSec * dtSeconds;

      const previousCatchAngle = wrapAngle(previousU - U_CATCH);
      const currentCatchAngle = wrapAngle(apple.u - U_CATCH);
      const inCatchWindow = Math.abs(currentCatchAngle) <= CATCH_WINDOW_RAD;
      const crossedCatchLine = previousCatchAngle > 0 && currentCatchAngle <= 0;
      const startedInsideCatchWindow = Math.abs(previousCatchAngle) <= CATCH_WINDOW_RAD;
      const shouldResolveCatch = crossedCatchLine || (startedInsideCatchWindow && inCatchWindow && !apple.inCatchWindow);
      const inSpawnWindow = Math.abs(wrapAngle(apple.u - U_SPAWN)) <= SPAWN_FLIP_WINDOW_RAD;

      if (shouldResolveCatch) {
        this.resolveCatchWindow(index, apple, events);
      }

      if (apple.pendingFlipOnReturn && inSpawnWindow && !apple.inSpawnWindow) {
        apple.polarity = flipPolarity(apple.polarity);
        apple.pendingFlipOnReturn = false;
      }

      apple.inCatchWindow = inCatchWindow;
      apple.inSpawnWindow = inSpawnWindow;
    }

    if (this.state.lives <= 0 && this.state.mode === 'playing') {
      this.state.mode = 'game_over';
      events.push({ type: 'game_over' });
    }

    return events;
  }

  public injectAppleForTest(descriptor: AppleDescriptor): number {
    const id = this.nextAppleId;
    this.nextAppleId += 1;

    const apple: SimApple = {
      id,
      u: descriptor.u,
      laneIndex: clamp(Math.round(descriptor.laneIndex), 0, LANE_COUNT - 1),
      polarity: descriptor.polarity,
      pendingFlipOnReturn: false,
      active: true,
      inCatchWindow: false,
      inSpawnWindow: false,
    };

    if (this.apples.length >= MAX_APPLES) {
      this.apples.shift();
    }

    this.apples.push(apple);
    return id;
  }

  public setBasketLaneForTest(lane: number): void {
    this.basketLane = clamp(lane, BASKET_MIN_LANE, BASKET_MAX_LANE);
  }

  public forcePlayingForTest(): void {
    this.state.mode = 'playing';
  }

  public clearApplesForTest(): void {
    this.apples = [];
  }

  public setElapsedForTest(elapsedMs: number): void {
    this.state.elapsedMs = Math.max(0, elapsedMs);
  }

  private spawnApple(): void {
    if (this.apples.length >= MAX_APPLES) {
      return;
    }

    const laneIndex = FALLBACK_APPLE_LANES[Math.floor(this.rng() * FALLBACK_APPLE_LANES.length)];
    const polarity: ApplePolarity = this.rng() < 0.5 ? 'ok' : 'poison';

    const apple: SimApple = {
      id: this.nextAppleId,
      u: U_SPAWN,
      laneIndex,
      polarity,
      pendingFlipOnReturn: false,
      active: true,
      inCatchWindow: false,
      inSpawnWindow: false,
    };

    this.nextAppleId += 1;
    this.apples.push(apple);
  }

  private resolveCatchWindow(index: number, apple: SimApple, events: GameEvent[]): void {
    const appleCatchLane = this.getCatchLaneForApple(apple);
    const caught = Math.abs(appleCatchLane - this.basketLane) <= CATCH_LANE_THRESHOLD;

    if (caught) {
      if (apple.polarity === 'ok') {
        this.state.score += SCORE_OK_CATCH;
        events.push({ type: 'catch_ok', appleId: apple.id });
      } else {
        this.state.score += SCORE_POISON_CATCH;
        this.state.lives -= 1;
        events.push({ type: 'catch_poison', appleId: apple.id });
      }

      this.apples.splice(index, 1);
      return;
    }

    if (apple.polarity === 'ok') {
      events.push({ type: 'miss_ok', appleId: apple.id });
    } else {
      this.state.score += SCORE_POISON_MISS;
      events.push({ type: 'miss_poison', appleId: apple.id });
    }

    apple.pendingFlipOnReturn = true;
  }

  private getCatchLaneForApple(apple: SimApple): number {
    const laneV = laneIndexToV(apple.laneIndex);
    // Möbius traversal flips strip-width direction every full loop.
    const catchSideSign = Math.cos(apple.u * 0.5) >= 0 ? 1 : -1;
    const effectiveVAtCatch = laneV * catchSideSign;
    return laneFromV(effectiveVAtCatch);
  }
}
