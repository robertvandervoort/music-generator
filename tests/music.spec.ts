import { expect, test } from '@playwright/test';
import { Rng } from '../src/audio/Rng';
import { TuringMachine } from '../src/audio/TuringMachine';
import { RhythmEngine } from '../src/audio/RhythmEngine';
import { Conductor } from '../src/audio/Conductor';

test('a seed reproduces Turing, rhythm, and arrangement decisions', () => {
  const makeRun = () => {
    const rng = new Rng('quiet-moon-42');
    const turing = new TuringMachine(16, rng);
    turing.setProbability(0.14);
    const rhythm = new RhythmEngine(rng);
    rhythm.setKit('Handpan & Udu');
    rhythm.setMode('Generative');
    rhythm.setDensity(0.38);
    const conductor = new Conductor(rng);
    conductor.enabled = true;
    conductor.form = 'Arc';
    return {
      bits: Array.from({ length: 32 }, () => turing.step()),
      hits: Array.from({ length: 16 }, (_, step) => rhythm.hitsAt(step)),
      sections: Array.from({ length: 24 }, () => conductor.advanceBar()),
    };
  };
  expect(makeRun()).toEqual(makeRun());
});

test('percussion and conductor controls render and remain optional', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await expect(page.getByLabel('Percussion kit')).toHaveValue('Off');
  await expect(page.getByText('ritual space', { exact: true })).toBeVisible();
  await expect(page.getByText('Built-in', { exact: true })).toBeVisible();
  const percussionControls = page.locator('.control-group').filter({ hasText: 'Percussion' });
  await expect(percussionControls.getByText('Reverb Mix', { exact: true })).toBeVisible();
  await expect(percussionControls.getByText('Room Size', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Enable conductor')).not.toBeChecked();
  await page.getByLabel('Percussion kit').selectOption('Frame & Shaker');
  await page.getByLabel('Rhythm mode').selectOption('Generative');
  await page.getByLabel('Enable conductor').check();
  await page.getByLabel('Conductor form').selectOption('Arc');
  const roomKnob = percussionControls.locator('.knob-container').filter({ hasText: 'Room Size' }).locator('.knob');
  const roomBox = await roomKnob.boundingBox();
  if (roomBox) {
    await page.mouse.move(roomBox.x + roomBox.width / 2, roomBox.y + roomBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(roomBox.x + roomBox.width / 2, roomBox.y - 100);
    await page.mouse.up();
    await page.waitForTimeout(250);
  }
  await page.getByRole('button', { name: 'START' }).click();
  await expect(page.getByRole('button', { name: 'STOP' })).toBeVisible();
  await page.getByRole('button', { name: 'STOP' }).click();
  expect(pageErrors).toEqual([]);
});

test('favorite save notice and local round trip', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Percussion kit').selectOption('Deep Ritual');
  await page.getByLabel('Rhythm mode').selectOption('Generative');
  await page.getByLabel('Arrangement seed').fill('deep-ritual-2049');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByLabel('Favorite name').fill('Moon ritual');
  await page.getByLabel('Favorite mood').fill('Contemplative');
  await page.getByLabel('Favorite vibe').fill('Sparse frame drum under a slow arc');
  await page.getByRole('button', { name: 'Save current favorite' }).click();
  await expect(page.getByRole('dialog', { name: 'Local storage notice' })).toContainText('no cookies');
  await page.getByRole('button', { name: 'Save on this device' }).click();
  await expect(page.getByText('Moon ritual')).toBeVisible();
  await page.reload();
  await page.getByLabel('Search favorites').fill('Contemplative');
  await expect(page.getByText('Moon ritual')).toBeVisible();
  await page.getByRole('button', { name: 'Load' }).click();
  await expect(page.getByLabel('Percussion kit')).toHaveValue('Deep Ritual');
  await expect(page.getByLabel('Rhythm mode')).toHaveValue('Generative');
  await expect(page.getByLabel('Arrangement seed')).toHaveValue('deep-ritual-2049');
  await expect(page.getByLabel('Favorite name')).toHaveValue('Moon ritual');
  await expect(page.getByLabel('Favorite mood')).toHaveValue('Contemplative');
  await expect(page.getByLabel('Favorite vibe')).toHaveValue('Sparse frame drum under a slow arc');
  await page.getByLabel('Favorite vibe').fill('A deeper edited ritual');
  await page.getByRole('button', { name: 'Update favorite' }).click();
  await expect(page.getByRole('status')).toHaveText('Favorite updated on this device.');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('atmospheric-machine:favorites:v1') ?? '[]'),
  );
  expect(saved).toHaveLength(1);
  expect(saved[0].vibe).toBe('A deeper edited ritual');
  const moonCard = page.locator('.favorite-card').filter({ hasText: 'Moon ritual' });
  const downloadPromise = page.waitForEvent('download');
  await moonCard.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('moon-ritual');
  const exportPath = await download.path();
  expect(exportPath).not.toBeNull();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Moon ritual')).not.toBeVisible();
  await page.getByLabel('Import favorites file').setInputFiles(exportPath!);
  await expect(page.getByRole('status')).toHaveText('Imported 1 favorite.');
  await expect(page.getByText('Moon ritual')).toBeVisible();
});
