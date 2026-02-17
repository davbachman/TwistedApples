interface InputCallbacks {
  onPrimaryAction: () => void;
  onPauseToggle: () => void;
  onMuteToggle: () => void;
  onFullscreenToggle: () => void;
}

const LEFT_KEYS = new Set(['ArrowLeft', 'a', 'A']);
const RIGHT_KEYS = new Set(['ArrowRight', 'd', 'D']);
const PRIMARY_KEYS = new Set(['Enter', ' ']);

export class GameInput {
  private leftKeyHeld = false;
  private rightKeyHeld = false;

  private readonly leftPointers = new Set<number>();
  private readonly rightPointers = new Set<number>();

  private readonly callbacks: InputCallbacks;
  private readonly touchLeftButton: HTMLButtonElement;
  private readonly touchRightButton: HTMLButtonElement;

  private readonly onKeyDownBound: (event: KeyboardEvent) => void;
  private readonly onKeyUpBound: (event: KeyboardEvent) => void;

  constructor(
    touchLeftButton: HTMLButtonElement,
    touchRightButton: HTMLButtonElement,
    callbacks: InputCallbacks,
  ) {
    this.touchLeftButton = touchLeftButton;
    this.touchRightButton = touchRightButton;
    this.callbacks = callbacks;

    this.onKeyDownBound = (event) => this.onKeyDown(event);
    this.onKeyUpBound = (event) => this.onKeyUp(event);

    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);

    this.bindTouch(this.touchLeftButton, this.leftPointers);
    this.bindTouch(this.touchRightButton, this.rightPointers);
  }

  public getHorizontalAxis(): number {
    const keyAxis = (this.leftKeyHeld ? -1 : 0) + (this.rightKeyHeld ? 1 : 0);
    const touchAxis = (this.leftPointers.size > 0 ? -1 : 0) + (this.rightPointers.size > 0 ? 1 : 0);
    return Math.max(-1, Math.min(1, keyAxis + touchAxis));
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (LEFT_KEYS.has(event.key)) {
      this.leftKeyHeld = true;
      event.preventDefault();
      return;
    }

    if (RIGHT_KEYS.has(event.key)) {
      this.rightKeyHeld = true;
      event.preventDefault();
      return;
    }

    if (PRIMARY_KEYS.has(event.key) && !event.repeat) {
      this.callbacks.onPrimaryAction();
      event.preventDefault();
      return;
    }

    if ((event.key === 'p' || event.key === 'P') && !event.repeat) {
      this.callbacks.onPauseToggle();
      event.preventDefault();
      return;
    }

    if ((event.key === 'm' || event.key === 'M') && !event.repeat) {
      this.callbacks.onMuteToggle();
      event.preventDefault();
      return;
    }

    if ((event.key === 'f' || event.key === 'F') && !event.repeat) {
      this.callbacks.onFullscreenToggle();
      event.preventDefault();
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (LEFT_KEYS.has(event.key)) {
      this.leftKeyHeld = false;
      event.preventDefault();
      return;
    }

    if (RIGHT_KEYS.has(event.key)) {
      this.rightKeyHeld = false;
      event.preventDefault();
    }
  }

  private bindTouch(button: HTMLButtonElement, pointerSet: Set<number>): void {
    const pointerDown = (event: PointerEvent) => {
      pointerSet.add(event.pointerId);
      button.setPointerCapture(event.pointerId);
      event.preventDefault();
    };

    const clearPointer = (event: PointerEvent) => {
      pointerSet.delete(event.pointerId);
      event.preventDefault();
    };

    button.addEventListener('pointerdown', pointerDown);
    button.addEventListener('pointerup', clearPointer);
    button.addEventListener('pointercancel', clearPointer);
    button.addEventListener('pointerleave', clearPointer);

    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }
}
