import { AudioEngine } from './game/audio';
import { FIXED_STEP_MS } from './game/config';
import { GameInput } from './game/input';
import { createRenderer, shouldShowTouchControls } from './game/rendering';
import { GameSimulation } from './game/simulation';
import type { AppleDescriptor, GameState } from './game/types';
import { GameUI } from './game/ui';

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
    resetGame: () => void;
    __twistedApplesDebug?: {
      startGame: () => void;
      forcePlaying: () => void;
      injectApple: (apple: AppleDescriptor) => number;
      setBasketLane: (lane: number) => void;
      clearApples: () => void;
      setElapsedMs: (elapsedMs: number) => void;
      getState: () => GameState;
    };
  }
}

const canvas = document.getElementById('game-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing canvas element #game-canvas');
}

const touchLeft = document.getElementById('touch-left');
const touchRight = document.getElementById('touch-right');
if (!(touchLeft instanceof HTMLButtonElement) || !(touchRight instanceof HTMLButtonElement)) {
  throw new Error('Touch control buttons are missing');
}

const simulation = new GameSimulation();
const renderer = createRenderer(canvas);
const audio = new AudioEngine();
const ui = new GameUI();

let touchEnabled = shouldShowTouchControls(window.innerWidth);

const input = new GameInput(touchLeft, touchRight, {
  onPrimaryAction: () => {
    void handlePrimaryAction();
  },
  onPauseToggle: () => {
    const events = simulation.togglePause();
    processEvents(events);
    renderNow();
  },
  onMuteToggle: () => {
    audio.toggleMute();
    renderNow();
  },
  onFullscreenToggle: () => {
    void toggleFullscreen();
  },
});

ui.bind({
  onPrimaryAction: () => {
    void handlePrimaryAction();
  },
});

function processEvents(events: ReturnType<GameSimulation['update']>): void {
  for (const event of events) {
    audio.handleEvent(event.type);
  }
}

function renderNow(): void {
  const snapshot = simulation.getSnapshot();
  const difficulty = simulation.getDifficulty();
  const tier = simulation.getDifficultyTier();

  renderer.render(snapshot);
  ui.render(snapshot, difficulty, tier, audio.isMuted(), touchEnabled);
}

function tick(dtSeconds: number): void {
  simulation.setBasketDirection(input.getHorizontalAxis());
  const events = simulation.update(dtSeconds);
  processEvents(events);
}

async function handlePrimaryAction(): Promise<void> {
  await audio.unlock();

  const mode = simulation.getMode();
  if (mode === 'title' || mode === 'game_over') {
    const events = simulation.startNewRun();
    processEvents(events);
    renderNow();
    return;
  }

  if (mode === 'paused') {
    const events = simulation.togglePause();
    processEvents(events);
    renderNow();
  }
}

async function toggleFullscreen(): Promise<void> {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
    return;
  }

  await document.exitFullscreen();
}

function handleResize(): void {
  renderer.resize(window.innerWidth, window.innerHeight);
  touchEnabled = shouldShowTouchControls(window.innerWidth);
  renderNow();
}

window.addEventListener('resize', handleResize);
document.addEventListener('fullscreenchange', handleResize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && simulation.getMode() === 'playing') {
    const events = simulation.togglePause();
    processEvents(events);
    renderNow();
  }
});

let lastFrame = performance.now();
const rafLoop = (timestamp: number) => {
  const dt = Math.min(0.05, (timestamp - lastFrame) / 1000);
  lastFrame = timestamp;

  tick(dt);
  renderNow();

  requestAnimationFrame(rafLoop);
};

requestAnimationFrame(rafLoop);

window.advanceTime = (ms: number): void => {
  let remaining = Math.max(0, ms);
  while (remaining > 0) {
    const step = Math.min(FIXED_STEP_MS, remaining);
    tick(step / 1000);
    remaining -= step;
  }
  renderNow();
};

window.render_game_to_text = (): string => simulation.renderToText();

window.resetGame = (): void => {
  simulation.resetToTitle();
  audio.setGameplayActive(false);
  renderNow();
};

window.__twistedApplesDebug = {
  startGame: () => {
    processEvents(simulation.startNewRun());
    renderNow();
  },
  forcePlaying: () => {
    simulation.forcePlayingForTest();
    renderNow();
  },
  injectApple: (apple: AppleDescriptor) => {
    const id = simulation.injectAppleForTest(apple);
    renderNow();
    return id;
  },
  setBasketLane: (lane: number) => {
    simulation.setBasketLaneForTest(lane);
    renderNow();
  },
  clearApples: () => {
    simulation.clearApplesForTest();
    renderNow();
  },
  setElapsedMs: (elapsedMs: number) => {
    simulation.setElapsedForTest(elapsedMs);
    renderNow();
  },
  getState: () => simulation.getSnapshot(),
};

window.addEventListener('beforeunload', () => {
  input.dispose();
  renderer.dispose();
  audio.dispose();
});

handleResize();
renderNow();
