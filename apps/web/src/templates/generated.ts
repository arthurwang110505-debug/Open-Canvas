import type {
  TemplateCategory,
  TemplateContent,
  TemplateInstance,
  TemplatePalette,
  TemplateTypography,
} from './types';

/**
 * The programmatically generated half of the catalogue.
 *
 * Each collection fixes a blueprint, a canvas preset and a category, then crosses a small set of
 * curated palettes, type pairings and content themes. Because every member of a collection shares
 * a mood (bold sale palettes with bold display faces and sale copy, calm quote palettes with
 * serif faces and reflective copy), every cross-product member reads as a real design rather
 * than a random combination. Adding a design is adding data here — no new factory.
 */

interface PaletteVariant {
  slug: string;
  label: string;
  palette: TemplatePalette;
}

interface TypeVariant {
  slug: string;
  type: TemplateTypography;
}

interface ContentVariant {
  slug: string;
  label: string;
  description: string;
  content: TemplateContent;
}

interface Collection {
  blueprint: string;
  presetId: string;
  category: Exclude<TemplateCategory, 'all'>;
  tags: string[];
  palettes: PaletteVariant[];
  types: TypeVariant[];
  contents: ContentVariant[];
}

const COLLECTIONS: readonly Collection[] = [
  {
    blueprint: 'sale',
    presetId: 'instagram-post',
    category: 'social',
    tags: ['sale', 'promotion', 'retail'],
    palettes: [
      {
        slug: 'noir',
        label: 'Noir',
        palette: {
          bg: '#111111',
          ink: '#111111',
          accent: '#facc15',
          soft: '#fde68a',
          onAccent: '#111111',
        },
      },
      {
        slug: 'crimson',
        label: 'Crimson',
        palette: { bg: '#fff7ed', ink: '#7f1d1d', accent: '#dc2626', soft: '#fecaca' },
      },
      {
        slug: 'royal',
        label: 'Royal',
        palette: { bg: '#eff6ff', ink: '#1e3a8a', accent: '#2563eb', soft: '#bfdbfe' },
      },
      {
        slug: 'forest',
        label: 'Forest',
        palette: { bg: '#f0fdf4', ink: '#14532d', accent: '#16a34a', soft: '#bbf7d0' },
      },
    ],
    types: [
      { slug: 'anton', type: { display: 'Anton', body: 'Inter' } },
      { slug: 'bebas', type: { display: 'Bebas Neue', body: 'Montserrat' } },
    ],
    contents: [
      {
        slug: 'midnight-sale',
        label: 'Midnight Sale',
        description: 'High-contrast sale post for a one-night event',
        content: {
          badge: 'Sale',
          price: '50%',
          title: 'Everything\nmust go',
          subtitle: 'One night only — no restocks, no rain checks.',
          cta: 'Shop now',
        },
      },
      {
        slug: 'summer-clearance',
        label: 'Summer Clearance',
        description: 'Seasonal markdown post with a bold discount',
        content: {
          badge: 'Clearance',
          price: '70%',
          title: 'Last call\nfor summer',
          subtitle: 'Final markdowns on seasonal favorites.',
          cta: 'Grab yours',
        },
      },
    ],
  },
  {
    blueprint: 'quote',
    presetId: 'instagram-post',
    category: 'social',
    tags: ['quote', 'inspiration', 'minimal'],
    palettes: [
      {
        slug: 'sage',
        label: 'Sage',
        palette: { bg: '#f5f5f0', ink: '#3f3f2e', accent: '#84a98c', soft: '#dde5d5' },
      },
      {
        slug: 'dusk',
        label: 'Dusk',
        palette: { bg: '#1e293b', ink: '#f1f5f9', accent: '#f59e0b', soft: '#334155' },
      },
      {
        slug: 'rose',
        label: 'Rose',
        palette: { bg: '#fff1f2', ink: '#881337', accent: '#e11d48', soft: '#fecdd3' },
      },
      {
        slug: 'ocean',
        label: 'Ocean',
        palette: { bg: '#f0f9ff', ink: '#0c4a6e', accent: '#0284c7', soft: '#bae6fd' },
      },
    ],
    types: [
      { slug: 'playfair', type: { display: 'Playfair Display', body: 'Inter' } },
      { slug: 'garamond', type: { display: 'EB Garamond', body: 'Lora' } },
    ],
    contents: [
      {
        slug: 'slow-down',
        label: 'Slow Down',
        description: 'Quiet quote post about rest and patience',
        content: {
          title: 'Nature does not hurry,\nyet everything\nis accomplished.',
          subtitle: 'A reminder to move at your own pace.',
          footer: '— Lao Tzu',
        },
      },
      {
        slug: 'begin-again',
        label: 'Begin Again',
        description: 'Encouraging quote post about fresh starts',
        content: {
          title: 'Every morning is\nthe world’s\nfirst morning.',
          subtitle: 'Start again, gently, today.',
          footer: '— after Rumi',
        },
      },
    ],
  },
  {
    blueprint: 'event',
    presetId: 'instagram-story',
    category: 'social',
    tags: ['event', 'invitation', 'gathering'],
    palettes: [
      {
        slug: 'gold',
        label: 'Gold',
        palette: { bg: '#1c1917', ink: '#fafaf9', accent: '#f59e0b', soft: '#44403c' },
      },
      {
        slug: 'plum',
        label: 'Plum',
        palette: { bg: '#faf5ff', ink: '#581c87', accent: '#9333ea', soft: '#e9d5ff' },
      },
      {
        slug: 'teal',
        label: 'Teal',
        palette: { bg: '#f0fdfa', ink: '#134e4a', accent: '#0d9488', soft: '#99f6e4' },
      },
      {
        slug: 'coral',
        label: 'Coral',
        palette: { bg: '#fff7ed', ink: '#9a3412', accent: '#ea580c', soft: '#fed7aa' },
      },
    ],
    types: [
      { slug: 'fraunces', type: { display: 'Fraunces', body: 'DM Sans' } },
      { slug: 'script', type: { display: 'Pacifico', body: 'Nunito' } },
    ],
    contents: [
      {
        slug: 'spring-gala',
        label: 'Spring Gala',
        description: 'Evening invitation story for a gala dinner',
        content: {
          title: 'Spring\nGala',
          subtitle: 'An evening of music and dinner under the lights.',
          date: 'Sat · Apr 12',
          month: 'April',
          cta: 'RSVP',
          footer: 'The Grand Hall · 19:00',
        },
      },
      {
        slug: 'founders-night',
        label: 'Founders Night',
        description: 'Members-only story for a networking evening',
        content: {
          title: 'Founders\nNight',
          subtitle: 'Pitch, mingle, and meet the next cohort.',
          date: 'Thu · May 8',
          month: 'May',
          cta: 'Save your seat',
          footer: 'Studio 3 · 18:30',
        },
      },
    ],
  },
  {
    blueprint: 'cover',
    presetId: 'presentation-16-9',
    category: 'presentation',
    tags: ['presentation', 'cover', 'title'],
    palettes: [
      {
        slug: 'ink',
        label: 'Ink',
        palette: { bg: '#0f172a', ink: '#f8fafc', accent: '#38bdf8', soft: '#1e293b' },
      },
      {
        slug: 'paper',
        label: 'Paper',
        palette: { bg: '#fafaf9', ink: '#1c1917', accent: '#b45309', soft: '#e7e5e4' },
      },
      {
        slug: 'moss',
        label: 'Moss',
        palette: { bg: '#f7fee7', ink: '#365314', accent: '#65a30d', soft: '#d9f99d' },
      },
      {
        slug: 'berry',
        label: 'Berry',
        palette: { bg: '#fdf2f8', ink: '#831843', accent: '#db2777', soft: '#fbcfe8' },
      },
    ],
    types: [
      { slug: 'grotesk', type: { display: 'Space Grotesk', body: 'Inter' } },
      { slug: 'fraunces', type: { display: 'Fraunces', body: 'Inter' } },
    ],
    contents: [
      {
        slug: 'quarterly-review',
        label: 'Quarterly Review',
        description: 'Title slide for an all-hands review',
        content: {
          eyebrow: 'Q3 · All hands',
          title: 'Quarterly\nReview',
          subtitle: 'What we shipped, what we learned, what’s next.',
          meta: 'Strategy team',
          footer: 'Confidential · Internal',
        },
      },
      {
        slug: 'product-launch',
        label: 'Product Launch',
        description: 'Keynote title slide for a product reveal',
        content: {
          eyebrow: 'Keynote · 2026',
          title: 'Introducing\nNova',
          subtitle: 'The fastest way to plan your week.',
          meta: 'Product team',
          footer: 'nova.app',
        },
      },
    ],
  },
  {
    blueprint: 'stats',
    presetId: 'presentation-16-9',
    category: 'business',
    tags: ['report', 'metrics', 'data'],
    palettes: [
      {
        slug: 'navy',
        label: 'Navy',
        palette: { bg: '#eff6ff', ink: '#172554', accent: '#1d4ed8', soft: '#dbeafe' },
      },
      {
        slug: 'mint',
        label: 'Mint',
        palette: { bg: '#ecfdf5', ink: '#064e3b', accent: '#059669', soft: '#a7f3d0' },
      },
      {
        slug: 'sand',
        label: 'Sand',
        palette: { bg: '#fefce8', ink: '#713f12', accent: '#ca8a04', soft: '#fef08a' },
      },
      {
        slug: 'slate',
        label: 'Slate',
        palette: { bg: '#f8fafc', ink: '#0f172a', accent: '#475569', soft: '#e2e8f0' },
      },
    ],
    types: [
      { slug: 'archivo', type: { display: 'Archivo', body: 'Inter' } },
      { slug: 'roboto', type: { display: 'Space Grotesk', body: 'Roboto' } },
    ],
    contents: [
      {
        slug: 'growth-report',
        label: 'Growth Report',
        description: 'Business metrics slide with three headline numbers',
        content: {
          eyebrow: 'Year to date',
          title: 'Growth, by\nthe numbers',
          stats: [
            { value: '128%', label: 'Revenue growth' },
            { value: '42k', label: 'Active users' },
            { value: '4.9', label: 'Average rating' },
          ],
          footer: 'Finance · October',
        },
      },
      {
        slug: 'impact-report',
        label: 'Impact Report',
        description: 'Sustainability metrics slide with three headline numbers',
        content: {
          eyebrow: '2026 so far',
          title: 'Impact at\na glance',
          stats: [
            { value: '12k', label: 'Trees planted' },
            { value: '98%', label: 'Waste diverted' },
            { value: '30', label: 'Cities reached' },
          ],
          footer: 'Sustainability team',
        },
      },
    ],
  },
  {
    blueprint: 'product',
    presetId: 'instagram-post',
    category: 'business',
    tags: ['product', 'shop', 'launch'],
    palettes: [
      {
        slug: 'cream',
        label: 'Cream',
        palette: { bg: '#fffbeb', ink: '#78350f', accent: '#d97706', soft: '#fde68a' },
      },
      {
        slug: 'noir',
        label: 'Noir',
        palette: { bg: '#171717', ink: '#fafafa', accent: '#e7e5e4', soft: '#404040' },
      },
      {
        slug: 'blush',
        label: 'Blush',
        palette: { bg: '#fff1f2', ink: '#881337', accent: '#f43f5e', soft: '#ffe4e6' },
      },
      {
        slug: 'sage',
        label: 'Sage',
        palette: { bg: '#f0fdf4', ink: '#14532d', accent: '#22c55e', soft: '#dcfce7' },
      },
    ],
    types: [
      { slug: 'poppins', type: { display: 'Poppins', body: 'Poppins' } },
      { slug: 'lora', type: { display: 'Lora', body: 'Karla' } },
    ],
    contents: [
      {
        slug: 'everyday-tote',
        label: 'Everyday Tote',
        description: 'Product post for a new carry-all bag',
        content: {
          eyebrow: 'Just landed',
          title: 'The Everyday\nTote',
          subtitle: 'Canvas, leather, and room for everything.',
          price: '$68',
          cta: 'Shop now',
        },
      },
      {
        slug: 'studio-mug',
        label: 'Studio Mug',
        description: 'Small-batch product post with a price',
        content: {
          eyebrow: 'Small batch',
          title: 'Studio Mug,\nVol. 2',
          subtitle: 'Hand-glazed stoneware. 200 pieces only.',
          price: '$42',
          cta: 'Reserve yours',
        },
      },
    ],
  },
  {
    blueprint: 'agenda',
    presetId: 'presentation-16-9',
    category: 'presentation',
    tags: ['agenda', 'schedule', 'meeting'],
    palettes: [
      {
        slug: 'chalk',
        label: 'Chalk',
        palette: { bg: '#fafaf9', ink: '#1c1917', accent: '#c2410c', soft: '#f5f5f4' },
      },
      {
        slug: 'harbor',
        label: 'Harbor',
        palette: { bg: '#eff6ff', ink: '#172554', accent: '#1d4ed8', soft: '#dbeafe' },
      },
      {
        slug: 'fern',
        label: 'Fern',
        palette: { bg: '#f0fdf4', ink: '#14532d', accent: '#15803d', soft: '#dcfce7' },
      },
      {
        slug: 'graphite',
        label: 'Graphite',
        palette: {
          bg: '#0f172a',
          ink: '#e2e8f0',
          accent: '#38bdf8',
          soft: '#1e293b',
          onAccent: '#0f172a',
        },
      },
    ],
    types: [
      { slug: 'grotesk', type: { display: 'Space Grotesk', body: 'Inter' } },
      { slug: 'figtree', type: { display: 'Bricolage Grotesque', body: 'Figtree' } },
    ],
    contents: [
      {
        slug: 'kickoff-agenda',
        label: 'Kickoff Agenda',
        description: 'Numbered running order for a project kickoff',
        content: {
          eyebrow: 'Project kickoff',
          title: 'How today runs',
          items: [
            'Why this project exists, in one page',
            'What ships first and what waits',
            'Who owns which decision',
            'Risks we already know about',
          ],
          footer: '09:30 – 11:00 · Meeting room 2',
        },
      },
      {
        slug: 'sprint-review-agenda',
        label: 'Sprint Review',
        description: 'Review agenda with four timed sections',
        content: {
          eyebrow: 'Sprint review',
          title: 'What we will cover',
          items: [
            'Demo: the three things that shipped',
            'Numbers: usage, errors, and load',
            'What slipped, and the honest reason',
            'Next sprint: one goal, not five',
          ],
          footer: '45 minutes · Questions welcome throughout',
        },
      },
    ],
  },
  {
    blueprint: 'profile',
    presetId: 'business-card',
    category: 'business',
    tags: ['business card', 'contact', 'profile'],
    palettes: [
      {
        slug: 'paper',
        label: 'Paper',
        palette: {
          bg: '#fafaf9',
          ink: '#18181b',
          accent: '#18181b',
          soft: '#e4e4e7',
          onAccent: '#fafaf9',
        },
      },
      {
        slug: 'ink',
        label: 'Ink',
        palette: {
          bg: '#0f172a',
          ink: '#f8fafc',
          accent: '#38bdf8',
          soft: '#1e293b',
          onAccent: '#0f172a',
        },
      },
      {
        slug: 'clay',
        label: 'Clay',
        palette: { bg: '#fef3c7', ink: '#44403c', accent: '#b45309', soft: '#fde68a' },
      },
      {
        slug: 'mint',
        label: 'Mint',
        palette: { bg: '#ecfdf5', ink: '#064e3b', accent: '#047857', soft: '#d1fae5' },
      },
    ],
    types: [
      { slug: 'fraunces', type: { display: 'Fraunces', body: 'Inter' } },
      { slug: 'karla', type: { display: 'Archivo', body: 'Karla' } },
    ],
    contents: [
      {
        slug: 'studio-card',
        label: 'Studio Card',
        description: 'Business card for an independent studio',
        content: {
          monogram: 'SL',
          title: 'Sam Lin',
          subtitle: 'Studio lead',
          items: ['sam@slstudio.co', '+886 900 123 456', 'slstudio.co'],
          cta: 'Say hello',
        },
      },
      {
        slug: 'freelance-card',
        label: 'Freelance Card',
        description: 'Contact card for a freelance specialist',
        content: {
          monogram: 'JR',
          title: 'Jo Rivera',
          subtitle: 'Brand consultant',
          items: ['jo@riveraworks.com', '+1 415 555 0147', 'riveraworks.com'],
          cta: 'Book a call',
        },
      },
    ],
  },
  {
    blueprint: 'banner',
    presetId: 'youtube-thumbnail',
    category: 'video',
    tags: ['thumbnail', 'youtube', 'video'],
    palettes: [
      {
        slug: 'midnight',
        label: 'Midnight',
        palette: {
          bg: '#0b1220',
          ink: '#f8fafc',
          accent: '#fb7185',
          soft: '#1e293b',
          onAccent: '#0b1220',
        },
      },
      {
        slug: 'citrus',
        label: 'Citrus',
        palette: { bg: '#fff7ed', ink: '#7c2d12', accent: '#ea580c', soft: '#fed7aa' },
      },
      {
        slug: 'electric',
        label: 'Electric',
        palette: {
          bg: '#1e1b4b',
          ink: '#ede9fe',
          accent: '#a78bfa',
          soft: '#312e81',
          onAccent: '#1e1b4b',
        },
      },
      {
        slug: 'lagoon',
        label: 'Lagoon',
        palette: { bg: '#ecfeff', ink: '#164e63', accent: '#0891b2', soft: '#cffafe' },
      },
    ],
    types: [
      { slug: 'sora', type: { display: 'Sora', body: 'Inter' } },
      { slug: 'anton', type: { display: 'Anton', body: 'Work Sans' } },
    ],
    contents: [
      {
        slug: 'tutorial-thumb',
        label: 'Tutorial',
        description: 'Thumbnail for a step-by-step build video',
        content: {
          eyebrow: 'New tutorial',
          title: 'Build it\nin one\nsitting',
          subtitle: 'Every step, no skipped files, nothing hidden off-screen.',
          cta: 'Watch now',
          footer: '22:10',
        },
      },
      {
        slug: 'interview-thumb',
        label: 'Interview',
        description: 'Thumbnail for a long-form interview episode',
        content: {
          eyebrow: 'Episode 24',
          title: 'The tools\nwe keep\ncoming back to',
          subtitle: 'An hour on craft, constraints, and shipping small.',
          cta: 'Listen in',
          footer: '58:04',
        },
      },
    ],
  },
  {
    blueprint: 'big-type',
    presetId: 'poster-a4',
    category: 'print',
    tags: ['poster', 'typography', 'event'],
    palettes: [
      {
        slug: 'bone',
        label: 'Bone',
        palette: { bg: '#fafafa', ink: '#09090b', accent: '#db2777', soft: '#f4f4f5' },
      },
      {
        slug: 'obsidian',
        label: 'Obsidian',
        palette: {
          bg: '#101010',
          ink: '#fafafa',
          accent: '#f97316',
          soft: '#1f1f1f',
          onAccent: '#101010',
        },
      },
      {
        slug: 'cobalt',
        label: 'Cobalt',
        palette: { bg: '#eef2ff', ink: '#1e1b4b', accent: '#4338ca', soft: '#e0e7ff' },
      },
      {
        slug: 'olive',
        label: 'Olive',
        palette: { bg: '#f7f7ed', ink: '#1a2e05', accent: '#4d7c0f', soft: '#e7edd3' },
      },
    ],
    types: [
      { slug: 'oswald', type: { display: 'Oswald', body: 'Inter' } },
      { slug: 'bebas', type: { display: 'Bebas Neue', body: 'Montserrat' } },
    ],
    contents: [
      {
        slug: 'open-studio-poster',
        label: 'Open Studio',
        description: 'Oversized headline poster for an open studio night',
        content: {
          eyebrow: 'One night only',
          title: 'OPEN\nSTUDIO\n26',
          subtitle: 'Prints, proofs, and work still drying on the table.',
          footer: 'Warehouse 4 · Mar 14',
          meta: 'FREE ENTRY',
        },
      },
      {
        slug: 'record-fair-poster',
        label: 'Record Fair',
        description: 'Bold type poster for a weekend record fair',
        content: {
          eyebrow: 'Twelve sellers · all day',
          title: 'RECORD\nFAIR\nNO. 9',
          subtitle: 'Crates from nine cities, coffee from one very tired van.',
          footer: 'Old Market Hall · Sat 10:00',
          meta: 'ENTRY €4',
        },
      },
    ],
  },
];

/** Expands every collection into its cross-product of instances. */
export const GENERATED_INSTANCES: readonly TemplateInstance[] = COLLECTIONS.flatMap((collection) =>
  collection.contents.flatMap((content) =>
    collection.palettes.flatMap((palette) =>
      collection.types.map((type) => ({
        id: `${content.slug}-${palette.slug}-${type.slug}`,
        label: `${content.label} · ${palette.label}`,
        description: content.description,
        category: collection.category,
        presetId: collection.presetId,
        tags: collection.tags,
        blueprint: collection.blueprint,
        palette: palette.palette,
        type: type.type,
        content: content.content,
      })),
    ),
  ),
);
