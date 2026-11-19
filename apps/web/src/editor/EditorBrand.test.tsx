import {
  createBlankDocument,
  createTextElement,
  ok,
  type DesignDocument,
} from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorPage } from './EditorPage';
import { activateSidebarTab, openPropertiesPanel } from './testHelpers';
import type { ExportServices } from './export/ExportServices';
import { DEFAULT_BRAND_KIT } from '../brand/brandKit';
import { brandKitStore } from '../brand/brandStore';

const fixedDate = new Date('2026-05-06T07:08:09.000Z');
const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

interface Harness {
  user: ReturnType<typeof userEvent.setup>;
  downloads: { blob: Blob; filename: string }[];
}

function renderEditor(
  document: DesignDocument,
  options: { decode?: () => Promise<{ width: number; height: number }> } = {},
): Harness {
  const downloads: { blob: Blob; filename: string }[] = [];
  const services: Partial<ExportServices> = {
    rasterize: vi.fn(() => Promise.resolve(ok(ONE_PIXEL_PNG))),
    download: (blob, filename) => downloads.push({ blob, filename }),
    resolveFontFaces: vi.fn(() => Promise.resolve([])),
  };
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage
        document={document}
        exportServices={services}
        assetServices={
          options.decode
            ? { decode: options.decode, loadImage: () => Promise.resolve(new Image()) }
            : undefined
        }
      />
    </TooltipProvider>,
  );
  return { user, downloads };
}

describe('brand kit in the editor', () => {
  beforeEach(() => {
    localStorage.clear();
    brandKitStore.getState().setKit({
      colors: [...DEFAULT_BRAND_KIT.colors],
      headingFont: DEFAULT_BRAND_KIT.headingFont,
      bodyFont: DEFAULT_BRAND_KIT.bodyFont,
    });
  });

  it('applies a brand color to the selected element', async () => {
    const document = createBlankDocument({ id: 'doc_brand_color', name: 'Poster', now: fixedDate });
    const { user, downloads } = renderEditor(document);

    await activateSidebarTab(user, 'Elements');
    await user.click(screen.getByRole('button', { name: 'Rectangle' }));
    await activateSidebarTab(user, 'Brand');
    await user.click(
      screen.getByRole('button', { name: 'Apply brand color #6d45e8 to selection' }),
    );

    await user.click(screen.getByRole('button', { name: 'Download' }));
    const dialog = await screen.findByRole('dialog', { name: 'Download design' });
    await user.click(within(dialog).getByRole('radio', { name: /SVG/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Download SVG' }));

    const svg = await downloads[0]?.blob.text();
    expect(svg).toContain('#6d45e8');
  });

  it('applies brand fonts to the whole page as one undoable step', async () => {
    const document = createBlankDocument({ id: 'doc_brand_fonts', name: 'Poster', now: fixedDate });
    document.pages[0]?.elements.push(
      createTextElement({ id: 'title', text: 'Big title', fontSize: 64, fontFamily: 'Inter' }),
      createTextElement({ id: 'body', text: 'Small print', fontSize: 16, fontFamily: 'Inter' }),
    );
    const { user, downloads } = renderEditor(document);

    await activateSidebarTab(user, 'Brand');
    await user.selectOptions(screen.getByLabelText('Heading font'), 'Fraunces');
    await user.selectOptions(screen.getByLabelText('Body font'), 'Manrope');
    await user.click(screen.getByRole('button', { name: 'Apply fonts to this page…' }));

    // The summary states exactly what will change before anything is applied.
    const panel = screen.getByRole('tabpanel', { name: 'Brand' });
    expect(within(panel).getByRole('status')).toHaveTextContent(
      'Largest text (1) becomes Fraunces',
    );
    expect(within(panel).getByRole('status')).toHaveTextContent('other text (1) becomes Manrope');

    await user.click(screen.getByRole('button', { name: 'Apply brand fonts' }));
    expect(await screen.findByText('Brand fonts applied')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Download' }));
    let dialog = await screen.findByRole('dialog', { name: 'Download design' });
    await user.click(within(dialog).getByRole('radio', { name: /SVG/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Download SVG' }));
    const branded = await downloads[0]?.blob.text();
    expect(branded).toContain('font-family="Fraunces"');
    expect(branded).toContain('font-family="Manrope"');

    // One undo restores both fonts.
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await user.click(screen.getByRole('button', { name: 'Download' }));
    dialog = await screen.findByRole('dialog', { name: 'Download design' });
    await user.click(within(dialog).getByRole('radio', { name: /SVG/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Download SVG' }));
    const restored = await downloads[1]?.blob.text();
    expect(restored).toContain('font-family="Inter"');
    expect(restored).not.toContain('Fraunces');
  });

  it('offers brand colors inside the regular color fields', async () => {
    const document = createBlankDocument({ id: 'doc_brand_field', name: 'Poster', now: fixedDate });
    const { user } = renderEditor(document);

    await activateSidebarTab(user, 'Elements');
    await user.click(screen.getByRole('button', { name: 'Rectangle' }));

    const properties = openPropertiesPanel();
    await user.click(
      within(properties).getByRole('button', { name: 'Use brand color #f59e0b for Fill' }),
    );
    expect(within(properties).getByLabelText('Fill')).toHaveValue('#f59e0b');
  });

  it('saves an added color in this browser for the next design', async () => {
    const document = createBlankDocument({ id: 'doc_brand_save', name: 'Poster', now: fixedDate });
    const { user } = renderEditor(document);

    await activateSidebarTab(user, 'Brand');
    const hexInput = screen.getByLabelText('New color');
    await user.clear(hexInput);
    await user.type(hexInput, '#123456');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(
      screen.getByRole('button', { name: 'Apply brand color #123456 to selection' }),
    ).toBeInTheDocument();
    expect(brandKitStore.getState().kit.colors).toContain('#123456');
    expect(localStorage.getItem('opencanvas:brand-kit:v1')).toContain('#123456');
  });

  it('uploads a brand logo and inserts it into the design', async () => {
    const document = createBlankDocument({ id: 'doc_brand_logo', name: 'Poster', now: fixedDate });
    const { user } = renderEditor(document, {
      decode: () => Promise.resolve({ width: 200, height: 100 }),
    });

    await activateSidebarTab(user, 'Brand');
    // Real PNG bytes: the importer sniffs the format from the file header.
    const pngBytes = Uint8Array.from(atob(ONE_PIXEL_PNG.split(',')[1] ?? ''), (c) =>
      c.charCodeAt(0),
    );
    const file = new File([pngBytes], 'logo.png', { type: 'image/png' });
    const input = screen.getByLabelText('Upload brand logo');
    await user.upload(input, file);

    // The logo preview and insert action appear once the file is stored.
    expect(await screen.findByText('logo.png')).toBeInTheDocument();
    expect(brandKitStore.getState().kit.logo?.name).toBe('logo.png');
    expect(localStorage.getItem('opencanvas:brand-kit:v1')).toContain('data:image/png');

    await user.click(screen.getByRole('button', { name: 'Insert logo into design' }));

    // The logo lands on the page as an image element, undoable in one step. The import is
    // async (decode → store → place), so wait for the selection to appear.
    const properties = openPropertiesPanel();
    expect(
      await within(properties).findByRole('heading', { level: 2, name: 'Image' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('removes the brand logo from the kit', async () => {
    const document = createBlankDocument({
      id: 'doc_brand_logo_rm',
      name: 'Poster',
      now: fixedDate,
    });
    brandKitStore.getState().setLogo({ dataUrl: ONE_PIXEL_PNG, name: 'logo.png' });
    const { user } = renderEditor(document);

    await activateSidebarTab(user, 'Brand');
    expect(screen.getByText('logo.png')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove brand logo' }));

    expect(brandKitStore.getState().kit.logo).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Upload a logo' })).toBeInTheDocument();
  });
});
