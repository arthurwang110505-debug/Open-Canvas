import { expect, test } from '@playwright/test';

test('template previews preserve their document aspect ratio', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find your next favorite' })).toBeVisible();
  await expect(page.getByTestId('template-card')).toHaveCount(60);
  await expect(page.getByText('Loading template preview')).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);

  const issues = await page.getByTestId('template-card').evaluateAll((cards) => {
    const problems: string[] = [];
    for (const card of cards) {
      const svg = card.querySelector('svg');
      const name = card.querySelector('p')?.textContent ?? 'template';
      if (!svg) continue;
      const pageBox = svg.getBoundingClientRect();
      const viewBox = svg.viewBox.baseVal;
      const ratio = pageBox.width / pageBox.height;
      if (Math.abs(ratio - viewBox.width / viewBox.height) > 0.02)
        problems.push(`${name}: distorted preview`);
    }
    return problems;
  });
  expect(issues).toEqual([]);
});

test('compact editor keeps its controls and page dock outside the artwork', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a design', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Create a design' });
  await dialog.getByRole('textbox', { name: 'Design name' }).fill('Compact workspace');
  await dialog.getByRole('button', { name: 'Create design', exact: true }).click();
  await expect(page).toHaveURL(/#\/design\//);
  await expect(page.getByRole('status')).toBeAttached();

  await page.getByRole('tab', { name: 'Elements', exact: true }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.getByRole('button', { name: 'Close panel' }).click();
  const toolbar = page.getByRole('toolbar', { name: 'Contextual toolbar' });
  await expect(toolbar.getByRole('button', { name: 'More selection actions' })).toBeVisible();
  const layout = await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="canvas-stage"]')!.getBoundingClientRect();
    const dock = document
      .querySelector('footer[aria-label="Page navigation and zoom"]')!
      .getBoundingClientRect();
    const bar = document.querySelector('[role="toolbar"][aria-label="Contextual toolbar"]')!;
    return {
      documentOverflow: document.documentElement.scrollWidth > window.innerWidth,
      toolbarOverflow: bar.scrollWidth > bar.clientWidth + 1,
      dockBelowCanvas: dock.top >= stage.bottom - 1,
      stageHeight: stage.height,
    };
  });
  expect(layout).toEqual({
    documentOverflow: false,
    toolbarOverflow: false,
    dockBelowCanvas: true,
    stageHeight: expect.any(Number),
  });
  expect(layout.stageHeight).toBeGreaterThan(300);
});

test('brand kit applies a color and the download dialog states its output', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a design', exact: true }).first().click();
  const createDialog = page.getByRole('dialog', { name: 'Create a design' });
  await createDialog.getByRole('textbox', { name: 'Design name' }).fill('Brand check');
  await createDialog.getByRole('button', { name: 'Create design', exact: true }).click();
  await expect(page).toHaveURL(/#\/design\//);

  // The rail separates the five primary destinations from the secondary tools.
  const primary = page.getByRole('tablist', { name: 'Editor panels' });
  await expect(primary.getByRole('tab')).toHaveCount(5);
  const moreTools = page.getByRole('tablist', { name: 'More tools' });
  await expect(moreTools.getByRole('tab')).toHaveCount(5);

  await page.getByRole('tab', { name: 'Elements', exact: true }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.getByRole('tab', { name: 'Brand', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Brand colors' })).toBeVisible();
  await page.getByRole('button', { name: 'Apply brand color #6d45e8 to selection' }).click();
  // Changing the kit persists it in this browser, independent of any design.
  await page.getByLabel('Heading font').selectOption('Fraunces');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('opencanvas:brand-kit:v1')))
    .toContain('Fraunces');

  await page.getByRole('button', { name: 'Download', exact: true }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Download design' });
  await expect(exportDialog.getByRole('radio', { name: /PNG/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(exportDialog.getByText(/px · page 1 of 1 \(current page only\)/)).toBeVisible();
  await exportDialog.getByRole('radio', { name: /PDF/ }).click();
  await expect(exportDialog.getByRole('radio', { name: 'All pages (1)' })).toBeVisible();
});

test('resize dialog creates an adapted copy and opens it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a design', exact: true }).first().click();
  const createDialog = page.getByRole('dialog', { name: 'Create a design' });
  await createDialog.getByRole('textbox', { name: 'Design name' }).fill('Resize check');
  await createDialog.getByRole('button', { name: 'Create design', exact: true }).click();
  await expect(page).toHaveURL(/#\/design\//);
  const originalUrl = page.url();

  await page.getByRole('tab', { name: 'Elements', exact: true }).click();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.getByRole('tab', { name: 'Page', exact: true }).click();
  await page.getByRole('button', { name: 'Resize design with preview…' }).click();
  const resizeDialog = page.getByRole('dialog', { name: 'Resize design' });
  await resizeDialog.getByRole('button', { name: /Instagram story/ }).click();
  await expect(resizeDialog.getByText('1 page · 1080 × 1920px · content fitted')).toBeVisible();
  await resizeDialog.getByRole('button', { name: 'Create resized copy' }).click();

  // The copy opens as its own design; the original is untouched.
  await expect(page.getByRole('textbox', { name: 'Design name' })).toHaveValue(
    'Resize check · Instagram story',
  );
  expect(page.url()).not.toBe(originalUrl);
  await expect(page.getByText('1080 × 1920 px')).toBeVisible();

  await page.goto('/');
  await page.getByRole('button', { name: /^Projects/ }).click();
  await expect(page.getByRole('heading', { name: 'Resize check', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Resize check · Instagram story' })).toBeVisible();
});
