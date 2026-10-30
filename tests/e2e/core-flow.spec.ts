import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('create, edit, copy/paste, export, and restore a design', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What will you design today?' })).toBeVisible();

  await page.getByRole('button', { name: 'Create a design', exact: true }).first().click();
  const createDialog = page.getByRole('dialog', { name: 'Create a design' });
  await createDialog.getByRole('textbox', { name: 'Design name' }).fill('Browser smoke');
  await createDialog.getByRole('button', { name: 'Create design', exact: true }).click();

  await expect(page).toHaveURL(/#\/design\//);
  await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Browser smoke');

  await page.getByRole('tab', { name: 'Elements', exact: true }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Download design' });
  await exportDialog.getByRole('radio', { name: /SVG/ }).click();
  await exportDialog.getByRole('button', { name: 'Download SVG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Browser smoke.svg');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  if (!downloadPath) throw new Error('Chromium did not persist the downloaded SVG.');
  const svg = await readFile(downloadPath, 'utf8');
  expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
  expect(svg).toContain('<rect width="324" height="324"');
  expect(svg.match(/<rect width="324" height="324"/g)).toHaveLength(2);

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue('Browser smoke');
  await page.getByRole('tab', { name: 'Layers', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Rectangle', exact: true })).toHaveCount(2);
});
