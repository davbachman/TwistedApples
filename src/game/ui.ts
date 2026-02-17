import type { DifficultyState, GameState } from './types';

interface UIActions {
  onPrimaryAction: () => void;
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: ${id}`);
  }
  return element as T;
}

export class GameUI {
  private readonly hud = byId<HTMLDivElement>('hud');
  private readonly score = byId<HTMLSpanElement>('hud-score');
  private readonly lives = byId<HTMLSpanElement>('hud-lives');
  private readonly time = byId<HTMLSpanElement>('hud-time');
  private readonly tier = byId<HTMLSpanElement>('hud-tier');
  private readonly audio = byId<HTMLSpanElement>('hud-audio');
  private readonly status = byId<HTMLSpanElement>('hud-status');

  private readonly titlePanel = byId<HTMLDivElement>('title-panel');
  private readonly gameOverPanel = byId<HTMLDivElement>('game-over-panel');

  private readonly finalScore = byId<HTMLSpanElement>('final-score');

  private readonly startButton = byId<HTMLButtonElement>('start-button');
  private readonly restartButton = byId<HTMLButtonElement>('restart-button');

  private readonly touchControls = byId<HTMLDivElement>('touch-controls');

  public bind(actions: UIActions): void {
    this.startButton.addEventListener('click', () => {
      actions.onPrimaryAction();
    });

    this.restartButton.addEventListener('click', () => {
      actions.onPrimaryAction();
    });

    this.titlePanel.addEventListener('pointerdown', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'BUTTON') {
        return;
      }
      actions.onPrimaryAction();
    });

    this.gameOverPanel.addEventListener('pointerdown', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'BUTTON') {
        return;
      }
      actions.onPrimaryAction();
    });
  }

  public render(
    state: GameState,
    difficulty: DifficultyState,
    difficultyTier: number,
    muted: boolean,
    showTouchControls: boolean,
  ): void {
    this.score.textContent = String(state.score);
    this.lives.textContent = String(state.lives);
    this.time.textContent = `${(state.elapsedMs / 1000).toFixed(1)}s`;
    this.tier.textContent = `${difficultyTier} (${difficulty.speedRadPerSec.toFixed(2)}rad/s)`;
    this.audio.textContent = muted ? 'MUTED' : 'ON';

    let statusText = 'READY';
    if (state.mode === 'playing') {
      statusText = 'RUNNING';
    } else if (state.mode === 'paused') {
      statusText = 'PAUSED';
    } else if (state.mode === 'game_over') {
      statusText = 'GAME OVER';
    }
    this.status.textContent = statusText;

    this.titlePanel.dataset.visible = state.mode === 'title' ? 'true' : 'false';
    this.gameOverPanel.dataset.visible = state.mode === 'game_over' ? 'true' : 'false';

    this.finalScore.textContent = String(state.score);

    if (state.mode === 'title') {
      this.hud.classList.add('hidden');
    } else {
      this.hud.classList.remove('hidden');
    }

    const touchVisible = showTouchControls && (state.mode === 'playing' || state.mode === 'paused');
    this.touchControls.classList.toggle('hidden', !touchVisible);
  }
}
