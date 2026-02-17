import type { GameEventType } from './types';

const BPM = 120;
const STEP_SECONDS = 60 / BPM / 2;
const MASTER_VOLUME = 0.25;

const MUSIC_STEPS = [
  { semitone: 0, length: 0.16 },
  { semitone: 4, length: 0.16 },
  { semitone: 7, length: 0.2 },
  { semitone: 9, length: 0.16 },
  { semitone: 7, length: 0.12 },
  { semitone: 4, length: 0.16 },
  { semitone: 2, length: 0.2 },
  { semitone: 5, length: 0.2 },
];

function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private loopTimer: number | null = null;
  private stepIndex = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public async unlock(): Promise<void> {
    const context = this.ensureContext();
    if (context.state === 'suspended') {
      await context.resume();
    }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    this.syncMasterGain();
    return this.muted;
  }

  public setMuted(nextMuted: boolean): void {
    this.muted = nextMuted;
    this.syncMasterGain();
  }

  public setGameplayActive(active: boolean): void {
    if (active) {
      this.startMusicLoop();
      return;
    }

    this.stopMusicLoop();
  }

  public handleEvent(eventType: GameEventType): void {
    switch (eventType) {
      case 'catch_ok':
        this.playCatchOk();
        break;
      case 'catch_poison':
        this.playCatchPoison();
        break;
      case 'miss_ok':
        this.playMissOk();
        break;
      case 'miss_poison':
        this.playMissPoison();
        break;
      case 'game_over':
        this.playGameOver();
        this.stopMusicLoop();
        break;
      case 'pause':
        this.stopMusicLoop();
        break;
      case 'resume':
      case 'start':
        this.startMusicLoop();
        break;
      default:
        break;
    }
  }

  public dispose(): void {
    this.stopMusicLoop();
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
    this.masterGain = null;
    this.noiseBuffer = null;
  }

  private ensureContext(): AudioContext {
    if (this.context) {
      return this.context;
    }

    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.syncMasterGain();

    return this.context;
  }

  private syncMasterGain(): void {
    if (!this.masterGain || !this.context) {
      return;
    }

    const gainValue = this.muted ? 0 : MASTER_VOLUME;
    this.masterGain.gain.setTargetAtTime(gainValue, this.context.currentTime, 0.02);
  }

  private startMusicLoop(): void {
    if (this.loopTimer !== null) {
      return;
    }

    const context = this.ensureContext();
    const tick = () => {
      const step = MUSIC_STEPS[this.stepIndex % MUSIC_STEPS.length];
      this.stepIndex += 1;

      const baseMidi = 72;
      const frequency = midiToHz(baseMidi + step.semitone);
      this.playTone(frequency, step.length, 'square', 0.13, 0.007);
    };

    tick();
    this.loopTimer = window.setInterval(tick, STEP_SECONDS * 1000);

    if (context.state === 'suspended') {
      void context.resume();
    }
  }

  private stopMusicLoop(): void {
    if (this.loopTimer === null) {
      return;
    }

    window.clearInterval(this.loopTimer);
    this.loopTimer = null;
  }

  private playTone(
    frequency: number,
    durationSeconds: number,
    waveType: OscillatorType,
    peak: number,
    attackSeconds: number,
  ): void {
    const context = this.ensureContext();
    const output = this.masterGain;

    if (!output) {
      return;
    }

    const now = context.currentTime;
    const osc = context.createOscillator();
    const amp = context.createGain();

    osc.type = waveType;
    osc.frequency.setValueAtTime(frequency, now);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + attackSeconds);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(attackSeconds + 0.01, durationSeconds));

    osc.connect(amp);
    amp.connect(output);

    osc.start(now);
    osc.stop(now + durationSeconds + 0.06);
  }

  private playNoise(durationSeconds: number, peak: number): void {
    const context = this.ensureContext();
    const output = this.masterGain;
    if (!output) {
      return;
    }

    if (!this.noiseBuffer) {
      const sampleCount = Math.floor(context.sampleRate * 1);
      const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < sampleCount; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }

    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1600;
    filter.Q.value = 0.6;

    const amp = context.createGain();
    const now = context.currentTime;
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

    source.connect(filter);
    filter.connect(amp);
    amp.connect(output);

    source.start(now);
    source.stop(now + durationSeconds + 0.03);
  }

  private playCatchOk(): void {
    const context = this.ensureContext();
    const now = context.currentTime;

    this.playTone(680, 0.09, 'square', 0.17, 0.004);

    const osc = context.createOscillator();
    const amp = context.createGain();
    const output = this.masterGain;
    if (!output) {
      return;
    }

    osc.type = 'square';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(1040, now + 0.08);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(amp);
    amp.connect(output);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  private playCatchPoison(): void {
    const context = this.ensureContext();
    const now = context.currentTime;
    const output = this.masterGain;
    if (!output) {
      return;
    }

    const osc = context.createOscillator();
    const amp = context.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.18);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(0.2, now + 0.015);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.connect(amp);
    amp.connect(output);

    osc.start(now);
    osc.stop(now + 0.22);

    this.playNoise(0.12, 0.08);
  }

  private playMissOk(): void {
    const context = this.ensureContext();
    const now = context.currentTime;
    const output = this.masterGain;
    if (!output) {
      return;
    }

    const osc = context.createOscillator();
    const amp = context.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(560, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.2);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(amp);
    amp.connect(output);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  private playMissPoison(): void {
    this.playTone(520, 0.07, 'square', 0.12, 0.006);
    this.playTone(730, 0.06, 'square', 0.08, 0.004);
  }

  private playGameOver(): void {
    const context = this.ensureContext();
    const now = context.currentTime;

    const notes = [62, 57, 53, 50];
    notes.forEach((note, index) => {
      const delay = index * 0.13;
      const osc = context.createOscillator();
      const amp = context.createGain();
      const output = this.masterGain;
      if (!output) {
        return;
      }

      osc.type = 'square';
      osc.frequency.setValueAtTime(midiToHz(note), now + delay);
      amp.gain.setValueAtTime(0.0001, now + delay);
      amp.gain.exponentialRampToValueAtTime(0.14, now + delay + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.12);

      osc.connect(amp);
      amp.connect(output);
      osc.start(now + delay);
      osc.stop(now + delay + 0.14);
    });
  }
}
