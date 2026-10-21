import type { Blueprint, BlueprintOptions } from './types';
import { Frame } from './kit';

/**
 * Layouts the catalogue multiplies. Each one draws with fractions of the page (see `Frame`), so
 * the same composition survives a square post, a story, a slide and an A4 poster. Copy and colour
 * live in `instances.ts` — a new design is data, not another 150-line factory.
 */

function start(options: BlueprintOptions) {
  const { document, frame } = Frame.document({
    templateId: options.templateId,
    name: options.name,
    presetId: options.presetId,
  });
  frame.background(options.palette.bg);
  return {
    document,
    frame,
    palette: options.palette,
    content: options.content,
    type: options.type,
  };
}

/** Small uppercase kicker above a headline. */
function eyebrow(options: BlueprintOptions): string {
  return (options.content.eyebrow ?? '').toUpperCase();
}

const statement: Blueprint = {
  id: 'statement',
  build: (options) => {
    const { document, frame, palette, content, type } = start(options);
    frame.circle({ x: 0.66, y: 0.52, size: 0.52, fill: palette.soft, opacity: 0.9 });
    frame.rect({ x: 0.08, y: 0.09, w: 0.1, h: 0.006, fill: palette.accent });
    if (content.eyebrow) {
      frame.text(eyebrow(options), {
        x: 0.08,
        y: 0.13,
        w: 0.7,
        size: 0.022,
        weight: 700,
        color: palette.accent,
        tracking: 0.14,
      });
    }
    frame.text(content.title, {
      x: 0.08,
      y: 0.2,
      w: 0.84,
      size: 0.125,
      weight: 700,
      font: type.display,
      color: palette.ink,
      lineHeight: 0.94,
    });
    if (content.subtitle) {
      frame.text(content.subtitle, {
        x: 0.08,
        y: 0.66,
        w: 0.66,
        size: 0.03,
        font: type.body,
        color: palette.ink,
        lineHeight: 1.4,
        opacity: 0.78,
      });
    }
    if (content.footer) {
      frame.text(content.footer.toUpperCase(), {
        x: 0.08,
        y: 0.89,
        w: 0.6,
        size: 0.019,
        weight: 600,
        font: type.body,
        color: palette.ink,
        tracking: 0.12,
        opacity: 0.55,
      });
    }
    return document;
  },
};

const split: Blueprint = {
  id: 'split',
  build: (options) => {
    const { document, frame, palette, content, type } = start(options);
    const panelX = options.flip ? 0 : 0.56;
    const textX = options.flip ? 0.51 : 0.07;
    const textWidth = 0.42;
    frame.rect({ x: panelX, y: 0, w: 0.44, h: 1, fill: palette.accent });
    frame.circle({
      x: panelX + 0.06,
      y: 0.12,
      size: 0.3,
      fill: palette.onAccent ?? palette.bg,
      opacity: 0.14,
    });
    frame.icon(options.flip ? 'sparkles' : 'arrow-up-right', {
      x: panelX + 0.12,
      y: 0.62,
      size: 0.16,
      color: palette.onAccent ?? palette.bg,
      strokeWidth: 1.5,
    });
    if (content.eyebrow) {
      frame.text(eyebrow(options), {
        x: textX,
        y: 0.14,
        w: textWidth,
        size: 0.02,
        weight: 700,
        color: palette.accent,
        tracking: 0.14,
      });
    }
    frame.text(content.title, {
      x: textX,
      y: 0.22,
      w: textWidth,
      size: 0.09,
      weight: 700,
      font: type.display,
      color: palette.ink,
      lineHeight: 0.98,
    });
    if (content.subtitle) {
      frame.text(content.subtitle, {
        x: textX,
        y: 0.58,
        w: textWidth * 0.92,
        size: 0.026,
        font: type.body,
        color: palette.ink,
        lineHeight: 1.4,
        opacity: 0.75,
      });
    }
    if (content.cta) {
      frame.pill(content.cta, {
        x: textX,
        y: 0.76,
        w: 0.28,
        h: 0.075,
        fill: palette.accent,
        color: palette.onAccent ?? palette.bg,
        font: type.body,
      });
    }
    if (content.footer) {
      frame.text(content.footer, {
        x: textX,
        y: 0.9,
        w: textWidth,
        size: 0.018,
        font: type.body,
        color: palette.ink,
        tracking: 0.08,
        opacity: 0.5,
      });
    }
    return document;
  },
};

const bigType: Blueprint = {
  id: 'big-type',
  build: (options) => {
    const { document, frame, palette, content, type } = start(options);
    frame.rect({ x: 0.08, y: 0.1, w: 0.08, h: 0.008, fill: palette.accent });
    if (content.eyebrow) {
      frame.text(eyebrow(options), {
        x: 0.08,
        y: 0.14,
        w: 0.8,
        size: 0.02,
        weight: 700,
        color: palette.accent,
        tracking: 0.16,
      });
    }
    frame.text(content.title, {
      x: 0.07,
      y: 0.2,
      w: 0.88,
      size: 0.165,
      weight: 800,
      font: type.display,
      color: palette.ink,
      lineHeight: 0.86,
    });
    if (content.subtitle) {
      frame.text(content.subtitle, {
        x: 0.08,
        y: 0.72,
        w: 0.6,
        size: 0.026,
        font: type.body,
        color: palette.ink,
        lineHeight: 1.4,
        opacity: 0.7,
      });
    }
    frame.rule(
      { x: 0.08, y: 0.84 },
      { x: 0.92, y: 0.84 },
      { color: palette.ink, width: 2, opacity: 0.25 },
    );
    if (content.footer) {
      frame.text(content.footer, {
        x: 0.08,
        y: 0.87,
        w: 0.5,
        size: 0.018,
        font: type.body,
        color: palette.ink,
        opacity: 0.55,
      });
    }
    if (content.meta) {
      frame.text(content.meta, {
        x: 0.58,
        y: 0.87,
        w: 0.34,
        size: 0.018,
        font: type.body,
        color: palette.ink,
        opacity: 0.55,
        align: 'right',
      });
    }
    return document;
  },
};

const sale: Blueprint = {
  id: 'sale',
  build: (options) => {
    const { document, frame, palette, content, type } = start(options);
    frame.circle({ x: 0.42, y: 0.1, size: 0.62, fill: palette.accent });
    frame.circle({
      x: 0.4,
      y: 0.08,
      size: 0.66,
      fill: 'none',
      stroke: { color: palette.accent, width: 3 },
      opacity: 0.5,
    });
    frame.rect({ x: 0.07, y: 0.08, w: 0.28, h: 0.05, fill: palette.ink, radius: 0.025 });
    frame.text((content.badge ?? 'SALE').toUpperCase(), {
      x: 0.07,
      y: 0.092,
      w: 0.28,
      size: 0.02,
      weight: 700,
      color: palette.bg,
      align: 'center',
      tracking: 0.12,
    });
    frame.text(content.price ?? '50%', {
      x: 0.38,
      y: 0.24,
      w: 0.6,
      size: 0.17,
      weight: 800,
      font: type.display,
      color: palette.onAccent ?? palette.bg,
      align: 'center',
      lineHeight: 0.9,
    });
    frame.text(content.title, {
      x: 0.07,
      y: 0.62,
      w: 0.7,
      size: 0.075,
      weight: 700,
      font: type.display,
      color: palette.ink,
      lineHeight: 0.98,
    });
    if (content.subtitle) {
      frame.text(content.subtitle, {
        x: 0.07,
        y: 0.8,
        w: 0.6,
        size: 0.024,
        font: type.body,
        color: palette.ink,
        opacity: 0.7,
      });
    }
    if (content.cta) {
      frame.pill(content.cta, {
        x: 0.07,
        y: 0.87,
        w: 0.3,
        h: 0.07,
        fill: palette.ink,
        color: palette.bg,
        font: type.body,
      });
    }
    return document;
  },
};

const quote: Blueprint = {
  id: 'quote',
  build: (options) => {
    const { document, frame, palette, content, type } = start(options);
    frame.text('“', {
      x: 0.05,
      y: 0.0,
      w: 0.5,
      size: 0.26,
      weight: 700,
      font: type.display,
      color: palette.accent,
      opacity: 0.25,
      lineHeight: 0.9,
    });
    frame.text(content.title, {
      x: 0.1,
      y: 0.36,
      w: 0.8,
      size: 0.07,
      weight: 500,
      font: type.display,
      color: palette.ink,
      align: 'center',
      lineHeight: 1.18,
    });
    frame.rect({ x: 0.46, y: 0.75, w: 0.08, h: 0.006, fill: palette.accent });
    if (content.subtitle) {
      frame.text(content.subtitle, {
        x: 0.1,
        y: 0.79,
        w: 0.8,
        size: 0.026,
        weight: 600,
        font: type.body,
        color: palette.ink,
        align: 'center',
        tracking: 0.06,
      });
    }
    if (content.footer) {
      frame.text(content.footer, {
        x: 0.1,
        y: 0.88,
        w: 0.8,
        size: 0.018,
        font: type.body,
        color: palette.ink,
        align: 'center',
        opacity: 0.5,
      });
    }
    return document;
  },
};

const stats: Blueprint = {
  id: 'stats',
  build: (options) => {
    const { document, frame, palette, content, type } = start(options);
    if (content.eyebrow) {
      frame.text(eyebrow(options), {
        x: 0.07,
        y: 0.1,
        w: 0.7,
        size: 0.02,
        weight: 700,
        color: palette.accent,
        tracking: 0.14,
      });
    }
    frame.text(content.title, {
      x: 0.07,
      y: 0.15,
      w: 0.8,
      size: 0.06,
      weight: 700,
      font: type.display,
      color: palette.ink,
      lineHeight: 1.02,
    });
    const cards = content.stats ?? [];
    const gap = 0.025;
    const width = (1 - 0.14 - gap * (cards.length - 1)) / Math.max(1, cards.length);
    cards.forEach((stat, index) => {
      const x = 0.07 + index * (width + gap);
      frame.rect({ x, y: 0.4, w: width, h: 0.28, fill: palette.soft, radius: 0.02 });
      frame.rect({ x, y: 0.4, w: width, h: 0.012, fill: palette.accent });
      frame.text(stat.value, {
        x,
        y: 0.47,
        w: width,
        size: 0.1,
        weight: 700,
        font: type.display,
        color: palette.accent,
        align: 'center',
      });
      frame.text(stat.label, {
        x: x + width * 0.1,
        y: 0.64,
        w: width * 0.8,
        size: 0.022,
        font: type.body,
        color: palette.ink,
        align: 'center',
        lineHeight: 1.3,
      });
    });
    if (content.footer) {
      frame.text(content.footer, {
        x: 0.07,
        y: 0.86,
        w: 0.7,
        size: 0.02,
        font: type.body,
        color: palette.ink,
        opacity: 0.55,
      });
    }
    return document;
  },
};

const agenda: Blueprint = {
  id: 'agenda',
  build: (options) => {
    const { document, frame, palette, content, type } = start(options);
    if (content.eyebrow) {
      frame.text(eyebrow(options), {
        x: 0.08,
        y: 0.09,
        w: 0.6,
        size: 0.02,
        weight: 700,
        color: palette.accent,
        tracking: 0.14,
      });
    }
    frame.text(content.title, {
      x: 0.08,
      y: 0.13,
      w: 0.84,
      size: 0.06,
      weight: 700,
      font: type.display,
      color: palette.ink,
      lineHeight: 1.02,
    });
    const items = content.items ?? [];
    items.slice(0, 5).forEach((item, index) => {
      const y = 0.34 + index * 0.125;
      frame.text(String(index + 1).padStart(2, '0'), {
        x: 0.08,
        y,
        w: 0.1,
        size: 0.035,
        weight: 700,
        font: type.display,
        color: palette.accent,
      });
      frame.text(item, {
        x: 0.2,
        y: y + 0.006,
        w: 0.72,
        size: 0.03,
        weight: 500,
        font: type.body,
        color: palette.ink,
      });
      frame.rule(
        { x: 0.08, y: y + 0.085 },
        { x: 0.92, y: y + 0.085 },
        {
          color: palette.ink,
          width: 1,
          opacity: 0.16,
        },
      );
    });
    if (content.footer) {
      frame.text(content.footer, {
        x: 0.08,
        y: 0.9,
        w: 0.6,
        size: 0.018,
        font: type.body,
        color: palette.ink,
        opacity: 0.5,
      });
    }
    return document;
  },
};

const cover: Blueprint = {
  id: 'cover',
  build: (options) => {
    const { document, frame, palette, content, type } = start(options);
    const blockX = options.flip ? 0 : 0.6;
    frame.rect({ x: blockX, y: 0.62, w: 0.4, h: 0.38, fill: palette.accent });
    frame.circle({
      x: blockX + 0.2,
      y: 0.68,
      size: 0.2,
      fill: palette.onAccent ?? palette.bg,
      opacity: 0.16,
    });
    if (content.eyebrow) {
      frame.text(eyebrow(options), {
        x: 0.07,
        y: 0.2,
        w: 0.5,
        size: 0.02,
        weight: 700,
        color: palette.accent,
        tracking: 0.16,
      });
    }
    frame.text(content.title, {
      x: 0.07,
      y: 0.26,
      w: 0.56,
      size: 0.085,
      weight: 700,
      font: type.display,
      color: palette.ink,
      lineHeight: 1.0,
    });
    if (content.subtitle) {
      frame.text(content.subtitle, {
        x: 0.07,
        y: 0.5,
        w: 0.48,
        size: 0.026,
        font: type.body,
        color: palette.ink,
        lineHeight: 1.45,
        opacity: 0.72,
      });
    }
    frame.rule(
      { x: 0.07, y: 0.7 },
      { x: 0.53, y: 0.7 },
      { color: palette.ink, width: 1, opacity: 0.25 },
    );
    if (content.meta) {
      frame.text(content.meta.toUpperCase(), {
        x: 0.07,
        y: 0.73,
        w: 0.46,
        size: 0.018,
        weight: 600,
        font: type.body,
        color: palette.ink,
        tracking: 0.12,
        opacity: 0.6,
      });
    }
    if (content.footer) {
      frame.text(content.footer, {
        x: 0.07,
        y: 0.88,
        w: 0.46,
        size: 0.018,
        font: type.body,
        color: palette.ink,
        opacity: 0.5,
      });
    }
    frame.icon('presentation', {
      x: blockX + 0.16,
      y: 0.74,
      size: 0.08,
      color: palette.onAccent ?? palette.bg,
      strokeWidth: 1.5,
    });
    return document;
  },
};

const event: Blueprint = {
  id: 'event',
  build: (options) => {
    const { document, frame, palette, content, type } = start(options);
    frame.circle({ x: 0.7, y: 0.06, size: 0.24, fill: palette.soft });
    frame.text(content.date ?? '12', {
      x: 0.07,
      y: 0.08,
      w: 0.3,
      size: 0.14,
      weight: 800,
      font: type.display,
      color: palette.accent,
      lineHeight: 0.9,
    });
    frame.text((content.month ?? 'NOV').toUpperCase(), {
      x: 0.07,
      y: 0.23,
      w: 0.3,
      size: 0.026,
      weight: 600,
      font: type.body,
      color: palette.ink,
      tracking: 0.18,
    });
    frame.icon('calendar', {
      x: 0.07,
      y: 0.3,
      size: 0.05,
      color: palette.accent,
      strokeWidth: 1.6,
    });
    frame.rule(
      { x: 0.07, y: 0.4 },
      { x: 0.93, y: 0.4 },
      { color: palette.ink, width: 1, opacity: 0.2 },
    );
    frame.text(content.title, {
      x: 0.07,
      y: 0.45,
      w: 0.86,
      size: 0.095,
      weight: 700,
      font: type.display,
      color: palette.ink,
      lineHeight: 0.96,
    });
    if (content.subtitle) {
      frame.text(content.subtitle, {
        x: 0.07,
        y: 0.68,
        w: 0.7,
        size: 0.026,
        font: type.body,
        color: palette.ink,
        lineHeight: 1.4,
        opacity: 0.72,
      });
    }
    if (content.footer) {
      frame.text(content.footer, {
        x: 0.07,
        y: 0.78,
        w: 0.7,
        size: 0.02,
        font: type.body,
        color: palette.ink,
        opacity: 0.55,
      });
    }
    if (content.cta) {
      frame.pill(content.cta, {
        x: 0.07,
        y: 0.86,
        w: 0.34,
        h: 0.065,
        fill: palette.ink,
        color: palette.bg,
        font: type.body,
      });
    }
    return document;
  },
};

const profile: Blueprint = {
  id: 'profile',
  build: (options) => {
    const { document, frame, palette, content, type } = start(options);
    frame.rect({ x: 0.07, y: 0.1, w: 0.9, h: 0.005, fill: palette.accent });
    frame.square({ x: 0.07, y: 0.18, size: 0.13, fill: palette.accent, radius: 0.01 });
    frame.text(content.monogram ?? 'A', {
      x: 0.07,
      y: 0.2,
      w: 0.13,
      size: 0.055,
      weight: 700,
      font: type.display,
      color: palette.onAccent ?? palette.bg,
      align: 'center',
    });
    frame.text(content.title, {
      x: 0.24,
      y: 0.19,
      w: 0.62,
      size: 0.055,
      weight: 700,
      font: type.display,
      color: palette.ink,
    });
    if (content.subtitle) {
      frame.text(content.subtitle.toUpperCase(), {
        x: 0.24,
        y: 0.27,
        w: 0.62,
        size: 0.018,
        weight: 600,
        font: type.body,
        color: palette.accent,
        tracking: 0.14,
      });
    }
    frame.rule(
      { x: 0.07, y: 0.43 },
      { x: 0.93, y: 0.43 },
      { color: palette.ink, width: 1, opacity: 0.18 },
    );
    (content.items ?? []).slice(0, 3).forEach((item, index) => {
      frame.text(item, {
        x: 0.07,
        y: 0.47 + index * 0.09,
        w: 0.5,
        size: 0.02,
        font: type.body,
        color: palette.ink,
        opacity: 0.75,
      });
    });
    if (content.cta) {
      frame.pill(content.cta, {
        x: 0.62,
        y: 0.64,
        w: 0.31,
        h: 0.09,
        fill: palette.ink,
        color: palette.bg,
        font: type.body,
      });
    }
    return document;
  },
};

const product: Blueprint = {
  id: 'product',
  build: (options) => {
    const { document, frame, palette, content, type } = start(options);
    frame.circle({ x: 0.3, y: 0.1, size: 0.52, fill: palette.accent });
    frame.circle({
      x: 0.24,
      y: 0.06,
      size: 0.58,
      fill: 'none',
      stroke: { color: palette.accent, width: 2 },
      opacity: 0.4,
    });
    frame.rect({
      x: 0.38,
      y: 0.22,
      w: 0.24,
      h: 0.24 * (frame.width / frame.height) * 1.2,
      fill: palette.ink,
      radius: 0.02,
    });
    if (content.price) {
      frame.text(content.price, {
        x: 0.62,
        y: 0.08,
        w: 0.3,
        size: 0.05,
        weight: 700,
        font: type.display,
        color: palette.ink,
        align: 'right',
      });
    }
    if (content.eyebrow) {
      frame.text(eyebrow(options), {
        x: 0.07,
        y: 0.56,
        w: 0.6,
        size: 0.018,
        weight: 700,
        color: palette.accent,
        tracking: 0.14,
      });
    }
    frame.text(content.title, {
      x: 0.07,
      y: 0.6,
      w: 0.66,
      size: 0.07,
      weight: 700,
      font: type.display,
      color: palette.ink,
      lineHeight: 1.0,
    });
    if (content.subtitle) {
      frame.text(content.subtitle, {
        x: 0.07,
        y: 0.79,
        w: 0.56,
        size: 0.023,
        font: type.body,
        color: palette.ink,
        lineHeight: 1.35,
        opacity: 0.72,
      });
    }
    if (content.cta) {
      frame.pill(content.cta, {
        x: 0.07,
        y: 0.87,
        w: 0.28,
        h: 0.07,
        fill: palette.ink,
        color: palette.bg,
        font: type.body,
      });
    }
    return document;
  },
};

const banner: Blueprint = {
  id: 'banner',
  build: (options) => {
    const { document, frame, palette, content, type } = start(options);
    frame.rect({ x: options.flip ? 0.98 : 0, y: 0, w: 0.02, h: 1, fill: palette.accent });
    frame.circle({
      x: 0.76,
      y: 0.16,
      size: 0.5,
      fill: 'none',
      stroke: { color: palette.accent, width: 4 },
      opacity: 0.35,
    });
    frame.circle({ x: 0.86, y: 0.3, size: 0.2, fill: palette.accent, opacity: 0.9 });
    if (content.eyebrow) {
      frame.text(eyebrow(options), {
        x: 0.07,
        y: 0.18,
        w: 0.6,
        size: 0.02,
        weight: 700,
        color: palette.accent,
        tracking: 0.16,
      });
    }
    frame.text(content.title, {
      x: 0.07,
      y: 0.26,
      w: 0.66,
      size: 0.095,
      weight: 800,
      font: type.display,
      color: palette.ink,
      lineHeight: 0.94,
    });
    if (content.subtitle) {
      frame.text(content.subtitle, {
        x: 0.07,
        y: 0.62,
        w: 0.5,
        size: 0.028,
        font: type.body,
        color: palette.ink,
        lineHeight: 1.35,
        opacity: 0.75,
      });
    }
    if (content.cta) {
      frame.pill(content.cta, {
        x: 0.07,
        y: 0.76,
        w: 0.26,
        h: 0.11,
        fill: palette.accent,
        color: palette.onAccent ?? palette.bg,
        font: type.body,
      });
    }
    if (content.footer) {
      frame.text(content.footer, {
        x: 0.4,
        y: 0.8,
        w: 0.4,
        size: 0.018,
        font: type.body,
        color: palette.ink,
        opacity: 0.5,
      });
    }
    return document;
  },
};

const paletteBoard: Blueprint = {
  id: 'palette',
  build: (options) => {
    const { document, frame, palette, content, type } = start(options);
    frame.text(content.title, {
      x: 0.07,
      y: 0.08,
      w: 0.7,
      size: 0.045,
      weight: 700,
      font: type.display,
      color: palette.ink,
    });
    if (content.eyebrow) {
      frame.text(eyebrow(options), {
        x: 0.07,
        y: 0.15,
        w: 0.6,
        size: 0.018,
        weight: 600,
        color: palette.accent,
        tracking: 0.16,
      });
    }
    const swatches = [palette.accent, palette.ink, palette.soft, palette.bg];
    const gap = 0.02;
    const width = (1 - 0.14 - gap * 3) / 4;
    swatches.forEach((color, index) => {
      frame.rect({
        x: 0.07 + index * (width + gap),
        y: 0.26,
        w: width,
        h: 0.14,
        fill: color,
        radius: 0.012,
        ...(index === 3 ? { stroke: { color: palette.ink, width: 1 } } : {}),
      });
    });
    frame.text('Aa', {
      x: 0.07,
      y: 0.46,
      w: 0.4,
      size: 0.17,
      weight: 700,
      font: type.display,
      color: palette.ink,
      lineHeight: 0.9,
    });
    frame.rule(
      { x: 0.07, y: 0.66 },
      { x: 0.93, y: 0.66 },
      { color: palette.ink, width: 1, opacity: 0.2 },
    );
    frame.text(content.subtitle ?? type.body, {
      x: 0.07,
      y: 0.7,
      w: 0.5,
      size: 0.03,
      weight: 600,
      font: type.body,
      color: palette.ink,
    });
    if (content.body) {
      frame.text(content.body, {
        x: 0.07,
        y: 0.76,
        w: 0.52,
        size: 0.02,
        font: type.body,
        color: palette.ink,
        lineHeight: 1.5,
        opacity: 0.65,
      });
    }
    (content.items ?? []).slice(0, 3).forEach((item, index) => {
      frame.text(item, {
        x: 0.64,
        y: 0.7 + index * 0.06,
        w: 0.29,
        size: 0.018,
        font: type.body,
        color: palette.ink,
        opacity: 0.6,
      });
    });
    if (content.footer) {
      frame.text(content.footer, {
        x: 0.07,
        y: 0.9,
        w: 0.7,
        size: 0.017,
        font: type.body,
        color: palette.ink,
        opacity: 0.45,
      });
    }
    return document;
  },
};

export const BLUEPRINTS: readonly Blueprint[] = [
  statement,
  split,
  bigType,
  sale,
  quote,
  stats,
  agenda,
  cover,
  event,
  profile,
  product,
  banner,
  paletteBoard,
];

export function getBlueprint(id: string): Blueprint | undefined {
  return BLUEPRINTS.find((blueprint) => blueprint.id === id);
}
