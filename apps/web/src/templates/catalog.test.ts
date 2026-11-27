import { CANVAS_PRESETS, type TextElement, validateDocument } from '@opencanvas/document';
import { renderPageToSvg, type TextMeasurer, wrapTextLines } from '@opencanvas/export';
import { getIcon } from '@opencanvas/icons';
import { describe, expect, it } from 'vitest';

import { getBlueprint, resolvePalette } from './blueprints';
import { Frame, type TextOptions } from './kit';
import { TEMPLATES, categoryLabel, getTemplate } from './catalog';
import { GENERATED_INSTANCES } from './generated';
import { INSTANCES } from './instances';
import {
  MIN_TEXT_CONTRAST,
  auditReadability,
  contrastRatio,
  readableOn,
  relativeLuminance,
} from './readability';
import { SIGNATURE_TEMPLATES } from './signature';

const PRESETS = new Set(CANVAS_PRESETS.map((preset) => preset.id));

describe('the template catalogue', () => {
  it('ships 220 designs from three sources and no duplicate ids', () => {
    expect(TEMPLATES).toHaveLength(220);
    expect(SIGNATURE_TEMPLATES.length + INSTANCES.length + GENERATED_INSTANCES.length).toBe(220);
    expect(GENERATED_INSTANCES).toHaveLength(160);
    const ids = TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(220);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('has something in every gallery category', () => {
    const counts = new Map<string, number>();
    for (const template of TEMPLATES) {
      counts.set(template.category, (counts.get(template.category) ?? 0) + 1);
    }
    for (const category of ['social', 'presentation', 'print', 'video', 'business'] as const) {
      expect(counts.get(category) ?? 0, category).toBeGreaterThanOrEqual(8);
    }
    expect(categoryLabel('all')).toBe('All');
  });

  it('points every design at a preset and a blueprint that exist', () => {
    for (const template of TEMPLATES) {
      expect(PRESETS.has(template.presetId), template.id).toBe(true);
    }
    for (const instance of [...INSTANCES, ...GENERATED_INSTANCES]) {
      expect(getBlueprint(instance.blueprint), instance.id).toBeDefined();
    }
    expect(INSTANCES.map((instance) => instance.blueprint).length).toBeGreaterThan(0);
  });

  it('builds a schema-valid document for every design', () => {
    for (const template of TEMPLATES) {
      const document = template.build();
      const result = validateDocument(document);
      expect(result.ok, `${template.id}: ${result.ok ? '' : result.error.message}`).toBe(true);
      expect(document.metadata.templateId).toBe(template.id);
      expect(document.metadata.source).toBe('template');
      expect(document.pages[0]?.elements.length ?? 0).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps text and icons inside the page and the icon catalogue', () => {
    for (const template of TEMPLATES) {
      const document = template.build();
      const { width } = document.size;
      for (const element of document.pages[0]?.elements ?? []) {
        if (element.type === 'text') {
          expect(element.x, template.id).toBeGreaterThanOrEqual(0);
          expect(element.x + element.width, template.id).toBeLessThanOrEqual(width + 1);
          expect(element.y, template.id).toBeGreaterThanOrEqual(0);
          expect(element.fontSize, template.id).toBeGreaterThan(0);
        }
        if (element.type === 'icon') {
          expect(getIcon(element.iconId), `${template.id}: ${element.iconId}`).toBeDefined();
          expect(element.width).toBe(element.height);
        }
      }
    }
  });

  it('keeps generated text boxes from landing on each other', () => {
    for (const instance of [...INSTANCES, ...GENERATED_INSTANCES]) {
      const template = getTemplate(instance.id);
      const document = template?.build();
      const texts = (document?.pages[0]?.elements ?? []).filter(
        (element) => element.type === 'text',
      );
      for (let i = 0; i < texts.length; i += 1) {
        for (let j = i + 1; j < texts.length; j += 1) {
          const a = texts[i]!;
          const b = texts[j]!;
          const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          if (overlapX <= 8 || overlapY <= 8) continue;
          const share = overlapY / Math.min(a.height, b.height);
          expect(share, `${instance.id}: "${a.text}" over "${b.text}"`).toBeLessThan(0.2);
        }
      }
    }
  });

  it('keeps the repaired signature headlines clear of their supporting text', () => {
    // A deliberately generous half-em advance catches the original fixed-height collisions
    // without depending on a platform's font rasterizer in the unit-test environment.
    const measure: TextMeasurer = (text, style) => text.length * style.fontSize * 0.5;
    for (const id of ['instagram-minimal', 'story-gradient', 'presentation-title']) {
      const template = TEMPLATES.find((candidate) => candidate.id === id);
      const document = template?.build();
      expect(document, id).toBeDefined();
      const texts = (document?.pages[0]?.elements ?? [])
        .filter((element) => element.type === 'text')
        .map((element) => {
          const lines = wrapTextLines(element, measure);
          return {
            ...element,
            bottom: element.y + element.fontSize * (element.lineHeight * (lines.length - 1) + 1.13),
          };
        });
      for (let i = 0; i < texts.length; i += 1)
        for (let j = i + 1; j < texts.length; j += 1) {
          const a = texts[i]!;
          const b = texts[j]!;
          const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
          expect(overlapX <= 4 || overlapY <= 4, `${id}: ${a.text} / ${b.text}`).toBe(true);
        }
    }
  });

  it('uses a condensed display face for the long Launch Week headline', () => {
    const document = getTemplate('launch-week')?.build();
    const headline = document?.pages[0]?.elements.find(
      (element) => element.type === 'text' && element.text.includes('workspace'),
    );
    expect(headline?.type).toBe('text');
    if (headline?.type !== 'text') return;
    expect(headline.fontFamily).toBe('Oswald');
    // The browser font audit measured 416px against this 454px box; the old face was 508px.
    expect(headline.width).toBeGreaterThanOrEqual(440);
  });

  it('uses gradient backgrounds where the design calls for one', async () => {
    const gradientTemplates = INSTANCES.filter((instance) => instance.background !== undefined);
    expect(gradientTemplates.length).toBeGreaterThanOrEqual(3);

    const slow = getTemplate('slow-mornings')?.build();
    expect(slow?.pages[0]?.background.type).toBe('linear');
    // The gradient is a real fill, so it reaches the exported file as vector data.
    const nested = await renderPageToSvg(slow!);
    expect(nested.ok).toBe(true);
    if (nested.ok) expect(nested.value).toContain('<linearGradient');
  });

  it('renders every design to a vector file with no broken numbers', async () => {
    for (const template of TEMPLATES) {
      const document = template.build();
      const result = await renderPageToSvg(document);
      expect(result.ok, `${template.id}: ${result.ok ? '' : result.error.message}`).toBe(true);
      if (!result.ok) continue;
      expect(result.value, template.id).not.toContain('NaN');
      const shapes = result.value.match(/<(rect|ellipse|path|circle|line|text|g)\b/g) ?? [];
      expect(shapes.length, template.id).toBeGreaterThan(3);
    }
  });

  it('looks the same twice: builds are deterministic apart from element ids', () => {
    const template = getTemplate('flash-sale');
    expect(template).toBeDefined();
    const first = template?.build();
    const second = template?.build();
    const strip = (document: typeof first) =>
      document?.pages[0]?.elements.map((element) => ({
        type: element.type,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      }));
    expect(strip(first)).toEqual(strip(second));
    expect(first?.size).toEqual(second?.size);
  });

  it('finds a design by id', () => {
    expect(getTemplate('studio-opening')?.label).toBe('Studio Opening');
    expect(getTemplate('nope')).toBeUndefined();
  });

  // The catalogue is written once per blueprint and rendered into every preset, so the way to
  // keep it honest is to measure the result rather than trust the authoring. The half-em advance
  // below is the same estimate the layout kit fits against.
  const measure: TextMeasurer = (text, style) => text.length * style.fontSize * 0.5;

  const drawnBottom = (element: TextElement): number => {
    const lines = wrapTextLines(element, measure).length;
    return element.y + element.fontSize * (element.lineHeight * (lines - 1) + 1.13);
  };

  it('never lets one block of text run into another, in any design', () => {
    const collisions: string[] = [];
    for (const template of TEMPLATES) {
      const document = template.build();
      for (const page of document.pages) {
        const texts = page.elements.filter(
          (element): element is TextElement => element.type === 'text',
        );
        for (const a of texts) {
          const bottom = drawnBottom(a);
          for (const b of texts) {
            if (a === b || b.y < a.y) continue;
            const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
            const overlapY = Math.min(bottom, drawnBottom(b)) - Math.max(a.y, b.y);
            // A few pixels of kerning slack keeps this from firing on touching baselines.
            if (overlapX > 4 && overlapY > 4) {
              collisions.push(
                `${template.id}: "${a.text.slice(0, 32)}" overlaps "${b.text.slice(0, 32)}"`,
              );
            }
          }
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it('keeps every line of text on the page once it has wrapped', () => {
    const spills: string[] = [];
    for (const template of TEMPLATES) {
      const document = template.build();
      for (const page of document.pages) {
        for (const element of page.elements) {
          if (element.type !== 'text') continue;
          const bottom = drawnBottom(element);
          if (bottom > document.size.height + 2) {
            spills.push(
              `${template.id}: "${element.text.slice(0, 32)}" reaches ${Math.round(bottom)} of ` +
                `${document.size.height}`,
            );
          }
        }
      }
    }
    expect(spills).toEqual([]);
  });

  it('can be read: every line of text clears WCAG AA against what sits behind it', () => {
    const failures: string[] = [];
    for (const template of TEMPLATES) {
      for (const finding of auditReadability(template.build())) {
        failures.push(
          `${template.id}: "${finding.text}" at ${finding.fontSize}px is ${finding.colour} on ` +
            `${finding.backdrop} (${finding.ratio.toFixed(2)}:1, needs ${finding.required}:1)`,
        );
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('palette resolution', () => {
  // Four colours in, eight roles out. The roles are what layouts draw with, so these are the
  // guarantees that keep a new palette from quietly producing unreadable designs.
  const resolve = (bg: string, ink: string, accent: string, soft: string, onAccent?: string) =>
    resolvePalette({ bg, ink, accent, soft, ...(onAccent === undefined ? {} : { onAccent }) });

  it('leaves a palette that already works exactly as the designer wrote it', () => {
    const palette = resolve('#ffffff', '#111827', '#b91c1c', '#fee2e2');
    expect(palette.ink).toBe('#111827');
    expect(palette.accentText).toBe('#b91c1c');
  });

  it('keeps accent usable as a fill even when it is too pale to be text', () => {
    const palette = resolve('#fff7ed', '#431407', '#ea580c', '#fed7aa');
    // The fill is untouched, so the design keeps its bright orange furniture...
    expect(palette.accent).toBe('#ea580c');
    // ...while the text form is darkened only as far as legibility demands.
    expect(palette.accentText).not.toBe('#ea580c');
    expect(contrastRatio(palette.accentText, palette.bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('rescues ink that was set to the same colour as the background', () => {
    const palette = resolve('#111111', '#111111', '#facc15', '#fde68a', '#111111');
    expect(contrastRatio(palette.ink, palette.bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it('honours an explicit onAccent when it is legible rather than overriding the designer', () => {
    const palette = resolve('#ffffff', '#111827', '#facc15', '#fef9c3', '#111111');
    expect(palette.onAccent).toBe('#111111');
  });

  it('gives every role enough contrast against the surface it is drawn on', () => {
    const palette = resolve('#f7fee7', '#1a2e05', '#65a30d', '#d9f99d');
    const pairs: readonly (readonly [string, string, string])[] = [
      ['ink on bg', palette.ink, palette.bg],
      ['accentText on bg', palette.accentText, palette.bg],
      ['onAccent on accent', palette.onAccent, palette.accent],
      ['onSoft on soft', palette.onSoft, palette.soft],
      ['onInk on ink', palette.onInk, '#1a2e05'],
    ];
    for (const [role, colour, surface] of pairs) {
      expect(contrastRatio(colour, surface), role).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });
});

describe('contrast repair', () => {
  it('measures contrast the way WCAG does', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    // Order must not matter.
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#777777'), 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
  });

  it('reads three-digit hex the same as six', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#ffffff'), 5);
  });

  it('moves a colour as little as possible, keeping its hue recognisable', () => {
    const repaired = readableOn('#ea580c', '#fff7ed', MIN_TEXT_CONTRAST);
    const [r, g, b] = [1, 3, 5].map((index) =>
      Number.parseInt(repaired.slice(index, index + 2), 16),
    );
    // Still orange: red leads, green sits in the middle, blue stays low.
    expect(r).toBeGreaterThan(g ?? 0);
    expect(g ?? 0).toBeGreaterThan(b ?? 0);
  });

  it('sends grey straight to the clean pole instead of a muddy mid-tone', () => {
    // Grey has no hue worth preserving, so crawling it to a barely-legal tone would just look
    // like a mistake.
    expect(readableOn('#111111', '#111111', MIN_TEXT_CONTRAST)).toBe('#ffffff');
    expect(readableOn('#eeeeee', '#ffffff', MIN_TEXT_CONTRAST)).toBe('#000000');
  });

  it('picks the pole by measurement, not by guessing light or dark', () => {
    // A mid cyan looks light, yet black reads on it and white does not.
    expect(readableOn('#ffffff', '#06b6d4', MIN_TEXT_CONTRAST)).toBe('#000000');
  });
});

describe('fitting text to the space a layout reserved', () => {
  const build = (text: string, options: Partial<TextOptions> & { size: number }) => {
    const { document, frame } = Frame.document({
      templateId: 'fit-test',
      name: 'Fit test',
      presetId: 'instagram-post',
    });
    frame.text(text, { x: 0.1, y: 0.1, w: 0.8, ...options });
    return document.pages[0]?.elements[0] as TextElement;
  };

  it('leaves type alone when it already fits', () => {
    const element = build('Short', { size: 0.05 });
    expect(element.fontSize).toBe(Math.round(0.05 * 1080));
  });

  it('steps a headline down until it fits the line it was given', () => {
    const headline = 'Attention is the only material';
    const element = build(headline, { size: 0.06 });
    expect(element.fontSize).toBeLessThan(Math.round(0.06 * 1080));
    // One line at the fitted size, which is what the layout budgeted for.
    expect(headline.length * element.fontSize * 0.5).toBeLessThanOrEqual(element.width);
    // ...and no smaller than it had to be: one step back up would have spilled.
    const taller = Math.round(element.fontSize / 0.94);
    expect(headline.length * taller * 0.5).toBeGreaterThan(element.width);
  });

  it('respects the line breaks an author wrote instead of squeezing them out', () => {
    const element = build('Spring\nGala', { size: 0.12 });
    expect(element.fontSize).toBe(Math.round(0.12 * 1080));
    expect(element.height).toBeGreaterThan(element.fontSize * 2);
  });

  it('refuses to shrink text into illegibility, keeping an honest box instead', () => {
    // A string far too long for its slot: the size bottoms out and the height grows to match
    // what is actually drawn, rather than quietly reporting one line.
    const element = build('supercalifragilistic '.repeat(14).trim(), { size: 0.12 });
    expect(element.fontSize).toBeGreaterThanOrEqual(Math.round(0.12 * 1080 * 0.4));
    expect(element.height).toBeGreaterThan(element.fontSize * 2);
  });
});
