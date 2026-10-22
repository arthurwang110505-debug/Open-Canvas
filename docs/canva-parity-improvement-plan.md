# OpenCanvas → Canva: a working plan

**Version:** 2.0 · **Date:** 2026-10-21 · **Baseline:** `ec56b00` (schema v4, 334 tests)
**Supersedes:** v1 draft dated 2026-10-19 (still in git history). v1 planned work that has since
shipped and under-counted how much of the "Canva feel" is content, not controls.

> **Thesis.** OpenCanvas no longer lacks _editor features_; it lacks _things to put on the page_
> and _the five seconds before the page_. A user can already draw eight shapes, crop, filter,
> group, hold pages, present and export. What they cannot do is open the app, find something
> beautiful, drag a photo and a font into it, and get a print-ready file. That is the gap.

---

## Contents

1. [Verified snapshot](#1-verified-snapshot)
2. [Canva-feel scorecard](#2-canva-feel-scorecard)
3. [Five hard truths](#3-five-hard-truths)
4. [Strategy: four phases](#4-strategy-four-phases)
5. [Phase A — Face and entry](#phase-a--face-and-entry)
6. [Phase B — The library](#phase-b--the-library)
7. [Phase C — Canvas power](#phase-c--canvas-power)
8. [Phase D — Publish and trust](#phase-d--publish-and-trust)
9. [Deep specs (schema, adapter, export)](#9-deep-specs)
10. [Visual and interaction spec](#10-visual-and-interaction-spec)
11. [Quality gates and budgets](#11-quality-gates-and-budgets)
12. [Risks](#12-risks)
13. [Metrics](#13-metrics)
14. [First ten working days](#14-first-ten-working-days)
15. [Explicit non-goals](#15-explicit-non-goals)

---

## 1. Verified snapshot

Audited from source on `ec56b00`, not from the README (which is one milestone behind).

| Surface        | Actually shipped                                                                                                                                                                                                                                     | Source of truth                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Document model | v4 schema; `rect`, `ellipse`, `text`, `image`, `path`, `group`; migrations 1→4                                                                                                                                                                       | `packages/document/src/schema.ts`       |
| Commands       | rename, resize, page add/duplicate/delete/reorder/setBackground, asset register/remove, element add/update/updateMany/delete/duplicate/reorder/group/ungroup                                                                                         | `packages/editor-core/src/commands.ts`  |
| Canvas         | zoom, fit, wheel pan, snapping + alignment guides, page shadow, drag-drop images, freehand draw, text auto-grow                                                                                                                                      | `packages/canvas-fabric/src/adapter.ts` |
| Panels         | Shapes (8), Text (3 presets), Draw, Uploads, Background (solid only), Layers; Properties (X/Y/W/H/R/opacity/aspect lock/fill/stroke/corner radius), image crop/filters/flip, text line-height/letter-spacing/underline                               | `apps/web/src/editor`                   |
| Selection      | floating toolbar: duplicate, lock, hide, arrange, group/ungroup, delete                                                                                                                                                                              | `FloatingToolbar.tsx`                   |
| Projects       | IndexedDB autosave, dashboard grid + search, `.opencanvas` import/export, thumbnails from the SVG renderer                                                                                                                                           | `apps/web/src/projects`                 |
| Templates      | **12** templates across 5 categories, card grid + search, dashboard only                                                                                                                                                                             | `templates/catalog.ts`                  |
| Share          | link stored in **localStorage**, present mode (SVG page flip)                                                                                                                                                                                        | `share/cloud.ts`                        |
| Export         | PNG @2×, SVG, PDF (each page rasterized @2×)                                                                                                                                                                                                         | `packages/export`                       |
| Type           | **15 bundled OFL families** (Inter, Playfair Display, Fraunces, DM Serif Display, Libre Baskerville, Instrument Serif, DM Sans, Manrope, Space Grotesk, Sora, Archivo, Outfit, Bricolage Grotesque, Oswald, Caveat), embedded in SVG/PNG/PDF exports | `apps/web/src/fonts/`                   |
| Tests          | 334 unit/integration (Vitest + jsdom), no E2E                                                                                                                                                                                                        | `*.test.ts(x)`                          |

**What v1 planned that is now done:** template gallery, multi-page, group/ungroup, eight shapes,
corner radius, floating toolbar, aspect lock, image crop (numeric), filters, flip, shape search,
`R/O/T/L/D` shortcuts, dashboard cards, present mode, page strip. Do not re-plan these.

**What v1 planned that is still missing:** icons/photos/illustrations, frames, gradients and image
backgrounds, fonts beyond the OS set, text effects and bullets, copy/paste style, brand kit,
history panel, magic resize, vector-text PDF, in-editor templates, real share.

---

## 2. Canva-feel scorecard

Scored 0–5 against "a first-time user who has used Canva before". Weighted by how much each
surface drives the _impression_ of Canva.

| #   | Surface                  | Weight | Today    | Why                                                                                                                    | Target   |
| --- | ------------------------ | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Entry (home → designing) | 20 %   | 2.5      | Real template grid and thumbnails, but 12 templates, a size `<select>`, no recents/starred, no in-editor templates     | 4.5      |
| 2   | Content library breadth  | 25 %   | 0.5      | 8 primitives. No photos, icons, illustrations, gradients, grids                                                        | 4.0      |
| 3   | Typography               | 15 %   | 1.5      | Arial/Verdana/Times is the visual signature of a non-designer tool; no effects, lists, or font previews                | 4.0      |
| 4   | Canvas affordances       | 20 %   | 2.5      | Snap/align/zoom are good; no frames, no on-canvas crop, no alt-drag, toolbar is pinned to the screen not the selection | 4.0      |
| 5   | Publish quality          | 15 %   | 2.0      | PNG/SVG/raster PDF; no scale, JPEG, transparency, print bleeds; share link is local-only                               | 4.0      |
| 6   | Polish and consistency   | 5 %    | 3.0      | Rounded cards and indigo tokens are in; panels use 10–11 px type and mixed control heights                             | 4.5      |
|     | **Weighted**             | 100 %  | **~1.9** |                                                                                                                        | **~4.2** |

The score is deliberately harsh on #2 and #3 because that is where "this is not Canva" comes
from, and both are _content_ problems that code alone cannot finish.

---

## 3. Five hard truths

1. **The editor is not the bottleneck; the library is.** 25 % of the scorecard is empty. The
   highest-leverage work in this repo is a content pipeline (icons, photos, template blueprints),
   not more reducer commands.
2. **Nobody will find the good features.** Crop, filters, flip, distribute and aspect lock all
   exist and all hide in a 320 px right panel behind numeric fields. Canva's rule is that
   destructive/creative actions live on the selection. Discovery is a feature.
3. **The share dialog currently over-promises.** `share/cloud.ts` writes the document to
   `localStorage`, so "Anyone with the link can view a read-only copy" is false for anyone but
   the author on the same browser. This contradicts the project's own _no fake buttons_
   principle and must be fixed before any growth work.
4. **Fonts are load-bearing and currently a trap.** All 8 families are OS fonts, so SVG text
   export by-name works. The moment we bundle webfonts (`@fontsource`), `renderPageToSvg` will
   emit `font-family="Playfair Display"` with no `@font-face`, and PNG/PDF rasterization through
   an `<img>` will silently fall back — designs will export in the wrong typeface. Font work must
   ship with embedding, or not at all.
5. **Schema changes are cheap here, and that is an asset.** The migration registry, discriminated
   unions and headless exporters mean gradients, icons and frames can be added without a rewrite
   — _if_ each lands as its own migration + adapter + export + fixture. Bundling them into one
   "design system v5" PR would destroy reviewability.

---

## 4. Strategy: four phases

Ordered so each phase is independently demoable and each closes a complete job.

| Phase | Theme             | Duration  | Job it closes                             | Scorecard move             |
| ----- | ----------------- | --------- | ----------------------------------------- | -------------------------- |
| **A** | Face and entry    | 1.5 weeks | "I land and know what to make"            | #1 2.5 → 4.0, #6 3.0 → 4.0 |
| **B** | The library       | 3 weeks   | "I have something beautiful to drag in"   | #2 0.5 → 3.5, #3 1.5 → 4.0 |
| **C** | Canvas power      | 3 weeks   | "The editor does not fight me"            | #4 2.5 → 4.0               |
| **D** | Publish and trust | 2 weeks   | "My file is right and the link is honest" | #5 2.0 → 4.0               |

**Cut line.** If only two weeks exist, ship Phase A + B1/B2 (fonts and icons). That subset alone
changes the product category from "vector toy" to "design tool" in screenshots and in use.

**Shipped so far:** A1–A7 (download menu, canvas-corner zoom, anchored selection toolbar,
type/density pass, dashboard entry with recents + size catalog + sort, in-editor templates,
empty-canvas coaching), B1–B2 (15 bundled OFL families, embedded in every export), B3
(372-icon vector catalogue as a real `icon` element, schema v5) and B4 (one `Elements` panel
searching shapes _and_ icons, drag-to-canvas with a live drop ghost).

Sequence rule: every phase ships _vertically_ — model → reducer → adapter → UI → export → test —
for one feature at a time. No half-migrated element types on `main`.

---

### Phase A — Face and entry

Goal: the product should read as Canva in a screenshot before it gains a single new element type.

| ID  | Change                                                                                                                                                                                                                                                                | Files                                                                                | Done when                                                                                             | Size |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---- |
| A1  | **One primary CTA.** Replace the three top-bar export buttons with a `Download` menu (format · scale · transparent · page range) and make `Share` the primary filled button.                                                                                          | `ExportControls.tsx`, `TopBar.tsx`                                                   | Menu is keyboard-navigable, each item runs the existing exporter; UI tests for the menu               | M    |
| A2  | **Move zoom to the canvas corner.** Zoom % as a popover bottom-right (fit, 50/100/200 %, "fit page", "fit selection"), exactly where Canva puts it. Keep `Ctrl ±` shortcuts.                                                                                          | `TopBar.tsx`, new `ZoomControl.tsx`, `CanvasStage.tsx`                               | Zoom popover works at all zoom levels; top bar shortens by ~140 px                                    | S    |
| A3  | **Anchor the floating toolbar to the selection.** Today it is `left-1/2 top-3` — a screen-level bar. Add `pageToClient()` to the adapter, position the toolbar above the selection bounding box, flip below when near the top edge, hide while dragging/editing text. | `adapter.ts`, `FloatingToolbar.tsx`, `CanvasStage.tsx`                               | Toolbar follows the object within one frame; clamped to the workspace; still fully keyboard reachable | M    |
| A4  | **Type scale and density pass.** Raise panel body text from 10–11 px to 13 px, labels 12 px, section titles 13 px semibold; unify control height to 32 px; increase panel padding 12 → 16 px; make the left rail 72 px with 24 px icons.                              | `packages/ui/src/styles/theme.css`, `Sidebar.tsx`, `PropertiesPanel.tsx`, `panels/*` | axe passes; no panel content clipped at 1280×800; visual diff reviewed                                | M    |
| A5  | **Dashboard: real entry.** Replace the size `<select>` with a horizontal size catalog (searchable, grouped Social/Print/Presentation/Video), add a "Continue editing" hero (three most recent designs) and sort control (recent / name).                              | `Dashboard.tsx`, new `SizeCatalog.tsx`, `storage` list API                           | New project in ≤ 2 clicks; recents reflect `updatedAt`; empty state unchanged                         | M    |
| A6  | **Templates tab inside the editor.** A `Design` tab at the top of the left rail that shows the same gallery and can (a) apply a template to the _current_ page and (b) insert a template as a _new_ page, both undoable, both behind a confirmation.                  | `Sidebar.tsx`, `templates/TemplateGallery.tsx`, `editor/actions.ts`                  | Applying a template is one undo step; inserting a page doesn't disturb existing pages                 | M    |
| A7  | **Empty-canvas coaching.** When a page has zero elements, show a soft ghost prompt (headline + 3 chips: template, add text, upload) that disappears on first insert and never intercepts clicks.                                                                      | `CanvasStage.tsx`                                                                    | Prompt never blocks pointer events; hidden in present mode and for non-empty pages                    | S    |

**Deliberately not in A:** new shapes, new fonts, gradients. A is chrome, entry and honesty.

---

### Phase B — The library

Goal: the left rail becomes an asset library rather than a shape menu. This phase is where the
product stops feeling like a prototype.

| ID  | Change                                                                                                                                                                                                                                                                                                                                                      | Files / packages                                                                                                    | Done when                                                                                             | Size |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---- |
| B1  | **Bundled fonts.** Add 14 OFL families via `@fontsource-variable/*` (display, editorial, geometric, handwritten — e.g. Playfair Display, DM Serif Display, Bricolage Grotesque, Space Grotesk, Manrope, Fraunces, Caveat), lazily loaded with `FontFace` status ("loading/ready") so text never reflows after export.                                       | `apps/web/src/fonts/{catalog,install,embed}.ts`                                                                     | Font list shows per-family previews; 14 families render identically on canvas and in SVG              | L    |
| B2  | **Font embedding in export (blocking for B1).** Inline `@font-face` with base64 WOFF2 in the SVG `<defs><style>` for every family used on the page; fonts are awaited before measuring, and a face that cannot be read fails the export instead of falling back.                                                                                            | `packages/export/src/{fonts,svg}.ts`, `editor/export/*`                                                             | Export a Playfair design → PNG/PDF/SVG pixel-match the canvas (snapshot test with a tiny WOFF2)       | M    |
| B3  | **Icon element.** New `icon` element: `{ iconId, color, strokeWidth }`, rendered from a registry of 24×24 path data (lucide is already a dependency), vector in SVG, recolorable, no asset bytes. Schema v5 + migration.                                                                                                                                    | `document/src/schema.ts`, `factories.ts`, `canvas-fabric/src/mapping.ts`, `export/src/svg.ts`, new `packages/icons` | 300+ icons searchable by name/keyword, insert + recolor + export; migration fixture for v4→v5         | L    |
| B4  | **Elements panel.** Replace the `Shapes` and `Icons` tabs with one `Elements` tab: chips `All · Shapes · Icons` (only libraries that exist — no placeholder chips), one search across both, popular icons first, and drag-to-canvas with a live drop ghost. Dropping places the element at the pointer; clicking centres it.                                | `Sidebar.tsx`, `editor/elements/{ElementsPanel,drag,shapeItems}`, `CanvasStage.tsx`, `actions.ts`                   | Drag from panel to canvas creates the element at the drop point (not page centre); click also inserts | M    |
| B5  | **Photo library.** ✅ Schema v9 adds `source: { type: 'bundled', photoId }`; the library lives in `apps/web/src/assets/photos/` as WebP, is lazy-loaded, searchable by tag and ships with a "see licence" note. Ten photos shipped: enough to prove the pipeline end to end (insert, reuse, project files, export) while the catalogue stays data-driven.   | `packages/document` asset source, `packages/storage` resolver, new `apps/web/src/assets/photos/*`, `ElementsPanel`  | Photo inserts as an image element, exports correctly, licence shown, offline-safe                     | M    |
| B6  | **Template system 12 → 60.** ✅ Split into 13 _blueprints_ (fraction-of-page layouts) + 48 _instances_ (copy, palette, type pairing) while keeping the twelve hand-tuned designs. Each generated template builds a schema-valid document; the gallery builds once per mount and the sidebar browser pages 18 at a time instead of mounting 60 SVG previews. | `templates/{types,kit,blueprints,instances,signature,catalog}.ts`, `TemplateGallery.tsx`                            | 60 templates, each opens, is editable, exports; catalogue tests validate every document               | L    |

B6 shipped without the build-time WebP preview script: documents are built once per gallery mount, so
the dashboard renders 60 SVG thumbnails from memory instead of a binary asset pipeline. If profiling
shows that cost, a preview script can be added later without touching the catalogue.
| B7 | **Text panel upgrade.** ✅ Style presets as visual rows (size + weight + tracking baked in), font pairing presets ("Editorial", "Bold poster", "Soft serif"), bullet and numbered lists, and display casing as a `textTransform` property. Schema v7 (`textTransform`) and v8 (`listStyle`), each with its own migration fixture. Casing and markers are applied by the renderers, so the stored text is never rewritten. | `Sidebar.tsx`, `textPresets.ts`, `PropertiesPanel.tsx`, `canvas-fabric/src/textbox.ts`, `export/src/textLayout.ts`, schema `textTransform` + `listStyle` | Lists render in Fabric (multi-line bullets) and in SVG/PDF; presets are one click and undoable | M |
| B8 | **Backgrounds: gradients and images.** ✅ Extended `Fill` from `solid \| none` to `solid \| linear \| radial \| none` (schema v6) and added 24 curated gradients to a Background panel grid. Image backgrounds are deliberately not shipped: a page-sized image element already covers the case, and it keeps the fill union small. | `document/src/schema.ts`, `canvas-fabric/src/mapping.ts`, `export/src/svg.ts`, `panels/BackgroundPanel.tsx` | Existing documents migrate and render identically; gradient backgrounds export in all three formats | L |

B7 shipped casing as `none · uppercase · lowercase · capitalize`, not true small caps: the bundled
families ship no small-caps face, and synthesizing one (scaled capitals) looks worse than leaving the
option out. Casing is applied before wrapping and list markers after it, so canvas, SVG and PDF agree
line for line without touching the document text; `listStyle` accepts `none · bullet · number`, and
the marker gutter (1.5 em) narrows the wrap width so a bullet never pushes a line out of its box.

B5 shipped with ten photographs rather than the forty to sixty the first draft assumed: every
image here is made for the project and dedicated to CC0, and a smaller curated set that is really
free beats a larger set with an unclear provenance. Adding more is a content change only — drop a
WebP in `apps/web/src/assets/photos/`, add a catalogue entry, run the tests (see
[docs/photos.md](photos.md)). The panel pages tiles lazily, so the library can grow without a
bundling redesign.

Why B3 as a new element rather than SVG assets: an icon that cannot be recolored is a sticker,
not a design element; an icon that is an image asset bloats documents and cannot inherit color.
`icon` keeps the document small, the export vector and the colour live.

---

### Phase C — Canvas power

Goal: remove every moment where the user thinks "in Canva this would take one gesture".

| ID  | Change                                                                                                                                                                                                                    | Files                                                                                         | Done when                                                                                                | Size |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---- |
| C1  | **Frames.** `frame` element (shape + `fit` + child image), rendered as a Fabric `clipPath`; drop an image onto a frame to fill it; drag inside to reposition, handles to crop.                                            | `document` (new element), `canvas-fabric/adapters/frame.ts`, `export/src/svg.ts` (`clipPath`) | Drop photo on a frame → cover-cropped, repositionable, exports with the same crop                        | L    |
| C2  | **On-canvas crop.** Double-click an image → crop mode with darkened outside, 8 handles, aspect presets (1:1, 4:5, 16:9, free), Enter/Escape/click-away to commit or cancel; writes the existing `crop` field.             | `CanvasStage.tsx`, new `canvas/CropOverlay.tsx`, `adapter.ts`                                 | Crop is one gesture and one undo step; numeric fields still work                                         | L    |
| C3  | **Replace and swap images.** `Replace image` in the image panel and context menu (keeps crop, filters, geometry); drag an image onto an existing image to swap it.                                                        | `PropertiesPanel.tsx`, `CanvasStage.tsx`, `assets/useImageImport.ts`                          | Replacing preserves every property except `assetId`; old asset is garbage-collected only if unreferenced | S    |
| C4  | **Quick gestures.** Alt-drag duplicates; `Ctrl/⌘ + drag` copies style; double-click text enters edit and selects the word under the cursor; arrow-key nudge path already exists; `Shift` while resizing preserves aspect. | `adapter.ts`, `useKeyboardShortcuts.ts`                                                       | Verified by jsdom/unit tests where possible and manual checklist                                         | M    |
| C5  | **Copy/paste style and eyedropper.** A `styleClipboard` in the editor store (fill, stroke, corner radius, typography, effects); `Ctrl Alt C/V`; `EyeDropper` API for fill and text colour with hex fallback.              | `EditorProvider.tsx`, `actions.ts`, `useKeyboardShortcuts.ts`                                 | Paste style across element types applies only compatible fields, one undo step                           | S    |
| C6  | **Rulers, margins and gap guides.** Optional rulers along the workspace edges with pointer tick marks, draggable margin/bleed guides stored per page (non-exporting), and gap snapping between elements during drag.      | `CanvasStage.tsx`, `canvas/Rulers.tsx`, `adapter.ts` guides                                   | Toggleable, persists per document, excluded from export and present mode                                 | L    |
| C7  | **Brand kit (local).** Up to 5 palettes and 3 font pairs saved in IndexedDB; applies to selection or whole page in one undo step; "extract palette from image" using a 5-colour median cut.                               | new `apps/web/src/brand/*`, `packages/storage/src/brandStore.ts`, `panels/BrandPanel.tsx`     | Palette application recolours shapes/text coherently and is undoable in one step                         | M    |
| C8  | **Magic resize v1.** Resize document to another preset with a confirmation preview; heuristic repositioning (scale relative anchors, keep text sizes within ±15 %) plus a non-destructive "original size" undo entry.     | `editor-core/src/resizeLayout.ts`, `TopBar.tsx` / `ShareDialog`                               | 1080×1080 → 1080×1920 produces a sane layout on 8 sample docs; always undoable                           | L    |
| C9  | **History panel.** Scrub through undo stack with labels derived from command types; clicking a state restores it without discarding the future.                                                                           | `editor-core/src/store.ts` (labels), `panels/HistoryPanel.tsx`                                | Labels are human ("Moved rectangle", "Changed font"); no document drift                                  | M    |

C1 and C2 are the two features users will describe as "now it's an editor".

---

### Phase D — Publish and trust

| ID  | Change                                                                                                                                                                                                                                        | Files                                              | Done when                                                                               | Size |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- | ---- |
| D1  | **Honest share, option 1 (default).** Rename to `Open on this device` / `Copy view link`, state plainly that the link works in this browser only, and surface `.opencanvas` export as the way to move designs. Remove "anyone with the link". | `ShareDialog.tsx`, `share/cloud.ts`                | Copy matches reality; test asserts no cross-origin claim                                | S    |
| D2  | **Honest share, option 2 (self-hosted).** Add a tiny optional `apps/api` route that stores a document + assets and returns `/s/:id`; only enabled when configured (`VITE_SHARE_ENDPOINT`), otherwise UI stays in D1 mode.                     | new `apps/api`, `share/cloud.ts`                   | Share works across browsers when configured; local mode still truthful                  | L    |
| D3  | **Export matrix.** Format (PNG · JPEG · WebP · SVG · PDF), scale (1×/2×/3×/custom), transparent background, page range, and "PDF (print)" with 3 mm bleed + crop marks for print presets.                                                     | `ExportControls.tsx`, `export/*`                   | Every option is real and covered by a headless test; download names carry size and page | M    |
| D4  | **Vector text PDF.** Embed the used WOFF2 subsets in the PDF and draw text as text; raster fallback only for filters.                                                                                                                         | `export/src/pdf.ts`, new `export/src/fontEmbed.ts` | Text is selectable in the PDF; A4 poster at 100 % is sharp                              | L    |
| D5  | **Copy image to clipboard** (PNG @2×) alongside download, plus "Copy as SVG" for pasting into other tools.                                                                                                                                    | `useDesignExport.ts`                               | Works in Chromium/Firefox with `ClipboardItem`; graceful message otherwise              | S    |
| D6  | **Present polish.** Fullscreen, page counter, arrow/space navigation (exists), plus "present from current page" and a black/white backdrop toggle; no editing chrome leaking in.                                                              | `PresentMode.tsx`                                  | Escape exits and restores focus to the canvas                                           | S    |

D1 is non-negotiable and can ship on day one; it is a 30-line honesty fix with a test.

---

## 9. Deep specs

### 9.1 Schema roadmap (v4 → v6)

| Version | Adds                                                             | Migration                                                                                                     | Touches                                                              |
| ------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| v5      | `icon` element                                                   | identity + defaults (`color: '#111827'`, `strokeWidth: 2`)                                                    | schema, factories, adapter mapping, SVG, PDF raster, fixtures        |
| v6      | `Fill` = solid + linear + radial + image; `bundled` asset source | normalise existing `{type:'solid'}` untouched; add `source.type === 'bundled'` default `'url'` for old assets | schema, mapping, SVG gradients, BackgroundPanel, template blueprints |

Rules:

- One element/property family per version. Every bump ships a `migrations.test.ts` fixture pair
  (old JSON → new JSON) and an `export` golden.
- Renderers must be total: a v6 document opened by a v5 build is rejected by version check, not
  rendered partially.
- `Fill` stays a discriminated union; no optional-everything bag.

### 9.2 The `icon` element

```ts
// packages/document/src/schema.ts
export const IconElementSchema = ElementBaseSchema.extend({
  type: z.literal('icon'),
  iconId: z.string().min(1).max(64), // key in @opencanvas/icons
  color: HexColorSchema.default('#111827'),
  strokeWidth: z.number().min(0.5).max(6).default(2),
});
```

- `packages/icons` exports `ICONS: Record<string, { paths: string[]; keywords: string[] }>` derived
  from lucide's SVG data, tree-shakeable and zipped into a ~60 KB gz chunk.
- Fabric renders a `Group` of `Path`s with `stroke = color`, `fill = 'none'`, scaled from a 24×24
  viewBox; hit-testing and resize work through the existing mapping.
- SVG export writes `<g transform …>` + `<path d=…>`; no rasterization, no network.
- Search happens in the panel over `keywords`, not over 300 DOM nodes.

### 9.3 Frames without a new geometry system

Reuse `rect` geometry: `frame` is `{ ...rect, type:'frame', fit:'cover'|'fill', assetId? }`.
The adapter adds the frame as a Fabric `Rect` with `clipPath` and an internal `Image`. Export
emits `<clipPath id>` + `<image>`. No nested transforms, no new coordinate space — which is where
Fabric group bugs live.

### 9.4 Fonts and export (the landmine)

```
registry (family → url, weights) ──► FontFace load on demand ──► canvas reflow
                                    └──► export: base64 @font-face in <defs><style>
```

- Only load a family when it is chosen or present in the document (parse the model on open).
- SVG export inlines only the families and weights the page uses; Inter + Playfair is ~110 KB,
  which is acceptable for a self-contained design file.
- PDF exports a raster page rendered from that same SVG, so its text uses the embedded bytes;
  vector-text PDF (jsPDF `addFileToVFS` / `addFont`) remains a Phase D option.
- Snapshot test: a one-glyph document with a tiny test WOFF2 must produce an SVG containing
  `@font-face` and a PNG whose glyph bounding box differs from the fallback.

### 9.5 Magic resize heuristic (C8)

1. Compute anchor deltas: each element keeps its proportional centre and its distance to the
   nearest page edge as a ratio.
2. Text keeps font size unless it would overflow the new width by > 20 %, then scales down to fit.
3. Images keep aspect and may grow, never squash; frames scale to page ratio.
4. Show a before/after preview; the whole operation is one `document.resize` + `element.updateMany`
   pair inside a single history step.

---

## 10. Visual and interaction spec

Canva reads as Canva because of a small number of consistent decisions. Adopt them literally.

**Chrome**

- Top bar 52 px, white, one 1 px bottom border, brand mark left, document name centred-left,
  `Share` primary pill right, `Download` secondary right.
- Left rail 72 px, icon 24 px over an 11 px label, active state = filled dark pill (not purple).
- Panel 360 px, section headers 13 px semibold with 16 px padding, collapsible with remembered state.
- Canvas workspace `#f2f3f5`, page shadow already implemented, 32 px minimum gutter, zoom bottom-right.
- Selection toolbar floats above the object, 36 px tall, pill, 6 px gap from the bounding box.

**Type**

- UI: 13 px body / 12 px labels / 20 px page titles / Inter only.
- Canvas defaults: heading 64 px bold, subheading 32 px semibold, body 18 px — with tracking
  `-0.02em` on headings (this single detail is most of "Canva typography looks better").
- Presets ship as complete styles (family + size + weight + line height + tracking + colour),
  not as three naked buttons.

**Colour**

- Keep `--color-primary: #7a5cf9` for focus and primary actions; introduce a neutral ramp
  (`#111827`, `#374151`, `#6b7280`, `#e5e7eb`, `#f9fafb`) and use violet only for accent.
  Today violet is used for the active shape card, the tip card, and primary CTAs — reducing it
  increases perceived polish.

**Motion**

- 120 ms ease-out for panel/toolbar appearance, 180 ms for dialogs, no bounce; respect
  `prefers-reduced-motion` (currently unused).

**States**

- Every async action has loading, empty, error and retry states (the dashboard already models
  this well — replicate its pattern in panels).

---

## 11. Quality gates and budgets

| Gate          | Rule                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tests         | Each phase adds: model unit tests, one adapter reconciliation test, one export golden, one jsdom integration test. Target +120 tests by end of D |
| E2E           | Playwright project added in Phase A: `home → template → edit → download`, `upload → frame → export`, `share copy`                                |
| Perf          | First meaningful editor paint < 1.5 s on a mid laptop; 60 fps drag with 200 elements; template catalog < 200 KB gz; icon chunk lazy              |
| A11y          | `eslint-plugin-jsx-a11y`, axe smoke on dashboard/editor, every icon-only button labelled, focus visible, panels reachable by keyboard            |
| Bundle        | Panel/template/icon code split; no template payload in the editor entry chunk                                                                    |
| Reviewability | ≤ 400 changed lines per PR (excluding fixtures/generated data), one vertical slice                                                               |

---

## 12. Risks

| Risk                                                                       | Likelihood | Impact | Mitigation                                                                                                                      |
| -------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Font licensing or weight                                                   | Medium     | High   | OFL/Apache only, pinned `@fontsource`, licence file per family, subset + `font-display: swap`                                   |
| Template quality problem (60 mediocre designs are worse than 12 good ones) | High       | High   | Blueprints reviewed as a contact sheet before instancing; ship 8 per collection, not 60 at once                                 |
| `Fill` union breaks every renderer                                         | Medium     | High   | One PR per renderer with golden tests; migration is identity by design; feature flag `gradients` until all three exporters pass |
| Icon element inflates document size                                        | Low        | Medium | Store id + colour only; cap `maxIconsPerPage`; registry is app code, not document data                                          |
| Fabric clipPath frames regress selection                                   | Medium     | High   | Frame adapter is isolated with its own tests; fallback is mask-as-image-crop (already exists)                                   |
| Users mistake D1 local share for real sharing                              | Low        | Medium | Explicit copy + `.opencanvas` path in the same dialog                                                                           |
| Scope creep (video, AI, marketplace)                                       | High       | High   | Section 15 is a decision record; features there need a new plan, not a PR                                                       |

---

## 13. Metrics

Instrument locally (no telemetry by default): a dev-only counter module, plus manual benchmarks.

- **Time to first export** for a new user following the template path: target < 3 min.
- **Template usage**: % of new projects started from a template (target > 50 %).
- **Asset inserts per design** (icons + photos): target ≥ 3 — this is the proxy for "library
  depth is working".
- **Export format mix**: PDF share rising after D3/D4 (print-ready is why people pick Canva).
- **Abandonment in the editor**: sessions ending with 0 edits (target < 15 %).
- **Scorecard re-score** after each phase by the same rubric in §2.

---

## 14. First ten working days

Ordered, each item shippable on its own.

1. `D1` honest share copy + test (0.5 day) — removes a false claim immediately.
2. `A1` download menu (1 day) — the top bar starts looking like a product.
3. `A2` zoom to canvas corner (0.5 day).
4. `A4` type/density pass (1.5 days) — highest visual return per line of CSS.
5. `A3` toolbar anchored to selection (1.5 days) — the single strongest "feels like Canva" cue.
6. `A5` dashboard size catalog + continue-editing hero (2 days).
7. `A7` empty-canvas coaching (0.5 day).
8. `B1` + `B2` first four fonts **with** embedding (2 days) — proves the export path before scaling to 14.
9. `B3` icon element schema + migration + 40 icons end-to-end (2 days) — proves the library path.

At the end of day ten the app should be screenshot-competitive with Canva on the editor screen and
already export a design in a font that is not Arial.

---

## 15. Explicit non-goals

Written down so they do not leak into PRs:

- **Video editor, audio, animation timeline.** Different product surface; needs a media engine.
- **Real-time multiplayer and comments.** Commands are already serializable; do this after D2
  introduces a server, not before.
- **Canva's AI suite.** Optional assistive generation can arrive as a later, key-gated milestone;
  it is not what makes the product feel like Canva.
- **App marketplace / plugin SDK.** Premature before the document model stabilises at v6.
- **Print fulfilment, stock subscriptions, social auto-publishing.** Business lines, not features.
- **A pixel-perfect visual clone.** OpenCanvas keeps its indigo accent and its own brand voice;
  "Canva-like" here means interaction grammar, content density and export confidence.

---

_Decision rule for every future proposal: does it increase the number of good things a user can
put on a page, or reduce the number of gestures needed to make them look right? If neither, it is
not Canva parity — it is backlog._
