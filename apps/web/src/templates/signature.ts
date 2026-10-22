import {
  createBlankDocument,
  createEllipseElement,
  createPathElement,
  createRectElement,
  createTextElement,
  type DesignDocument,
} from '@opencanvas/document';

import { presetSize } from './kit';
import type { TemplateDefinition } from './types';

// ---------------------------------------------------------------------------
// Hand-tuned signature designs
//
// These twelve are one-offs, drawn line by line. The generated catalogue in
// `instances.ts` covers breadth; these cover the looks that are worth the extra
// care. Both are the same `TemplateDefinition` shape, so the gallery does not
// know which is which.
// ---------------------------------------------------------------------------

// Helpers for decorative vector shapes as Path
function starPoints(cx: number, cy: number, outer: number, inner: number, points = 10) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < points; i++) {
    const angle = -90 + (i * 360) / points;
    const r = i % 2 === 0 ? outer : inner;
    const rad = (angle * Math.PI) / 180;
    pts.push({ x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) });
  }
  return pts;
}
function hexagonPoints(x: number, y: number, w: number, h: number) {
  return [
    { x: x + w * 0.25, y },
    { x: x + w * 0.75, y },
    { x: x + w, y: y + h * 0.5 },
    { x: x + w * 0.75, y: y + h },
    { x: x + w * 0.25, y: y + h },
    { x, y: y + h * 0.5 },
  ];
}
function trianglePoints(x: number, y: number, w: number, h: number) {
  return [
    { x: x + w / 2, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

// ---------------------------------------------------------------------------
// Template factories
// ---------------------------------------------------------------------------

function tplInstagramMinimal(): DesignDocument {
  const { width, height } = presetSize('instagram-post');
  const doc = createBlankDocument({
    width,
    height,
    name: 'Pastel Summer Sale',
    templateId: 'instagram-minimal',
    source: 'template',
  });
  doc.pages[0]!.background = { type: 'solid', color: '#fff7ed' };
  const page = doc.pages[0]!;
  // top accent bar
  page.elements.push(
    createRectElement({ x: 0, y: 0, width, height: 22, fill: { type: 'solid', color: '#fb923c' } }),
  );
  // decorative star
  page.elements.push(
    createPathElement(starPoints(940, 140, 55, 22), {
      fill: { type: 'solid', color: '#fb923c' },
      stroke: { color: '#fb923c', width: 0 },
      closed: true,
    }),
  );
  // hexagon accent
  page.elements.push(
    createPathElement(hexagonPoints(80, 820, 90, 90), {
      fill: { type: 'solid', color: '#fde68a' },
      stroke: { color: '#f59e0b', width: 2 },
      closed: true,
    }),
  );
  // heading
  page.elements.push(
    createTextElement({
      x: 80,
      y: 210,
      width: 920,
      height: 180,
      text: 'SUMMER\nSALE',
      fontSize: 148,
      fontWeight: 800,
      textAlign: 'left',
      lineHeight: 0.95,
      color: '#7c2d12',
      fontFamily: 'Inter',
    }),
  );
  page.elements.push(
    createTextElement({
      x: 80,
      y: 420,
      width: 680,
      height: 60,
      text: 'Up to 50% off — this weekend only',
      fontSize: 28,
      fontWeight: 400,
      color: '#9a3412',
      lineHeight: 1.3,
    }),
  );
  page.elements.push(
    createRectElement({
      x: 80,
      y: 520,
      width: 220,
      height: 56,
      fill: { type: 'solid', color: '#111827' },
      cornerRadius: 999,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 80,
      y: 534,
      width: 220,
      height: 28,
      text: 'Shop now →',
      fontSize: 20,
      fontWeight: 700,
      textAlign: 'center',
      color: '#ffffff',
    }),
  );
  // line divider
  page.elements.push(
    createPathElement(
      [
        { x: 80, y: 640 },
        { x: 1000, y: 640 },
      ],
      { stroke: { color: '#fdba74', width: 3 }, fill: { type: 'none' } },
    ),
  );
  return doc;
}

function tplNeonDrop(): DesignDocument {
  const { width, height } = presetSize('instagram-post');
  const doc = createBlankDocument({
    width,
    height,
    name: 'Neon Drop',
    templateId: 'neon-drop',
    source: 'template',
  });
  doc.pages[0]!.background = { type: 'solid', color: '#0f0f0f' };
  const page = doc.pages[0]!;
  page.elements.push(
    createPathElement(starPoints(540, 280, 110, 44), {
      fill: { type: 'solid', color: '#a5f3fc' },
      stroke: { color: '#06b6d4', width: 0 },
      closed: true,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 60,
      y: 460,
      width: 960,
      height: 120,
      text: 'NEW DROP',
      fontSize: 122,
      fontWeight: 800,
      textAlign: 'center',
      color: '#ffffff',
      lineHeight: 0.95,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 140,
      y: 600,
      width: 800,
      height: 80,
      text: 'Future wear for the bold. Limited edition.',
      fontSize: 26,
      fontWeight: 400,
      textAlign: 'center',
      color: '#a1a1aa',
      lineHeight: 1.4,
    }),
  );
  page.elements.push(
    createRectElement({
      x: 400,
      y: 720,
      width: 280,
      height: 56,
      fill: { type: 'solid', color: '#22d3ee' },
      cornerRadius: 8,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 400,
      y: 735,
      width: 280,
      height: 26,
      text: 'Explore collection',
      fontSize: 18,
      fontWeight: 700,
      textAlign: 'center',
      color: '#0f0f0f',
    }),
  );
  return doc;
}

function tplStoryGradient(): DesignDocument {
  const { width, height } = presetSize('instagram-story');
  const doc = createBlankDocument({
    width,
    height,
    name: 'Sunset Story',
    templateId: 'story-gradient',
    source: 'template',
  });
  doc.pages[0]!.background = { type: 'solid', color: '#1e1b4b' };
  const page = doc.pages[0]!;
  // top blob
  page.elements.push(
    createEllipseElement({
      x: -120,
      y: -80,
      width: 640,
      height: 640,
      fill: { type: 'solid', color: '#7c3aed' },
    }),
  );
  page.elements.push(
    createEllipseElement({
      x: 560,
      y: 1200,
      width: 720,
      height: 520,
      fill: { type: 'solid', color: '#ec4899' },
    }),
  );
  page.elements.push(
    createPathElement(starPoints(540, 560, 42, 16, 8), {
      fill: { type: 'solid', color: '#fde68a' },
      stroke: { color: '#fde68a', width: 0 },
      closed: true,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 80,
      y: 680,
      width: 920,
      height: 220,
      text: 'Good\nmorning!',
      fontSize: 132,
      fontWeight: 800,
      textAlign: 'left',
      color: '#ffffff',
      lineHeight: 0.9,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 80,
      y: 940,
      width: 920,
      height: 60,
      text: 'Your daily dose of inspiration',
      fontSize: 26,
      fontWeight: 400,
      color: '#e9d5ff',
      lineHeight: 1.4,
    }),
  );
  page.elements.push(
    createRectElement({
      x: 80,
      y: 1040,
      width: 920,
      height: 3,
      fill: { type: 'solid', color: '#ffffff' },
    }),
  );
  page.elements.push(
    createTextElement({
      x: 80,
      y: 1080,
      width: 920,
      height: 40,
      text: 'SWIPE UP  →',
      fontSize: 20,
      fontWeight: 600,
      textAlign: 'left',
      color: '#ffffff',
      letterSpacing: 4,
    }),
  );
  return doc;
}

function tplPresentationTitle(): DesignDocument {
  const { width, height } = presetSize('presentation-16-9');
  const doc = createBlankDocument({
    width,
    height,
    name: 'Quarterly Review — Title',
    templateId: 'presentation-title',
    source: 'template',
  });
  doc.pages[0]!.background = { type: 'solid', color: '#ffffff' };
  const page = doc.pages[0]!;
  page.elements.push(
    createRectElement({ x: 0, y: 0, width: 8, height, fill: { type: 'solid', color: '#4f46e5' } }),
  );
  page.elements.push(
    createRectElement({
      x: 120,
      y: 140,
      width: 80,
      height: 6,
      fill: { type: 'solid', color: '#4f46e5' },
    }),
  );
  page.elements.push(
    createTextElement({
      x: 120,
      y: 190,
      width: 1100,
      height: 160,
      text: 'Quarterly\nReview 2026',
      fontSize: 108,
      fontWeight: 800,
      color: '#0f172a',
      lineHeight: 0.95,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 120,
      y: 380,
      width: 900,
      height: 80,
      text: 'Growth, learnings, and the road ahead.',
      fontSize: 32,
      fontWeight: 400,
      color: '#475569',
      lineHeight: 1.3,
    }),
  );
  page.elements.push(
    createRectElement({
      x: 1280,
      y: 180,
      width: 520,
      height: 340,
      fill: { type: 'solid', color: '#eef2ff' },
      cornerRadius: 20,
    }),
  );
  page.elements.push(
    createPathElement(trianglePoints(1480, 260, 140, 120), {
      fill: { type: 'solid', color: '#4f46e5' },
      stroke: { color: '#4f46e5', width: 0 },
      closed: true,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 120,
      y: 880,
      width: 600,
      height: 40,
      text: 'Alex Morgan  ·  Strategy Lead',
      fontSize: 22,
      fontWeight: 600,
      color: '#64748b',
    }),
  );
  return doc;
}

function tplPresentationStats(): DesignDocument {
  const { width, height } = presetSize('presentation-16-9');
  const doc = createBlankDocument({
    width,
    height,
    name: 'Stats at a Glance',
    templateId: 'presentation-stats',
    source: 'template',
  });
  doc.pages[0]!.background = { type: 'solid', color: '#f8fafc' };
  const page = doc.pages[0]!;
  page.elements.push(
    createTextElement({
      x: 80,
      y: 60,
      width: 800,
      height: 60,
      text: 'At a glance',
      fontSize: 28,
      fontWeight: 700,
      color: '#1e293b',
      letterSpacing: 2,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 80,
      y: 120,
      width: 1200,
      height: 100,
      text: 'We grew 3× faster than last year',
      fontSize: 64,
      fontWeight: 800,
      color: '#0f172a',
      lineHeight: 1.0,
    }),
  );
  // 3 stat cards
  const cards = [
    { x: 80, label: 'Revenue', value: '$2.4M', delta: '+42%', color: '#4f46e5' },
    { x: 700, label: 'Active users', value: '48.2k', delta: '+18%', color: '#06b6d4' },
    { x: 1320, label: 'NPS', value: '72', delta: '+9', color: '#f59e0b' },
  ];
  for (const c of cards) {
    page.elements.push(
      createRectElement({
        x: c.x,
        y: 300,
        width: 520,
        height: 340,
        fill: { type: 'solid', color: '#ffffff' },
        cornerRadius: 16,
      }),
    );
    page.elements.push(
      createTextElement({
        x: c.x + 40,
        y: 340,
        width: 440,
        height: 30,
        text: c.label.toUpperCase(),
        fontSize: 16,
        fontWeight: 600,
        color: '#64748b',
        letterSpacing: 2,
      }),
    );
    page.elements.push(
      createTextElement({
        x: c.x + 40,
        y: 390,
        width: 440,
        height: 90,
        text: c.value,
        fontSize: 72,
        fontWeight: 800,
        color: '#0f172a',
      }),
    );
    page.elements.push(
      createRectElement({
        x: c.x + 40,
        y: 520,
        width: 90,
        height: 28,
        fill: { type: 'solid', color: c.color },
        cornerRadius: 999,
      }),
    );
    page.elements.push(
      createTextElement({
        x: c.x + 40,
        y: 524,
        width: 90,
        height: 20,
        text: c.delta,
        fontSize: 14,
        fontWeight: 700,
        textAlign: 'center',
        color: '#ffffff',
      }),
    );
  }
  return doc;
}

function tplPosterEvent(): DesignDocument {
  // Use poster preset size but scaled preview will handle
  const { width, height } = presetSize('poster-a4');
  const doc = createBlankDocument({
    width,
    height,
    name: 'Design Week Poster',
    templateId: 'poster-event',
    source: 'template',
  });
  doc.pages[0]!.background = { type: 'solid', color: '#ffffff' };
  const page = doc.pages[0]!;
  page.elements.push(
    createRectElement({
      x: 0,
      y: 0,
      width,
      height: 520,
      fill: { type: 'solid', color: '#4f46e5' },
    }),
  );
  page.elements.push(
    createTextElement({
      x: 120,
      y: 120,
      width: width - 240,
      height: 80,
      text: 'DESIGN WEEK 2026',
      fontSize: 52,
      fontWeight: 700,
      color: '#ffffff',
      letterSpacing: 4,
      textAlign: 'center',
    }),
  );
  page.elements.push(
    createTextElement({
      x: 140,
      y: 240,
      width: width - 280,
      height: 200,
      text: 'TOKYO',
      fontSize: 150,
      fontWeight: 800,
      color: '#ffffff',
      textAlign: 'center',
      lineHeight: 0.9,
    }),
  );
  page.elements.push(
    createPathElement(starPoints(width / 2, 700, 80, 30), {
      fill: { type: 'solid', color: '#fde68a' },
      stroke: { color: '#fde68a', width: 0 },
      closed: true,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 160,
      y: 900,
      width: width - 320,
      height: 240,
      text: 'Three days\nof ideas',
      fontSize: 110,
      fontWeight: 800,
      color: '#0f172a',
      textAlign: 'center',
      lineHeight: 0.9,
    }),
  );
  page.elements.push(
    createRectElement({
      x: width / 2 - 40,
      y: 1240,
      width: 80,
      height: 4,
      fill: { type: 'solid', color: '#4f46e5' },
    }),
  );
  page.elements.push(
    createTextElement({
      x: 200,
      y: 1320,
      width: width - 400,
      height: 200,
      text: 'Nov 12–14 · Shibuya Hikarie\nTickets at designweek.jp',
      fontSize: 36,
      fontWeight: 400,
      color: '#475569',
      textAlign: 'center',
      lineHeight: 1.4,
    }),
  );
  return doc;
}

function tplPosterSale(): DesignDocument {
  const { width, height } = presetSize('poster-a4');
  const doc = createBlankDocument({
    width,
    height,
    name: 'Big Sale Poster',
    templateId: 'poster-sale',
    source: 'template',
  });
  doc.pages[0]!.background = { type: 'solid', color: '#fef08a' };
  const page = doc.pages[0]!;
  page.elements.push(
    createRectElement({
      x: 40,
      y: 40,
      width: width - 80,
      height: height - 80,
      fill: { type: 'solid', color: '#ffffff' },
      cornerRadius: 24,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 120,
      y: 160,
      width: width - 240,
      height: 120,
      text: 'MEGA SALE',
      fontSize: 140,
      fontWeight: 800,
      color: '#dc2626',
      textAlign: 'center',
      lineHeight: 0.9,
    }),
  );
  page.elements.push(
    createPathElement(hexagonPoints(width / 2 - 90, 420, 180, 180), {
      fill: { type: 'solid', color: '#fde68a' },
      stroke: { color: '#f59e0b', width: 0 },
      closed: true,
    }),
  );
  page.elements.push(
    createTextElement({
      x: width / 2 - 70,
      y: 475,
      width: 140,
      height: 70,
      text: '70%',
      fontSize: 58,
      fontWeight: 800,
      textAlign: 'center',
      color: '#92400e',
    }),
  );
  page.elements.push(
    createTextElement({
      x: 120,
      y: 700,
      width: width - 240,
      height: 100,
      text: 'Everything must go',
      fontSize: 52,
      fontWeight: 600,
      color: '#1f2937',
      textAlign: 'center',
    }),
  );
  page.elements.push(
    createRectElement({
      x: 760,
      y: 900,
      width: 960,
      height: 80,
      fill: { type: 'solid', color: '#111827' },
      cornerRadius: 12,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 760,
      y: 922,
      width: 960,
      height: 36,
      text: 'Use code: BIG70',
      fontSize: 30,
      fontWeight: 700,
      textAlign: 'center',
      color: '#ffffff',
      letterSpacing: 2,
    }),
  );
  return doc;
}

function tplYoutube(): DesignDocument {
  const { width, height } = presetSize('youtube-thumbnail');
  const doc = createBlankDocument({
    width,
    height,
    name: 'YouTube — How I Built This',
    templateId: 'youtube-thumbnail',
    source: 'template',
  });
  doc.pages[0]!.background = { type: 'solid', color: '#0f172a' };
  const page = doc.pages[0]!;
  page.elements.push(
    createRectElement({
      x: 40,
      y: 40,
      width: 520,
      height: 520,
      fill: { type: 'solid', color: '#1e293b' },
      cornerRadius: 24,
    }),
  );
  page.elements.push(
    createEllipseElement({
      x: 140,
      y: 160,
      width: 320,
      height: 320,
      fill: { type: 'solid', color: '#334155' },
    }),
  );
  page.elements.push(
    createTextElement({
      x: 600,
      y: 120,
      width: 600,
      height: 200,
      text: 'HOW I\nBUILT THIS',
      fontSize: 92,
      fontWeight: 800,
      color: '#ffffff',
      lineHeight: 0.9,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 600,
      y: 360,
      width: 560,
      height: 80,
      text: 'From 0 to 1M users — no funding',
      fontSize: 26,
      fontWeight: 400,
      color: '#cbd5e1',
    }),
  );
  page.elements.push(
    createRectElement({
      x: 600,
      y: 500,
      width: 200,
      height: 36,
      fill: { type: 'solid', color: '#ef4444' },
      cornerRadius: 6,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 600,
      y: 508,
      width: 200,
      height: 20,
      text: '▶  WATCH NOW',
      fontSize: 16,
      fontWeight: 700,
      textAlign: 'center',
      color: '#ffffff',
    }),
  );
  return doc;
}

function tplBusinessCard(): DesignDocument {
  const { width, height } = presetSize('business-card');
  const doc = createBlankDocument({
    width,
    height,
    name: 'Business Card — Noir',
    templateId: 'business-card',
    source: 'template',
  });
  doc.pages[0]!.background = { type: 'solid', color: '#0f0f0f' };
  const page = doc.pages[0]!;
  page.elements.push(
    createRectElement({
      x: 40,
      y: 40,
      width: 4,
      height: height - 80,
      fill: { type: 'solid', color: '#a5f3fc' },
    }),
  );
  page.elements.push(
    createTextElement({
      x: 80,
      y: 80,
      width: 600,
      height: 80,
      text: 'Alex Chen',
      fontSize: 56,
      fontWeight: 800,
      color: '#ffffff',
    }),
  );
  page.elements.push(
    createTextElement({
      x: 80,
      y: 150,
      width: 600,
      height: 40,
      text: 'Creative Director · Studio M',
      fontSize: 22,
      fontWeight: 400,
      color: '#a1a1aa',
      letterSpacing: 1,
    }),
  );
  page.elements.push(
    createPathElement(trianglePoints(880, 140, 70, 70), {
      fill: { type: 'solid', color: '#22d3ee' },
      stroke: { color: '#22d3ee', width: 0 },
      closed: true,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 80,
      y: 460,
      width: 600,
      height: 60,
      text: 'alex@studiom.co  ·  studiom.co',
      fontSize: 18,
      fontWeight: 400,
      color: '#e5e7eb',
    }),
  );
  return doc;
}

function tplQuote(): DesignDocument {
  const { width, height } = presetSize('instagram-post');
  const doc = createBlankDocument({
    width,
    height,
    name: 'Quote — Keep Going',
    templateId: 'quote',
    source: 'template',
  });
  doc.pages[0]!.background = { type: 'solid', color: '#7c3aed' };
  const page = doc.pages[0]!;
  page.elements.push(
    createEllipseElement({
      x: -80,
      y: -60,
      width: 400,
      height: 400,
      fill: { type: 'solid', color: '#a78bfa' },
    }),
  );
  page.elements.push(
    createEllipseElement({
      x: 780,
      y: 820,
      width: 360,
      height: 360,
      fill: { type: 'solid', color: '#4c1d95' },
    }),
  );
  page.elements.push(
    createTextElement({
      x: 80,
      y: 80,
      width: 100,
      height: 100,
      text: '“',
      fontSize: 140,
      fontWeight: 800,
      color: '#ffffff',
    }),
  );
  page.elements.push(
    createTextElement({
      x: 80,
      y: 260,
      width: 920,
      height: 420,
      text: 'Creativity is intelligence having fun.',
      fontSize: 64,
      fontWeight: 700,
      color: '#ffffff',
      lineHeight: 1.15,
      textAlign: 'center',
    }),
  );
  page.elements.push(
    createRectElement({
      x: 490,
      y: 720,
      width: 100,
      height: 4,
      fill: { type: 'solid', color: '#ffffff' },
    }),
  );
  page.elements.push(
    createTextElement({
      x: 80,
      y: 770,
      width: 920,
      height: 40,
      text: '— ALBERT EINSTEIN',
      fontSize: 22,
      fontWeight: 600,
      color: '#ddd6fe',
      textAlign: 'center',
      letterSpacing: 3,
    }),
  );
  return doc;
}

function tplPortfolio(): DesignDocument {
  const { width, height } = presetSize('presentation-16-9');
  const doc = createBlankDocument({
    width,
    height,
    name: 'Portfolio Cover',
    templateId: 'portfolio-cover',
    source: 'template',
  });
  doc.pages[0]!.background = { type: 'solid', color: '#ffffff' };
  const page = doc.pages[0]!;
  page.elements.push(
    createRectElement({
      x: 0,
      y: 0,
      width: 860,
      height,
      fill: { type: 'solid', color: '#f1f5f9' },
    }),
  );
  page.elements.push(
    createRectElement({
      x: 120,
      y: 160,
      width: 620,
      height: 760,
      fill: { type: 'solid', color: '#e2e8f0' },
      cornerRadius: 16,
    }),
  );
  page.elements.push(
    createPathElement(starPoints(430, 540, 28, 12, 8), {
      fill: { type: 'solid', color: '#ffffff' },
      stroke: { color: '#ffffff', width: 0 },
      closed: true,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 960,
      y: 220,
      width: 820,
      height: 200,
      text: 'Alex\nPortfolio',
      fontSize: 108,
      fontWeight: 800,
      color: '#0f172a',
      lineHeight: 0.9,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 960,
      y: 460,
      width: 760,
      height: 80,
      text: 'Product designer crafting human-centered experiences for 8+ years.',
      fontSize: 26,
      fontWeight: 400,
      color: '#475569',
      lineHeight: 1.4,
    }),
  );
  page.elements.push(
    createRectElement({
      x: 960,
      y: 600,
      width: 180,
      height: 44,
      fill: { type: 'solid', color: '#0f172a' },
      cornerRadius: 999,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 960,
      y: 612,
      width: 180,
      height: 20,
      text: 'View work →',
      fontSize: 16,
      fontWeight: 600,
      textAlign: 'center',
      color: '#ffffff',
    }),
  );
  return doc;
}

function tplBrand(): DesignDocument {
  const { width, height } = presetSize('instagram-post');
  const doc = createBlankDocument({
    width,
    height,
    name: 'Brand Palette — Studio M',
    templateId: 'brand-starter',
    source: 'template',
  });
  doc.pages[0]!.background = { type: 'solid', color: '#f9fafb' };
  const page = doc.pages[0]!;
  page.elements.push(
    createTextElement({
      x: 60,
      y: 60,
      width: 960,
      height: 60,
      text: 'STUDIO M',
      fontSize: 28,
      fontWeight: 800,
      color: '#111827',
      letterSpacing: 6,
      textAlign: 'center',
    }),
  );
  page.elements.push(
    createTextElement({
      x: 60,
      y: 120,
      width: 960,
      height: 40,
      text: '— brand starter kit —',
      fontSize: 16,
      fontWeight: 400,
      color: '#6b7280',
      letterSpacing: 2,
      textAlign: 'center',
    }),
  );
  const cols = [
    { x: 140, color: '#4f46e5', label: 'Primary' },
    { x: 420, color: '#06b6d4', label: 'Accent' },
    { x: 700, color: '#f59e0b', label: 'Highlight' },
  ];
  for (const c of cols) {
    page.elements.push(
      createEllipseElement({
        x: c.x,
        y: 260,
        width: 140,
        height: 140,
        fill: { type: 'solid', color: c.color },
      }),
    );
    page.elements.push(
      createTextElement({
        x: c.x - 20,
        y: 430,
        width: 180,
        height: 24,
        text: c.label,
        fontSize: 16,
        fontWeight: 600,
        textAlign: 'center',
        color: '#374151',
      }),
    );
    page.elements.push(
      createTextElement({
        x: c.x - 20,
        y: 454,
        width: 180,
        height: 20,
        text: c.color,
        fontSize: 14,
        fontWeight: 400,
        textAlign: 'center',
        color: '#9ca3af',
      }),
    );
  }
  page.elements.push(
    createTextElement({
      x: 140,
      y: 560,
      width: 800,
      height: 80,
      text: 'Inter  ·  Clean, modern, timeless',
      fontSize: 24,
      fontWeight: 600,
      color: '#111827',
      textAlign: 'center',
    }),
  );
  page.elements.push(
    createRectElement({
      x: 340,
      y: 660,
      width: 400,
      height: 56,
      fill: { type: 'solid', color: '#111827' },
      cornerRadius: 12,
    }),
  );
  page.elements.push(
    createTextElement({
      x: 340,
      y: 676,
      width: 400,
      height: 24,
      text: 'Use this palette →',
      fontSize: 18,
      fontWeight: 600,
      textAlign: 'center',
      color: '#ffffff',
    }),
  );
  return doc;
}

// ---------------------------------------------------------------------------
// Signature catalogue
// ---------------------------------------------------------------------------

export const SIGNATURE_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'instagram-minimal',
    label: 'Pastel Summer Sale',
    description: 'Warm, airy sale announcement',
    category: 'social',
    presetId: 'instagram-post',
    tags: ['instagram', 'sale', 'summer'],
    build: tplInstagramMinimal,
  },
  {
    id: 'neon-drop',
    label: 'Neon Drop',
    description: 'Bold dark launch for streetwear',
    category: 'social',
    presetId: 'instagram-post',
    tags: ['instagram', 'bold', 'dark'],
    build: tplNeonDrop,
  },
  {
    id: 'story-gradient',
    label: 'Sunset Story',
    description: 'Gradient morning story',
    category: 'social',
    presetId: 'instagram-story',
    tags: ['story', 'gradient', 'morning'],
    build: tplStoryGradient,
  },
  {
    id: 'presentation-title',
    label: 'Quarterly Review',
    description: 'Clean title slide with accent bar',
    category: 'presentation',
    presetId: 'presentation-16-9',
    tags: ['presentation', 'business', 'title'],
    build: tplPresentationTitle,
  },
  {
    id: 'presentation-stats',
    label: 'Stats at a Glance',
    description: 'Three-column KPI cards',
    category: 'presentation',
    presetId: 'presentation-16-9',
    tags: ['presentation', 'stats', 'kpi'],
    build: tplPresentationStats,
  },
  {
    id: 'poster-event',
    label: 'Design Week Tokyo',
    description: 'Editorial event poster A4',
    category: 'print',
    presetId: 'poster-a4',
    tags: ['poster', 'event', 'a4'],
    build: tplPosterEvent,
  },
  {
    id: 'poster-sale',
    label: 'Mega Sale 70%',
    description: 'High-contrast sale poster',
    category: 'print',
    presetId: 'poster-a4',
    tags: ['poster', 'sale', 'print'],
    build: tplPosterSale,
  },
  {
    id: 'youtube-thumbnail',
    label: 'YouTube Cover',
    description: 'Creator thumbnail with CTA',
    category: 'video',
    presetId: 'youtube-thumbnail',
    tags: ['youtube', 'video', 'thumbnail'],
    build: tplYoutube,
  },
  {
    id: 'business-card',
    label: 'Noir Business Card',
    description: 'Minimal dark business card',
    category: 'business',
    presetId: 'business-card',
    tags: ['business', 'card', 'minimal'],
    build: tplBusinessCard,
  },
  {
    id: 'quote',
    label: 'Keep Going',
    description: 'Inspirational quote card',
    category: 'social',
    presetId: 'instagram-post',
    tags: ['quote', 'instagram', 'inspiration'],
    build: tplQuote,
  },
  {
    id: 'portfolio-cover',
    label: 'Portfolio Cover',
    description: 'Designer portfolio intro',
    category: 'presentation',
    presetId: 'presentation-16-9',
    tags: ['portfolio', 'presentation', 'minimal'],
    build: tplPortfolio,
  },
  {
    id: 'brand-starter',
    label: 'Brand Starter Kit',
    description: 'Palette + type system',
    category: 'business',
    presetId: 'instagram-post',
    tags: ['brand', 'palette', 'kit'],
    build: tplBrand,
  },
];
