import { describe, expect, it } from 'vitest';

import { U_CATCH } from '../game/config';
import { GameSimulation } from '../game/simulation';

function createSim(): GameSimulation {
  const sim = new GameSimulation(() => 0.42);
  sim.startNewRun();
  sim.clearApplesForTest();
  return sim;
}

describe('GameSimulation scoring rules', () => {
  it('awards points for catching OK apples', () => {
    const sim = createSim();
    sim.setBasketLaneForTest(3);
    sim.injectAppleForTest({ u: U_CATCH + 0.04, laneIndex: 3, polarity: 'ok' });

    const events = sim.update(1 / 60);
    const snapshot = sim.getSnapshot();

    expect(events.some((event) => event.type === 'catch_ok')).toBe(true);
    expect(snapshot.score).toBe(10);
    expect(snapshot.lives).toBe(3);
    expect(snapshot.apples.length).toBe(0);
  });

  it('penalizes catching poison apples', () => {
    const sim = createSim();
    sim.setBasketLaneForTest(2);
    sim.injectAppleForTest({ u: U_CATCH + 0.03, laneIndex: 2, polarity: 'poison' });

    const events = sim.update(1 / 60);
    const snapshot = sim.getSnapshot();

    expect(events.some((event) => event.type === 'catch_poison')).toBe(true);
    expect(snapshot.score).toBe(-20);
    expect(snapshot.lives).toBe(2);
    expect(snapshot.apples.length).toBe(0);
  });

  it('does not decrement life for missed OK apples and defers orientation flip', () => {
    const sim = createSim();
    sim.setBasketLaneForTest(0);
    const appleId = sim.injectAppleForTest({ u: U_CATCH + 0.05, laneIndex: 6, polarity: 'ok' });

    const events = sim.update(1 / 60);
    const snapshot = sim.getSnapshot();
    const apple = snapshot.apples.find((item) => item.id === appleId);

    expect(events.some((event) => event.type === 'miss_ok')).toBe(true);
    expect(snapshot.lives).toBe(3);
    expect(apple?.polarity).toBe('ok');
    expect(apple?.pendingFlipOnReturn).toBe(true);
  });

  it('awards points for missing poison apples without immediate orientation flip', () => {
    const sim = createSim();
    sim.setBasketLaneForTest(0);
    const appleId = sim.injectAppleForTest({ u: U_CATCH + 0.05, laneIndex: 6, polarity: 'poison' });

    const events = sim.update(1 / 60);
    const snapshot = sim.getSnapshot();
    const apple = snapshot.apples.find((item) => item.id === appleId);

    expect(events.some((event) => event.type === 'miss_poison')).toBe(true);
    expect(snapshot.score).toBe(5);
    expect(apple?.polarity).toBe('poison');
    expect(apple?.pendingFlipOnReturn).toBe(true);
  });

  it('flips missed apple orientation after crossing the return line', () => {
    const sim = createSim();
    sim.setBasketLaneForTest(0);
    const appleId = sim.injectAppleForTest({ u: U_CATCH + 0.05, laneIndex: 6, polarity: 'ok' });

    sim.update(1 / 60);

    let flipped = false;
    for (let i = 0; i < 700; i += 1) {
      sim.update(1 / 60);
      const current = sim.getSnapshot().apples.find((item) => item.id === appleId);
      if (current?.polarity === 'poison' && !current.pendingFlipOnReturn) {
        flipped = true;
        break;
      }
    }

    const snapshot = sim.getSnapshot();
    const apple = snapshot.apples.find((item) => item.id === appleId);

    expect(flipped).toBe(true);
    expect(apple).toBeDefined();
    expect(apple?.polarity).toBe('poison');
    expect(apple?.pendingFlipOnReturn).toBe(false);
  });

  it('ramps spawn interval and speed to configured limits', () => {
    const sim = createSim();

    sim.setElapsedForTest(0);
    const atStart = sim.getDifficulty();

    sim.setElapsedForTest(180_000);
    const atRampCap = sim.getDifficulty();

    expect(atStart.spawnIntervalMs).toBeCloseTo(1600, 5);
    expect(atStart.speedRadPerSec).toBeCloseTo(0.62, 5);
    expect(atRampCap.spawnIntervalMs).toBeCloseTo(650, 5);
    expect(atRampCap.speedRadPerSec).toBeCloseTo(1.35, 5);
  });
});
