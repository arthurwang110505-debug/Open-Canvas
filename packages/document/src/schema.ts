import { z } from 'zod';

import { CURRENT_SCHEMA_VERSION, LIMITS, SUPPORTED_IMAGE_MIME_TYPES } from './constants';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const IdSchema = z
  .string()
  .min(1)
  .max(LIMITS.maxIdLength)
  .regex(/^[A-Za-z0-9_-]+$/, 'Identifiers may only contain letters, digits, "_" and "-"');

/** `#rrggbb` or `#rrggbbaa`. Kept deliberately simple so every exporter can consume it. */
export const HexColorSchema = z
  .string()
  .regex(
    /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
    'Expected a hex color such as #1a2b3c or #1a2b3cff',
  );

export const SolidFillSchema = z.object({
  type: z.literal('solid'),
  color: HexColorSchema,
});

export const NoFillSchema = z.object({
  type: z.literal('none'),
});

export const FillSchema = z.discriminatedUnion('type', [SolidFillSchema, NoFillSchema]);

export const StrokeSchema = z.object({
  color: HexColorSchema,
  width: z.number().min(0).max(LIMITS.maxStrokeWidth),
});

const CoordinateSchema = z.number().min(-LIMITS.maxCoordinate).max(LIMITS.maxCoordinate);
const ElementDimensionSchema = z
  .number()
  .min(LIMITS.minElementDimension)
  .max(LIMITS.maxElementDimension);
const CanvasDimensionSchema = z
  .number()
  .int()
  .min(LIMITS.minCanvasDimension)
  .max(LIMITS.maxCanvasDimension);

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

/**
 * Geometry convention (shared by every renderer and exporter):
 * `x`/`y` is the element's top-left corner in page coordinates *before* rotation,
 * and `rotation` (degrees, clockwise) is applied around that top-left origin.
 * This is exactly `transform="translate(x y) rotate(rotation)"` in SVG.
 */
const ElementBaseSchema = z.object({
  id: IdSchema,
  name: z.string().max(LIMITS.maxNameLength).optional(),
  x: CoordinateSchema,
  y: CoordinateSchema,
  width: ElementDimensionSchema,
  height: ElementDimensionSchema,
  rotation: z.number().min(-360).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true),
});

export const RectElementSchema = ElementBaseSchema.extend({
  type: z.literal('rect'),
  fill: FillSchema,
  stroke: StrokeSchema.optional(),
  cornerRadius: z.number().min(0).max(LIMITS.maxElementDimension).default(0),
});

export const EllipseElementSchema = ElementBaseSchema.extend({
  type: z.literal('ellipse'),
  fill: FillSchema,
  stroke: StrokeSchema.optional(),
});

export const FontWeightSchema = z.number().int().min(100).max(900).multipleOf(100);
export const TextAlignSchema = z.enum(['left', 'center', 'right', 'justify']);
export const FontStyleSchema = z.enum(['normal', 'italic']);

export const TextElementSchema = ElementBaseSchema.extend({
  type: z.literal('text'),
  text: z.string().max(LIMITS.maxTextLength),
  fontFamily: z.string().min(1).max(100),
  fontSize: z.number().min(LIMITS.minFontSize).max(LIMITS.maxFontSize),
  fontWeight: FontWeightSchema.default(400),
  fontStyle: FontStyleSchema.default('normal'),
  textAlign: TextAlignSchema.default('left'),
  /** Multiplier of the font size (1.2 = 120%). */
  lineHeight: z.number().min(0.5).max(5).default(1.2),
  /** Additional spacing between characters in pixels. */
  letterSpacing: z.number().min(-100).max(1000).default(0),
  underline: z.boolean().default(false),
  color: HexColorSchema,
});

export const ImageFitSchema = z.enum(['cover', 'fill']);

/**
 * Images reference an asset record (see `ImageAssetSchema`); the bytes themselves live in an
 * asset store, never inside the document JSON.
 */
export const ImageElementSchema = ElementBaseSchema.extend({
  type: z.literal('image'),
  assetId: IdSchema,
  /** `cover` crops to fill the box (default); `fill` stretches to the box. */
  fit: ImageFitSchema.default('cover'),
});

export const ElementSchema = z.discriminatedUnion('type', [
  RectElementSchema,
  EllipseElementSchema,
  TextElementSchema,
  ImageElementSchema,
]);

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

/** Bytes are stored by the application (IndexedDB, cloud) under the asset id. */
export const LocalAssetSourceSchema = z.object({ type: z.literal('local') });

/** Bytes are fetched from a URL (templates shipped with the app, cloud storage). */
export const UrlAssetSourceSchema = z.object({
  type: z.literal('url'),
  url: z.string().min(1).max(LIMITS.maxUrlLength),
});

export const AssetSourceSchema = z.discriminatedUnion('type', [
  LocalAssetSourceSchema,
  UrlAssetSourceSchema,
]);

export const ImageAssetSchema = z.object({
  id: IdSchema,
  kind: z.literal('image'),
  name: z.string().max(LIMITS.maxNameLength).optional(),
  mimeType: z.enum(SUPPORTED_IMAGE_MIME_TYPES),
  width: z.number().int().min(1).max(LIMITS.maxAssetDimension),
  height: z.number().int().min(1).max(LIMITS.maxAssetDimension),
  byteSize: z.number().int().min(0).max(LIMITS.maxAssetBytes).optional(),
  source: AssetSourceSchema,
  createdAt: z.iso.datetime(),
});

export const AssetSchema = ImageAssetSchema;

// ---------------------------------------------------------------------------
// Pages & document
// ---------------------------------------------------------------------------

export const PageSchema = z.object({
  id: IdSchema,
  name: z.string().max(LIMITS.maxNameLength).optional(),
  background: FillSchema.default({ type: 'solid', color: '#ffffff' }),
  /** Z-order is the array order: index 0 is the back-most element. */
  elements: z.array(ElementSchema).max(LIMITS.maxElementsPerPage),
});

export const DocumentSizeSchema = z.object({
  width: CanvasDimensionSchema,
  height: CanvasDimensionSchema,
});

export const DocumentMetadataSchema = z.object({
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  source: z.enum(['blank', 'template', 'ai', 'import']).default('blank'),
  templateId: z.string().max(LIMITS.maxNameLength).optional(),
});

export const DocumentSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    id: IdSchema,
    name: z.string().min(1).max(LIMITS.maxNameLength),
    size: DocumentSizeSchema,
    pages: z.array(PageSchema).min(1).max(LIMITS.maxPages),
    /** Asset records keyed by asset id. Elements reference assets by id. */
    assets: z
      .record(IdSchema, AssetSchema)
      .default({})
      .refine((assets) => Object.keys(assets).length <= LIMITS.maxAssetsPerDocument, {
        message: `A document may reference at most ${LIMITS.maxAssetsPerDocument} assets`,
      })
      .refine((assets) => Object.entries(assets).every(([key, asset]) => key === asset.id), {
        message: 'Asset record keys must match the asset id',
      }),
    metadata: DocumentMetadataSchema,
  })
  .superRefine((doc, ctx) => {
    const pageIds = new Set<string>();
    const elementIds = new Set<string>();
    doc.pages.forEach((page, pageIndex) => {
      if (pageIds.has(page.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['pages', pageIndex, 'id'],
          message: `Duplicate page id "${page.id}"`,
        });
      }
      pageIds.add(page.id);
      page.elements.forEach((element, elementIndex) => {
        if (elementIds.has(element.id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['pages', pageIndex, 'elements', elementIndex, 'id'],
            message: `Duplicate element id "${element.id}"`,
          });
        }
        elementIds.add(element.id);
        if (element.type === 'image' && !(element.assetId in doc.assets)) {
          ctx.addIssue({
            code: 'custom',
            path: ['pages', pageIndex, 'elements', elementIndex, 'assetId'],
            message: `Image references unknown asset "${element.assetId}"`,
          });
        }
      });
    });
  });

// ---------------------------------------------------------------------------
// Inferred types. Output types (after defaults) are the canonical in-memory shapes.
// ---------------------------------------------------------------------------

export type HexColor = z.infer<typeof HexColorSchema>;
export type SolidFill = z.infer<typeof SolidFillSchema>;
export type Fill = z.infer<typeof FillSchema>;
export type Stroke = z.infer<typeof StrokeSchema>;
export type FontWeight = z.infer<typeof FontWeightSchema>;
export type TextAlign = z.infer<typeof TextAlignSchema>;
export type FontStyle = z.infer<typeof FontStyleSchema>;

export type RectElement = z.infer<typeof RectElementSchema>;
export type EllipseElement = z.infer<typeof EllipseElementSchema>;
export type TextElement = z.infer<typeof TextElementSchema>;
export type ImageElement = z.infer<typeof ImageElementSchema>;
export type ImageFit = z.infer<typeof ImageFitSchema>;
export type DesignElement = z.infer<typeof ElementSchema>;
export type ElementType = DesignElement['type'];

export type AssetSource = z.infer<typeof AssetSourceSchema>;
export type ImageAsset = z.infer<typeof ImageAssetSchema>;
export type Asset = z.infer<typeof AssetSchema>;

export type Page = z.infer<typeof PageSchema>;
export type DocumentSize = z.infer<typeof DocumentSizeSchema>;
export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;
export type DesignDocument = z.infer<typeof DocumentSchema>;

/** Input shapes accept omitted fields that have defaults (useful for templates and AI output). */
export type DesignElementInput = z.input<typeof ElementSchema>;
export type DesignDocumentInput = z.input<typeof DocumentSchema>;
