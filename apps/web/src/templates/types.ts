import type { DesignDocument } from '@opencanvas/document';

export type TemplateCategory = 'social' | 'presentation' | 'print' | 'video' | 'business' | 'all';

/** A template the gallery can show and the editor can apply. */
export interface TemplateDefinition {
  id: string;
  label: string;
  description: string;
  category: Exclude<TemplateCategory, 'all'>;
  presetId: string;
  tags: string[];
  build: () => DesignDocument;
}

/** Four colours and a type pairing — the only things that separate two cuts of one layout. */
export interface TemplatePalette {
  bg: string;
  ink: string;
  accent: string;
  soft: string;
  onAccent?: string;
}

export interface TemplateTypography {
  display: string;
  body: string;
  /** Second display family for paired headings; falls back to `display`. */
  alt?: string;
}

export interface TemplateStat {
  value: string;
  label: string;
}

/** The copy a blueprint lays out. Every field is optional except `title`. */
export interface TemplateContent {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  body?: string;
  cta?: string;
  footer?: string;
  meta?: string;
  badge?: string;
  price?: string;
  date?: string;
  month?: string;
  items?: string[];
  stats?: TemplateStat[];
  monogram?: string;
}

export interface BlueprintOptions {
  templateId: string;
  presetId: string;
  name: string;
  palette: TemplatePalette;
  type: TemplateTypography;
  content: TemplateContent;
  /** Mirrors the layout left-to-right (panels, splits, banners). */
  flip?: boolean;
}

export interface Blueprint {
  id: string;
  build: (options: BlueprintOptions) => DesignDocument;
}

/**
 * One entry per design in the catalogue. The copy and palette live here; the composition lives
 * in `blueprints.ts`, so a new design is a few lines of data rather than a new factory.
 */
export interface TemplateInstance {
  id: string;
  label: string;
  description: string;
  category: Exclude<TemplateCategory, 'all'>;
  presetId: string;
  tags: string[];
  blueprint: string;
  palette: TemplatePalette;
  type: TemplateTypography;
  content: TemplateContent;
  flip?: boolean;
}
