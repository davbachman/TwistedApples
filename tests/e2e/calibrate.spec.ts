import { expect, test } from '@playwright/test';

interface CalibrationPayload {
  worldScale: { x: number; y: number; z: number };
  camera: { x: number; y: number; z: number; lookAtX: number; lookAtY: number; lookAtZ: number; fov: number };
  lighting: { hemi: number; key: number; back: number; ambient: number };
  seed: number;
  applePlacements: Array<{ u: number; laneIndex: number; polarity: 'ok' | 'poison' }>;
}

test('calibration helper supports wheel tuning, randomization, and exports', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto('/calibrate.html');
  await expect(page.locator('#calibrate-canvas')).toBeVisible();
  await expect(page.locator('#param-list .param-row')).toHaveCount(14);

  const before = await page.evaluate<CalibrationPayload>(() =>
    JSON.parse(window.exportCalibrationSettings()) as CalibrationPayload,
  );

  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(80);

  const afterWheel = await page.evaluate<CalibrationPayload>(() =>
    JSON.parse(window.exportCalibrationSettings()) as CalibrationPayload,
  );
  expect(afterWheel.worldScale.x).not.toBe(before.worldScale.x);

  await page.keyboard.press('r');
  await page.waitForTimeout(80);

  const afterRandomize = await page.evaluate<CalibrationPayload>(() =>
    JSON.parse(window.exportCalibrationSettings()) as CalibrationPayload,
  );
  expect(afterRandomize.applePlacements.length).toBe(before.applePlacements.length);
  expect(afterRandomize.seed).not.toBe(before.seed);
  expect(JSON.stringify(afterRandomize.applePlacements)).not.toBe(JSON.stringify(before.applePlacements));

  const patch = await page.evaluate(() => window.exportCalibrationPatch());
  expect(patch).toContain('export const WORLD_SCALE');
  expect(patch).toContain('export const CAMERA_SETTINGS');
  expect(patch).toContain('export const LIGHT_SETTINGS');

  expect(consoleErrors).toEqual([]);
});
