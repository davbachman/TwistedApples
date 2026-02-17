import { expect, test } from '@playwright/test';
import { U_CATCH } from '../../src/game/config';

function wrapAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  let wrapped = (angle + Math.PI) % twoPi;
  if (wrapped < 0) {
    wrapped += twoPi;
  }
  return wrapped - Math.PI;
}

interface RenderPayload {
  mode: string;
  score: number;
  lives: number;
  apples: Array<{ id: number; laneIndex: number; polarity: 'ok' | 'poison'; worldY: number }>;
  basket: { laneIndex: number };
}

test('starts game and responds to keyboard/touch movement', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game' }).click();

  const before = await page.evaluate<RenderPayload>(() =>
    JSON.parse(window.render_game_to_text()) as RenderPayload,
  );
  expect(before.mode).toBe('playing');

  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => window.advanceTime(500));
  await page.keyboard.up('ArrowRight');

  const afterRight = await page.evaluate<RenderPayload>(() =>
    JSON.parse(window.render_game_to_text()) as RenderPayload,
  );
  expect(afterRight.basket.laneIndex).toBeGreaterThan(before.basket.laneIndex);

  await page.locator('#touch-left').dispatchEvent('pointerdown', { pointerId: 3, pointerType: 'touch' });
  await page.evaluate(() => window.advanceTime(450));
  await page.locator('#touch-left').dispatchEvent('pointerup', { pointerId: 3, pointerType: 'touch' });

  const afterTouch = await page.evaluate<RenderPayload>(() =>
    JSON.parse(window.render_game_to_text()) as RenderPayload,
  );
  expect(afterTouch.basket.laneIndex).toBeLessThan(afterRight.basket.laneIndex);
});

test('scores catches/misses, flips orientation, and supports restart', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.__twistedApplesDebug?.startGame());
  const catchNear = U_CATCH + 0.05;

  await page.evaluate((u) => {
    window.__twistedApplesDebug?.clearApples();
    window.__twistedApplesDebug?.setBasketLane(3);
    window.__twistedApplesDebug?.injectApple({ u, laneIndex: 3, polarity: 'ok' });
  }, catchNear);
  await page.evaluate(() => window.advanceTime(50));

  let state = await page.evaluate<RenderPayload>(() => JSON.parse(window.render_game_to_text()) as RenderPayload);
  expect(state.score).toBe(10);
  expect(state.lives).toBe(3);

  await page.evaluate((u) => {
    window.__twistedApplesDebug?.injectApple({ u, laneIndex: 3, polarity: 'poison' });
  }, catchNear);
  await page.evaluate(() => window.advanceTime(50));

  state = await page.evaluate<RenderPayload>(() => JSON.parse(window.render_game_to_text()) as RenderPayload);
  expect(state.score).toBe(-10);
  expect(state.lives).toBe(2);

  await page.evaluate((u) => {
    window.__twistedApplesDebug?.setBasketLane(0);
    window.__twistedApplesDebug?.injectApple({ u, laneIndex: 6, polarity: 'poison' });
  }, catchNear);
  await page.evaluate(() => window.advanceTime(50));

  state = await page.evaluate<RenderPayload>(() => JSON.parse(window.render_game_to_text()) as RenderPayload);
  expect(state.score).toBe(-5);
  const missedPoison = state.apples.find((apple) => apple.laneIndex === 6);
  expect(missedPoison?.polarity).toBe('poison');

  await page.evaluate(() => window.advanceTime(6000));
  state = await page.evaluate<RenderPayload>(() => JSON.parse(window.render_game_to_text()) as RenderPayload);
  const returnedPoison = state.apples.find((apple) => apple.laneIndex === 6);
  expect(returnedPoison?.polarity).toBe('ok');

  await page.evaluate((u) => {
    window.__twistedApplesDebug?.clearApples();
    window.__twistedApplesDebug?.setBasketLane(3);
    window.__twistedApplesDebug?.injectApple({ u, laneIndex: 3, polarity: 'poison' });
    window.__twistedApplesDebug?.injectApple({ u, laneIndex: 3, polarity: 'poison' });
  }, catchNear);
  await page.evaluate(() => window.advanceTime(120));

  state = await page.evaluate<RenderPayload>(() => JSON.parse(window.render_game_to_text()) as RenderPayload);
  expect(state.mode).toBe('game_over');
  expect(state.lives).toBe(0);

  await page.keyboard.press('Enter');
  await page.evaluate(() => window.advanceTime(16));

  state = await page.evaluate<RenderPayload>(() => JSON.parse(window.render_game_to_text()) as RenderPayload);
  expect(state.mode).toBe('playing');
  expect(state.score).toBe(0);
  expect(state.lives).toBe(3);
});

test('apple descends while approaching basket on front side', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.__twistedApplesDebug?.startGame());
  const descentStartU = wrapAngle(U_CATCH + 0.4);

  await page.evaluate((u) => {
    window.__twistedApplesDebug?.clearApples();
    window.__twistedApplesDebug?.setBasketLane(1);
    window.__twistedApplesDebug?.injectApple({ u, laneIndex: 1, polarity: 'ok' });
  }, descentStartU);

  const startY = await page.evaluate<number>(() => {
    const payload = JSON.parse(window.render_game_to_text()) as RenderPayload;
    return payload.apples[0]?.worldY ?? 0;
  });

  await page.evaluate(() => window.advanceTime(220));

  const endY = await page.evaluate<number>(() => {
    const payload = JSON.parse(window.render_game_to_text()) as RenderPayload;
    return payload.apples[0]?.worldY ?? 0;
  });

  expect(endY).toBeLessThan(startY);
});
