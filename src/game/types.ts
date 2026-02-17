export type GameMode = 'title' | 'playing' | 'paused' | 'game_over';

export type ApplePolarity = 'ok' | 'poison';

export interface AppleState {
  id: number;
  u: number;
  laneIndex: number;
  polarity: ApplePolarity;
  pendingFlipOnReturn: boolean;
  active: boolean;
}

export interface DifficultyState {
  spawnIntervalMs: number;
  speedRadPerSec: number;
}

export interface GameState {
  mode: GameMode;
  score: number;
  lives: number;
  elapsedMs: number;
  basketLane: number;
  apples: AppleState[];
}

export type GameEventType =
  | 'start'
  | 'pause'
  | 'resume'
  | 'game_over'
  | 'catch_ok'
  | 'catch_poison'
  | 'miss_ok'
  | 'miss_poison';

export interface GameEvent {
  type: GameEventType;
  appleId?: number;
}

export interface AppleDescriptor {
  u: number;
  laneIndex: number;
  polarity: ApplePolarity;
}
