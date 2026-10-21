# OpenCanvas → Canva Parity: Improvement Plan

**Date:** 2026-10-19  
**Status:** Proposal for Milestones 3–8 (post Projects & Export)  
**Author:** Agent (arena/aa9a8dea)  
**Goal:** Make OpenCanvas feel and function like Canva.com for 80% of solo-creator jobs — while staying local-first, open-source, and self-hostable.

> **One-sentence vision:** *Canva’s polish with OpenCanvas’s principles.* Templates you can browse in seconds, a drag-anything editor that never fights you, one-click brand styles, and exports that just work — all without requiring an account or cloud.

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Where We Are vs. Canva](#2-where-we-are-vs-canva)
3. [What "More Like Canva" Means (and Doesn't)](#3-what-more-like-canva-means-and-doesnt)
4. [Gap Inventory — P0 / P1 / P2](#4-gap-inventory--p0--p1--p2)
5. [Seven Pillars to Close the Gap](#5-seven-pillars-to-close-the-gap)
6. [Phased Roadmap (Milestones 4–8)](#6-phased-roadmap-milestones-48)
7. [Detailed Feature Specs (Acceptance Criteria)](#7-detailed-feature-specs-acceptance-criteria)
8. [IA & UX Redesign: Make It Feel Like Canva](#8-ia--ux-redesign-make-it-feel-like-canva)
9. [Data Model & API Changes](#9-data-model--api-changes)
10. [Engineering Plan by Package](#10-engineering-plan-by-package)
11. [Brand, Templates & Content Strategy](#11-brand-templates--content-strategy)
12. [Quality, A11y & Performance Targets](#12-quality-a11y--performance-targets)
13. [Metrics & Validation](#13-metrics--validation)
14. [Risks & Mitigations](#14-risks--mitigations)
15. [Quick Wins: First 2 Weeks](#15-quick-wins-first-2-weeks)
16. [Appendix A: Canva Jobs-To-Be-Done Map](#appendix-a-canva-jobs-to-be-done-map)
17. [Appendix B: Proposed File Tree Additions](#appendix-b-proposed-file-tree-additions)
18. [Appendix C: Out-of-Scope / Later](#appendix-c-out-of-scope--later)

---

## 1. Executive Summary

OpenCanvas today is a **solid M3 private beta**: local-first persistence, clean document model, pure reducer + undo/redo, Fabric.js adapter, PNG/SVG/PDF export, dashboard with `.opencanvas` portability. It proves the architecture.

Canva wins because **everything is 1 click away**: thousands of searchable templates, a left rail that is an *inspiration & asset library*, freeform drag from anywhere, precise alignment tools, typography that photographs well, and instant resize/export/share. The editor feels *soft, spacious, and forgiving*.

To reach Canva-likeness we propose **7 pillars** and **5 new milestones (4–8)** over ~2 quarters of focused work:

| Pillar | Canva expectation | OpenCanvas today | Target after M8 |
|--------|-------------------|------------------|-----------------|
| **Discovery** | Searchable template gallery, categories, recents | Dashboard list only | Full template gallery + search + categories, 100+ open-licensed templates |
| **Canvas & Layout** | Multi-page, rulers, guides, grouping, frames, grids | Single page, align/distribute, snap toggle | Multi-page + groups + frames + rulers + smart guides |
| **Elements** | Shapes, lines, icons (40k+), illustrations, photos, charts, tables | 3 shapes | 20+ shapes/lines + icon library (Lucide/Phosphor) + frames & grids |
| **Typography** | 1000+ fonts, text effects, curved text, font pairing | 8 system fonts, basic styles | 30+ bundled/display fonts, Google Fonts opt-in, text effects v1 |
| **Media** | Filters, adjust, crop, BG remover, replace | cover/fill only | Crop, flip, opacity, filters (brightness/contrast/saturate), replace |
| **Workflow** | Resize, copy styles, position panel, style guide | Background color only | Canvas resize + magic resize v1, eyedropper, copy style, background images/gradients |
| **Collaboration & Publish** | Share links, comments, present, social direct-publish | Download PNG/SVG/PDF + .opencanvas | Share via link (self-hosted), present mode, direct social sizes |

**Principle-preserving choices:**
- Templates & stock remain **locally bundled** (no mandatory cloud). Optional URL assets already exist.
- AI (Milestone 4 in current roadmap) becomes *assistive*, not required — Magic-like features unlock only if user provides a key.
- Every new element type remains **document-model-first** with Zod validation, migrations, and headless export tests — same discipline that makes M1-M3 reviewable.

---

## 2. Where We Are vs. Canva

### Current strengths to keep
- **Architecture is right:** `document → editor-core → canvas-fabric → storage/export` is clean; it will scale to groups/frames without rewrite.
- **Undo/redo + merge keys:** Already Canva-grade for text/position edits.
- **Export from model, not screenshot:** Guarantees WYSIWYG and enables headless testing — Canva does the same server-side.
- **Local-first with Dexie + .opencanvas ZIP:** More portable than Canva’s walled garden.

### Current gaps that break the Canva feeling

| Surface | What Canva does | OpenCanvas does today |
|---------|----------------|-----------------------|
| **Home** | Visual grid of template previews by use-case (Instagram, Poster, Presentation), search bar, "Recently edited", "Starred" | Text list, size preset dropdown only |
| **Left rail** | Tall icon rail → expanding panel: Design (templates), Elements (shapes/icons/photos), Text (presets + font combos), Brand, Uploads, Draw, Projects | 5 tabs: Shapes (3 buttons), Text (3 buttons), Uploads, Background (20 swatches), Layers |
| **Canvas** | Infinite pan, zoom with preview thumbnails, rulers, margins, snap to center/edges/gaps, distribute evenly | Fixed centered page, zoom/fit, snap to objects/page only |
| **Selection** | Floating toolbar near selection: duplicate, lock, position, transparency, more | No floating toolbar; all in right panel. No position numeric fields always visible |
| **Text** | Huge typographic range: headings with effects, curved, list/bullets, spacing controls, font discovery | 3 presets, 5 weights, 4 alignments, no bullets/lists, no effects |
| **Images** | Search Unsplash/Pexels, filters, adjust sliders, crop to shape/frame, background remover | Upload & drag-to-canvas only; cover/fill; no crop/replace/flip |
| **Layers** | Groups, frames, pages, lock/hide, search, show outline | Flat list, reorder/hide/lock/rename |
| **Share** | Share button → link, download, print, present, schedule | Export buttons in top bar: PNG/SVG/PDF |
| **Feel** | Rounded 16px cards, soft shadows, large previews, generous whitespace, purple brand | Sharp borders, dense controls, gray workspace, small click targets |

**Bottom line:** Functionally ~15% of Canva’s solo-creator surface; affectively ~30% (clean but utilitarian).

---

## 3. What "More Like Canva" Means (and Doesn't)

**Means:**
1. **Template-first creation.** User lands → sees *what to make* (not blank canvas dimensions). Creating from template is the happy path.
2. **Everything draggable.** From left panel → canvas, canvas → canvas, uploads → canvas, with live preview and snap.
3. **Style, not just properties.** Brand colors/fonts applied in one click; styles copy-paste across elements.
4. **Forgiving precision.** Smart guides, distribute, tidy-up, position panel with X/Y/W/H + rotation, lock aspect ratio.
5. **Export confidence.** What you see is what you get for PDF/PNG/SVG, with correct fonts and print-ready bleeds.

**Doesn't mean (v1):**
- Rebuilding Canva’s 40k icon library, video timeline, or Magic Studio AI suite.
- Real-time multiplayer cursors on day one (keep document commands serializable for future).
- Pixel-perfect Canva clone — OpenCanvas keeps its own brand (indigo, Inter, open-source voice).

**Non-negotiables carried forward:**
- Local-first; no login to start designing.
- Document JSON is source of truth; Fabric is adapter.
- No fake buttons — shipped controls are real and tested.

---

## 4. Gap Inventory — P0 / P1 / P2

### P0 — Must have to *feel* like Canva (ship in M4–M5)
- Template gallery + search + categories + preview on hover
- Multi-page support (add/duplicate/delete/reorder pages + page thumbnails in bottom strip)
- Group / Ungroup (with nested transforms)
- More primitives: **Line, Triangle, Star, Rounded star, Arrow, Blob** + stroke controls + corner radius
- Icon library (Lucide already installed → expose as searchable Elements)
- Frames (image-in-shape) + Grids (2–6 cell layouts)
- Image: **crop (contain + manual crop rect), flip H/V, replace, opacity**
- Text: **bulleted list, line height/letter spacing live preview, 20+ fonts, text box auto-grow**
- Background: **image & gradient**, not just solid
- Position panel: X/Y/W/H/R + lock aspect + center on page
- Floating contextual toolbar (duplicate/delete/lock/position/more)
- Dashboard visual refresh: card grid with thumbnails (rasterized SVG previews)
- Canvas chrome: rulers (optional), page shadow, checkerboard behind transparent, centered with padding
- Copy style / Paste style (Format painter)

### P1 — Strongly expected (ship in M6)
- Text effects v1: **Shadow, Lift, Hollow, Background** (SVG filters, no rasterization needed)
- Image Adjust: **brightness, contrast, saturate, blur** (CSS filters → export via SVG filter)
- Brand Kit panel: 3 palettes + 3 font pairs saved locally
- History panel (visual timeline scrub)
- Keyboard: T for text, R for rect, L for line, Cmd+G/U for group
- Search inside Elements (shapes/icons) with instant filter
- Resize (Magic Resize v1: single click to convert 1080×1080 → 1080×1920 with re-centering)
- Present mode (full-screen page flip)
- PDF: vector text (not raster) when fonts are embedded/standard

### P2 — Delight & differentiation (M7–M8)
- Curved text, text on path
- Charts & Tables (simple bar/pie/table elements backed by data array)
- Draw (freehand pen → path element)
- Background remover (local WASM or user-provided key, clearly disclosed)
- Comments (local) + share link generation for self-hosted `apps/api`
- Template contribution workflow (PR a JSON + preview PNG)
- Animations (fade/slide) for Present, exported as MP4 via canvas capture
- Real-time collaboration (commands over WebSocket, OT/CRDT)

---

## 5. Seven Pillars to Close the Gap

### Pillar 1 — Discovery (Dashboard → Studio Home)
Transform `#/` from file manager into **home**: search bar at top, category chips (For You, Social, Posters, Presentations, Videos, Print, Brand), template grid, recents. Dashboard as “Projects” becomes one tab in home.

### Pillar 2 — Canvas & Layout
- Multi-page doc (already in schema: `pages[]` with limit 100, but UI only shows active page). Add **Pages strip** (bottom or left) + page thumbnail renderer.
- **Group**: new `group` element containing children with relative coords (see §9).
- **Frame**: shape element that clips its single image child.
- **Grid**: convenience → creates frames in layout; stored as group of frames.
- **Guides**: center, edge, equal-gap, and margin guides (Canva’s “Tidy up”).

### Pillar 3 — Elements Library
Leverage `lucide-react` (already dep) → searchable icon grid with style filters (outline/filled). Add line/arrow (end caps), triangle/star/polygon via `path` data; keep schema simple.

### Pillar 4 — Typography System
- Bundle **Inter + 10 display fonts** (Be Vietnam, DM Sans, Playfair, Montserrat, etc. via `@fontsource`) + allow Google Fonts opt-in (user pastes URL, stored locally, disclosed).
- Font loading state (`document.fonts.ready` + placeholder metrics).
- Effects as SVG filters + extra rects (background), fully exportable.

### Pillar 5 — Media Editing
Stay on `<image>` element; add `crop` rect + `adjust` bag. Export respects both (SVG `clipPath` + `filter`). No canvas pixel editing needed for v1.

### Pillar 6 — Workflow & Productivity
- Eyedropper (`EyeDropper` API fallback to canvas sampling), Copy style (`format painter` = patch without geometry).
- Resize: `document.resize` already exists — build UI: “Resize” button → choose preset → choose “Copy & resize” vs “Resize this design” + reflow.

### Pillar 7 — Publish & Share
- Present: reuse canvas adapter in fullscreen, page navigation with arrow keys.
- Export: add **JPG** (existing raster path + quality slider), **PDF Print** (bleed + crop marks), social presets.
- Self-host path: `apps/api` share links (M5 Cloud milestone) — document stored server-side, read-only view link.

---

## 6. Phased Roadmap (Milestones 4–8)

> Each milestone is ≤ 400 lines + tests, consistent with prior PR size. Names map to existing roadmap but expand scope.

### Milestone 4 — **Canvas & Structure** (4–5 weeks)
*Make multi-page & grouped layouts possible.*

| Deliverable | Packages touched | Acceptance |
|-------------|----------------|------------|
| Multi-page UI: page strip, add/duplicate/delete/reorder, keyboard PgUp/PgDn | `apps/web`, `document`, `editor-core` | Create 3-page doc, reorder via drag, export PDF renders 3 pages |
| Group/Ungroup: schema + reducer + Fabric group handling | `document`, `editor-core`, `canvas-fabric` | Group 3 shapes → move as one → ungroup → undo restores |
| New primitives: line, triangle, star, arrow (with stroke/endpoint) | `document`, `editor-core`, `canvas-fabric`, `export` | Each inserts centered, appears in Layers as its type, exports to SVG path |
| Position panel v2: X/Y/W/H/R + aspect lock + "Center horizontally/vertically" | `apps/web` | Typing X=100 moves element; lock keeps W/H ratio |
| Rulers + page shadow + workspace padding | `apps/web`, `canvas-fabric` | Toggling rulers doesn't break snap; shadow visible at 100% zoom |

**Exit gate:** Playwright: create group, duplicate page, export PDF has N pages.

### Milestone 5 — **Discovery & Polish** (4 weeks)
*Make it browsable and beautiful.*

| Deliverable | Acceptance |
|-------------|------------|
| Template gallery: `/templates` registry (JSON), search, category filter, preview modal | ≥ 30 templates (originals, CC0-licensed placeholders noted), search "instagram" returns correct presets |
| Dashboard grid: card with thumbnail (SVG → data URL rasterized in worker) | Thumbnails match canvas at 240px wide |
| Left rail redesign: icon rail + search bar inside each panel (Canva layout) | Tab switch preserves scroll; keyboard nav works |
| Visual refresh: theme.css tokens → softer radii (12px), card shadows, larger click targets (40px min) | Lighthouse a11y ≥ 95, no layout shift |
| Background: image upload + gradient editor | Gradient exports to SVG `<linearGradient>` |

**Exit gate:** New user can go Home → search "poster" → click template → edit within 10s.

### Milestone 6 — **Text & Media Power** (4–5 weeks)
*Close the creator loop.*

| Deliverable | Acceptance |
|-------------|------------|
| Typography v2: 25 fonts, font picker with preview, bullets/numbered lists, line height UI | Text with bullets exports as multiple `<tspan>`; font loads before export |
| Text effects v1: shadow, hollow, lift, background | Each effect renders in canvas + SVG export (filter/shadow) |
| Image v2: crop UI (handles + contain), flip, replace, opacity slider | Crop rect stored, exported via `<clipPath>`, undoable |
| Adjust: brightness/contrast/saturate/blur sliders | CSS filter on canvas + SVG `<filter>` on export |
| Floating toolbar (selection context) + eyedropper + copy/paste style | Toolbar appears near selection; copy style copies fill/stroke/typography |

**Exit gate:** Edit text → apply lift effect → export PNG shows effect; crop image → export SVG clipped.

### Milestone 7 — **Brand & Publish** (3–4 weeks)
*For repeat creators.*

| Deliverable | Acceptance |
|-------------|------------|
| Brand Kit: save palettes (5 colors) + font pairs locally, apply to page | Applying palette recolors fills/text that match old palette (opt-in) |
| History timeline panel + named versions (snapshot) | Scrub shows preview; restore prompts confirm |
| Magic Resize v1: convert canvas size with anchor options (center/stretch) | 1080×1080 → 1920×1080 keeps content centered |
| Present mode + share preview | Present runs fullscreen, arrow keys flip pages |
| Export JPG + PDF Print (bleed/marks) | JPG quality 80/90/100 slider; PDF vector text for standard fonts |

### Milestone 8 — **Extensibility & Community** (ongoing)
| Deliverable | Notes |
|-------------|-------|
| Plugin surface: `packages/ai-core` provider abstraction + template contribution guide | AI edits go through commands, preview & confirm |
| `apps/api` sharing: auth, project sync, public view link | Self-hosted; AGPL-compliant |
| Playwright E2E + perf budgets | LCP < 2.5s, canvas FPS ≥ 55 on 1080p |

---

## 7. Detailed Feature Specs (Acceptance Criteria)

### 7.1 Multi-Page
- **Command:** `page.add { afterId?, preset? }`, `page.delete { pageId }`, `page.reorder { pageId, toIndex }`, `page.duplicate { pageId }`
- **UI:** Horizontal strip below canvas with numbered thumbnails (active has ring). Add button at end + between pages on hover. Right-click menu: Duplicate, Delete (confirm if last page), Copy to new design.
- **Export:** `renderDocumentToPdf` already iterates pages; ensure thumbnails reuse same rasterizer path (shared `createThumbnailRenderer`).
- **Tests:** 3 pages → delete middle → pageCount 2, active clamps; undo restores.

### 7.2 Group / Ungroup
- **Schema:** `GroupElement { type:'group', children: DesignElement[], x,y,width,height, rotation, ... }` — children coords **relative to group origin**. Group bounds = union of children AABBs (via `geometry.ts`).
- **Reducer:** `group { elementIds }` creates group at insertion index = max(selected indices)+1, removes originals; `ungroup { groupId }` explodes children to page with absolute coords.
- **Adapter:** Fabric `Group` with `interactive` children; `onElementsModified` reports group transform → reducer decomposes into child updates (or single group patch for move).
- **Naming:** Auto “Group of 3” → renameable.

### 7.3 Primitives
| Type | Schema fields | Canvas mapping | SVG |
|------|---------------|----------------|-----|
| `line` | `x,y,x2,y2`, `stroke`, `strokeWidth`, `endCap:'none'|'arrow'` | `fabric.Line` | `<line>` + optional `<marker>` |
| `path` (star/triangle/arrow) | `pathData:string` (SVG d), `fill`, `stroke`, `strokeWidth` | `fabric.Path` | `<path d>` |
| `rect` existing | add `strokeWidth` already via `Stroke.width` | — | — |

Seed with factories `createLineElement`, `createStarElement(n=5)`, etc.

### 7.4 Frames & Grids
- Frame = `frame` element `{ shape:'rect'|'ellipse'|'path', clipPathData?, image: ImageElement | null, fit:'cover'|'contain' }` OR simpler: `image` with `clipShape` + `clipRadius`. Prefer composition: `frame` wraps one `image`.
- Grids = preset groups of frames (2×1, 1×2, 2×2, 3×1…) inserted as group.
- Export: frame → `<g clipPath>` containing `<image>`.

### 7.5 Position Panel & Floating Toolbar
- **Position panel** (right, collapsible): fields X, Y, W, H (NumberField, 0.5px precision), R (slider + number), aspect lock toggle, buttons: Center H/V, Flip H/V.
- **Floating toolbar**: appears above selection bounding box (or below if near top). Buttons: duplicate, delete, lock, layer (bring forward/back), copy style, more (group, position, transparency). Uses `useFloating`-style absolute positioning via controller → page → viewport math.

### 7.6 Typography v2
- Fonts: bundle 12 via `@fontsource/*`: Inter, DM Sans, Manrope, Playfair Display, Bebas Neue, Montserrat, Lora, Poppins, Space Grotesk, JetBrains Mono, Caveat, Anton.
- Picker: search + category chips (Sans/Serif/Display/Handwriting/Mono) + preview sentence “The quick brown fox...”.
- Lists: `text.listStyle: 'none'|'bullet'|'numbered'` + `listIndent`. Export: bullets as `• ` prefix + `<tspan>` per line with indent.
- Effects: `text.effect?: { type:'shadow'|'lift'|'hollow'|'background', color?, offsetX?, offsetY?, blur? }`. Implement as SVG filter: shadow = `<feDropShadow>`, hollow = `fill:none stroke`, lift = offset duplicate.

### 7.7 Image Editing v2
- `ImageElement` additions: `crop?: { x,y,width,height }` (unit rect 0..1), `flipX?:boolean`, `flipY?:boolean`, `opacity` already via base `opacity`, `adjust?: { brightness%, contrast%, saturate%, blurPx }`.
- UI: crop mode toggle → Fabric `crop` rect handles; Flip buttons; Replace → file picker + re-import same asset id pattern.
- Export: `crop` → `clipPath` rect in element-local coords; `adjust` → `<filter>` with `feComponentTransfer`/`feGaussianBlur`.

### 7.8 Brand Kit (Local)
- Storage: new Dexie table `brandKits` or single doc key `localBrand`.
- Data: `{ palettes: {id,name,colors:HexColor[5]}[], fontPairs: {id, headingFont, bodyFont}[], logos: assetId[] }`.
- UI: Brand tab in left rail → palette swatches (click applies to current page: replace fills matching old brand colors), font pair apply (heading/body detection via fontSize threshold).

### 7.9 Template Registry
- File: `apps/web/src/templates/registry.ts` + `templates/*.json` (canonical `DesignDocumentInput` with `source:'template'`).
- Each template: `id, name, category, tags[], preview: { width,height, dataUrl }` (generated at build via `scripts/generate-previews.mjs` → SVG raster).
- Search: simple tokenized `name + tags` filter (Fuse.js optional, ~5kb). No backend search needed for 100 templates.
- On create from template: `createProjectFromTemplate(store, templateId)` clones document with new ids via `createBlankDocument` + element id regeneration.

### 7.10 Magic Resize v1
- UI: TopBar button “Resize” → drawer with presets; option “Copy & resize” (creates new project) vs “Resize”.
- Logic: keep element relative positions: `newX = oldX / oldW * newW` (anchor center) or stretch mode `newW = oldW` scaled. Text fontSize scales with width ratio (clamped).
- Single undo entry; preview before confirm.

---

## 8. IA & UX Redesign: Make It Feel Like Canva

### 8.1 Information Architecture
```
#/                          → Home (new)
#/projects                   → Projects (existing Dashboard, now tab)
#/templates/:category?      → Template gallery
#/design/:id                → Editor
#/brand                     → Brand Kit (later)
#/settings                  → Settings (font opt-in, storage)
```

Keep hash router (no server rewrites) — just add routes. Redirect `#/` to home with recent designs + template entry points; keep `#/design/:id` stable.

### 8.2 Layout Map (vs Current)

| Region | Today | Proposed (Canva-like) |
|--------|-------|------------------------|
| **Top bar** | Logo + title input + undo/redo + export + save + zoom | **Left:** ☰ hamburger + File (Save, Download, Share, Present, Settings) + Resize + Title (auto-save pill) · **Center:** (floating toolbar handles most) · **Right:** Share (primary) + Present + User avatar placeholder + Zoom |
| **Left rail** | 16-icon nav + 72-panel | **12-icon rail (56px)** + **320px panel** with search at top + category chips + large previews (Canva: 160px cards) |
| **Canvas area** | Gray workspace with centered page | Lighter `bg-[#f2f3f5]` workspace, **page shadow + margins + rulers toggle (Cmd+Shift+R)** |
| **Bottom strip** | None | **Pages thumbnails** (when pages.length>1): 80px thumbs, add/duplicate/delete |
| **Right panel** | Always visible, tab-less | **Contextual**: Position, Style, Text, Effects tabs; collapsible; width 300px; hidden when floating toolbar covers it |
| **Floating toolbar** | None | **Above selection**: dupe/del/lock/forward/back/copy-style/more · **Below image**: crop/flip/filters/adjust |

### 8.3 Visual Language Change

Update `packages/ui/src/styles/theme.css`:

```css
--color-background: #ffffff;
--color-workspace: #f2f3f5;      /* was #e5e7eb — lighter, Canva-like */
--color-panel: #ffffff;
--color-border: #e6e8eb;
--color-primary: #7a5cf9;        /* Canva-leaning purple, warmer than #4f46e5 */
--color-primary-foreground: #ffffff;
--radius-lg: 12px;                /* was 8px → softer cards */
--radius-xl: 16px;
--shadow-card: 0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
--font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system;
```

Rules:
- Cards with `rounded-xl shadow-card` instead of `rounded-md border`.
- Buttons: primary has `h-9 px-4 rounded-full` like Canva (pill).
- Panels: no hard borders, use `shadow-sm` between rail and panel.
- Click targets ≥ 36px (a11y).

### 8.4 Interaction Details Canva Gets Right (Copy These)

1. **Drag preview:** While dragging from left panel, show semi-transparent ghost that snaps to canvas; page highlights.
2. **Hover lift:** Template cards scale 1.02 + shadow on hover.
3. **Inline text editing:** Double-click text edits in place with floating format bar (font, size, color, align) — not only right panel.
4. **Smart duplicate:** Alt+drag copies; Cmd+D keeps offset direction consistent.
5. **Nudge with precision:** Arrow = 1px, Shift+Arrow = 10px (already done) + show distance badge between selected + nearest neighbor.
6. **Empty states with personality:** “No designs yet” → show 3 template CTAs with illustrations, not just text.
7. **Command palette:** Cmd+K → “Add heading”, “Change background”, “Export PDF” (quick wins for power users).
8. **Onboarding:** First visit → 30-sec tour: “1. Choose a template, 2. Drag elements, 3. Export”.

---

## 9. Data Model & API Changes

### 9.1 Schema Versioning

Bump `CURRENT_SCHEMA_VERSION` to `2` for group support (structural change). Add migration `v1→v2` that wraps existing elements arrays verbatim (no data change; only type registry grows) — but new `group` type is forward-incompatible, so old clients see “Update OpenCanvas” error (existing newer-version path).

Subsequent additive fields (`crop`, `adjust`, `effect`, `listStyle`, frame types) **do not bump version** — they have defaults and older readers ignore unknown keys (Zod strips). This keeps import lenient.

### 9.2 Proposed Schema Additions

```ts
// packages/document/src/schema.ts

// — New element types —
LineElement: { type:'line', x,y, x2,y2, stroke, strokeWidth }
PathElement: { type:'path', pathData:string, fill, stroke }
GroupElement: { type:'group', children: ElementSchema[], width,height,x,y,rotation,... }
FrameElement: { type:'frame', shape:'rect'|'ellipse'|'custom', pathData?, cornerRadius?, 
                assetId?, fit, crop?, flipX?, flipY? }

// — Augment ImageElement —
ImageElement += { 
  crop?: { x,y,width,height },  // unit rect
  flipX?: boolean, flipY?: boolean,
  adjust?: { brightness:number, contrast:number, saturate:number, blur:number },
  shadow?: { color:HexColor, offsetX,offsetY, blur }
}

// — Augment TextElement —
TextElement += {
  listStyle?: 'none'|'bullet'|'numbered',
  listIndent?: number,
  effect?: { type:'shadow'|'lift'|'hollow'|'background', color?, blur?, offsetX?, offsetY? },
  verticalAlign?: 'top'|'middle'|'bottom'
}

// — Page —
Page += { guides?: { margins:{top,right,bottom,left}, bleed?: number } }

// — Document —
Document += { brandKitId?: string }
```

### 9.3 Command Vocabulary Extensions

```ts
page.add | page.delete | page.reorder | page.duplicate
group    | ungroup
element.update already covers new fields via ElementPatch
document.resize gains options: { anchor:'center'|'top-left', scaleContent:boolean }
```

### 9.4 Asset Model

Keep `assets: Record<id, ImageAsset>` with `source:{type:'local'|'url'}`. Add optional `kind:'icon'|'illustration'` tag for filtering. Template assets use `url` source pointing to bundled `/templates/assets/...` (copied to `public/templates/` at build); import flow downloads bytes into project blob store on first open (lazy).

---

## 10. Engineering Plan by Package

### `packages/document` (source of truth)
1. Add new element schemas + factories (`createGroupElement`, `createLineElement`, etc.).
2. Geometry helpers: `getGroupBounds(children)`, `decomposeGroupTransform`.
3. Migration v1→v2 + fixtures (5 template fixtures exported from Canva-like designs).
4. Thumbnail helper: `getElementThumbnailBounds`.

### `packages/editor-core`
1. New commands handlers in `reducer.ts` (`group`, `ungroup`, page commands).
2. Selectors: `selectAllPages`, `selectPageThumbnails`, `selectGroups`.
3. Arrange: `groupBounds()`, `ungroupElements()`, extend `alignElements` to work across groups (flatten or treat group as single box — choose single-box for v1).
4. Store: `activePageId` + new `selectedPageIds` (for multi-page actions later), `historyLimit` increase to 100.

### `packages/canvas-fabric`
1. Mapping: line/path/group/frame → Fabric objects (`fabric.Line`, `fabric.Path`, `fabric.Group`, `fabric.Rect` with clipPath).
2. Reconciliation: groups require recursive sync (by id); maintain `Map<groupId, Map<childId, object>>`.
3. Interactions: group drag → report `element.update` with decomposed child patches OR single group patch (pick single group X/Y for v1 — simpler undo).
4. Guides: extend `AligningGuidelines` with margin guides (canvas size fractions).
5. Crop UI: overlay rect with handles → updates `crop` via `element.updateMany` with `mergeKey:'crop'`.

### `packages/storage`
1. Multi-page already stored; ensure `projectStore.save` snapshots all pages.
2. Thumbnail caching: Dexie table `thumbnails` with `projectId→dataUrl` and LRU eviction (max 10MB).
3. Template asset resolver: fetch `url` assets, cache in blob store on first access.

### `packages/export`
1. SVG: handle line/path/group/frame/crop/adjust/effects → `<filter>` + `<clipPath>`. Text: bullets/numbered, effect shadows.
2. PDF: keep raster path for complex filters; vector path for simple docs (choose raster when filter/effect present).
3. Rasterizer: respect `flipX/flipY` (SVG transform `scale(-1 1)`), `crop` (clipPath).

### `packages/ui`
1. New primitives: `Slider`, `Tabs`, `Popover`, `Dialog`, `Command` (palette), `Card`, `Badge`.
2. Theme tokens refresh (radii, shadows, spacing).
3. `Thumbnail` component (aspect-ratio box with skeleton).

### `apps/web`
1. **Phase order:**
   - Week 1–2: Pages strip + group.
   - Week 3–4: Primitives + icon library + frames/grids.
   - Week 5–6: Template gallery + dashboard grid + left rail search.
   - Week 7–8: Typography + image editing + floating toolbar.
   - Week 9+: Brand Kit, Resize, Present.

2. **Key files to add:**
```
apps/web/src/templates/ (registry, loaders, 30+ JSON templates)
apps/web/src/editor/canvas/ (crop overlay, rulers component)
apps/web/src/editor/panels/ (BrandPanel, TextEffectsPanel, ImageAdjustPanel, PositionPanel)
apps/web/src/editor/toolbar/FloatingToolbar.tsx
apps/web/src/home/HomeGallery.tsx  (new home route)
apps/web/src/pages/PagesStrip.tsx
```

3. **Routing:** Extend `router.ts` with `home`, `templates`, `brand`.

---

## 11. Brand, Templates & Content Strategy

### Templates (Ship 30 by M5, 100 by M6)

**Categories (Canva-parity):**
- Social: Instagram Post/Story/Reel Cover, Facebook Post, X Post, LinkedIn Banner, YouTube Thumbnail
- Marketing: Poster, Flyer, Business Card, Brochure (front)
- Presentation: Cover slide, Section header, Quote slide
- Personal: Resume (1-pager), Invitation, Certificate
- Print: A4 Poster, Menu, Newsletter

**Licensing tiers:**
1. **Original OpenCanvas templates** — staff/community-authored, CC0. Priority 1.
2. **Adapted public domain** — e.g., open-licensed poster layouts from OpenClipart, Unsplash photos (CC0), Google Fonts (OFL).
3. **Placeholder premium** — Canva-style but marked “Community template — replace images”.

**Production pipeline:**
- Figma → export JSON via script `scripts/figma-to-opencanvas.mjs` (map frames→pages, text→TextElement, rect→RectElement).
- Each template has `preview.png` (800×600) generated at build (`vite` plugin rasterizes SVG).
- License manifest `templates/LICENSES.json` listing photo/font licenses per template (AGPL requires attribution preservation).

### Brand Kit Content
- Starter palettes: 5 curated (Vibrant, Earthy, Pastel, Mono, Bold) — apply in one click.
- Font pairs: 8 pairings (e.g., Playfair+Inter, Anton+DM Sans) with usage notes.

---

## 12. Quality, A11y & Performance Targets

| Metric | Today | Target (M6) | How |
|--------|-------|-------------|-----|
| **Lighthouse Performance** | ~90 | ≥ 92 | Thumbnails lazy-loaded, Fabric `renderOnAddRemove:false`, worker raster |
| **A11y** | Basic | ≥ 95 | All panels keyboard-navigable, thumbnails have alt, color contrast ≥ 4.5:1 |
| **Bundle** | vite (unknown) | ≤ 350kb gzipped app shell | Code-split gallery/Editor, dynamic import `jspdf` |
| **Canvas FPS** | ? | ≥ 55 fps on 50 elements @1080p | `objectCaching:false` already; add `skipOffscreen:true` |
| **Undo latency** | instant | < 50ms | Keep structural sharing, historyLimit 100 |
| **Export** | PNG/SVG/PDF | + JPG, vector PDF | — |
| **E2E** | None | Playwright: 15 flows | Add `tests/e2e/` per existing `docs/ci/github-actions-ci.yml` placeholder |

**Testing additions per milestone:** Vitest for new schemas/reducers; Fabric jsdom tests for group/frame mapping; Testing Library integration tests for gallery/crop/toolbar; Playwright for drag-drop + multi-page.

---

## 13. Metrics & Validation

Track locally (no cloud telemetry required):

| Question | Signal |
|---------|--------|
| Do users find templates? | Home → template click rate, search query length |
| Is editor usable? | Time to first element added (target < 15s), drop success rate |
| Do exports succeed? | Export error rate (target < 1%), format split |
| Is performance OK? | Canvas render time (perf.mark), thumbnail generation time |

Add opt-in `posthog` later; until then, rely on Playwright + manual dogfooding checklist.

**Dogfooding checklist (each milestone):**
- [ ] Non-engineer creates a poster from template in < 3 min without help
- [ ] All template text is editable and exports correctly
- [ ] Undo after every destructive action restores perfectly
- [ ] Keyboard-only user can add shape, move, delete, export

---

## 14. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Fabric.js groups are fragile** — selection/transform bugs | High | High | Build thin `FabricGroupAdapter` isolation; fallback: store groups as flattened with `groupId` tag instead of nested geometry |
| **Font licensing** | Medium | High | Only bundle OFL fonts; Google Fonts opt-in with user-provided URL; keep `@fontsource` installs pinned |
| **Template explosion** — 100 templates bloat bundle | Medium | Medium | Store templates as lazy JSON chunks; previews as WebP; registry is tree-shaken |
| **Scope creep** — trying to be full Canva | High | High | Enforce P0/P1/P2; each PR ≤ 400 lines; “No fake buttons” rule stays |
| **AGPL + hosted templates** — license compliance | Low | High | Ship source + LICENSE; template photos must be CC0/OFL; keep `docs/ci/github-actions-ci.yml` pattern for deploy |
| **Performance regression** with multi-page thumbs | Medium | Medium | Thumbnail worker + cache; virtualized page strip |
| **Accessibility debt** | Medium | High | Add `eslint-plugin-jsx-a11y` in M4; require a11y test in CI |

---

## 15. Quick Wins: First 2 Weeks

Ship these *before* deep structural work — immediate Canva feel lift with < 100 lines each:

| # | Win | Effort | File | Impact |
|---|-----|--------|------|--------|
| 1 | **Workspace refresh**: lighter bg, page shadow, 24px padding, rounded page (8px) | 1h | `theme.css`, `CanvasStage.tsx` | ⭐⭐⭐ |
| 2 | **Primary button as pill**: `rounded-full` for Export/Share, larger hit area | 30m | `packages/ui/button.tsx` | ⭐⭐ |
| 3 | **Dashboard cards**: 2-col grid with SVG thumbnail (render 200px SVG → img) + file name + size + updatedAt | 1 day | `Dashboard.tsx`, new `Thumbnail.tsx` | ⭐⭐⭐ |
| 4 | **Search filter in Shapes/Elements**: input filters 3 items now, scales to 20+ later | 1h | `Sidebar.tsx` | ⭐⭐ |
| 5 | **Floating duplicate/delete**: small toolbar on selection (calls existing actions) | 3h | new `FloatingToolbar.tsx` + `CanvasStage` anchor calc | ⭐⭐⭐ |
| 6 | **R to add rect, T to add text**: keyboard shortcuts (add to `useKeyboardShortcuts.ts`) | 1h | `useKeyboardShortcuts.ts` | ⭐⭐ |
| 7 | **Empty state illustration**: simple SVG poster mock + 2 CTAs (template/blank) | 2h | `Dashboard.tsx` | ⭐⭐ |
| 8 | **Eyedropper for fill**: use `EyeDropper` API where available, fallback to prompt | 2h | `PropertiesPanel.tsx` | ⭐ |
| 9 | **Lock aspect ratio** toggle on selected element | 2h | `PropertiesPanel.tsx` + store `aspectLock` transient state | ⭐⭐ |
| 10 | **Copy style / Paste style**: store `styleClipboard` (fill/stroke/typography/corners) in `EditorProvider` | 4h | `EditorProvider.tsx`, `actions.ts` | ⭐⭐ |

*Doing 1+3+5 alone makes the app photograph like Canva for screenshots — do them first.*

---

## Appendix A: Canva Jobs-To-Be-Done Map

| Job | Canva flow | OpenCanvas target flow |
|-----|-----------|-----------------------|
| **"I need an Instagram post fast"** | Home → Instagram Post template → edit text → Download PNG | Home → Instagram Post (preset) template → edit → Export PNG |
| **"I need a poster with my photo"** | Upload → drag to frame → adjust → Print PDF | Upload → drag to frame/grid → crop → Export PDF Print |
| **"Make all my posts on-brand"** | Brand Kit → apply palette/fonts → resize for each platform | Brand panel → apply palette → Magic Resize |
| **"Collaborate with teammate"** | Share link → comment → resolve | Share link (self-hosted) → local comments (v1) → real-time (v2) |
| **"Animate my presentation"** | Animate → Present → record | Present mode → slide transitions (v2) |
| **"Fix my photo"** | Edit photo → adjust/filters/BG remover | Adjust (brightness/contrast) → filters (v1), BG remover (v2) |
| **"Find the right font"** | Search fonts → pairing suggestions | Font picker with categories + pairs |
| **"Organize complex design"** | Layers + groups + pages | Layers + groups + pages |

Every milestone should close at least one full job end-to-end and be demoable as that job.

---

## Appendix B: Proposed File Tree Additions

```
packages/document/src/
  elements/line.ts, path.ts, group.ts, frame.ts
  migrations/v1-to-v2.ts

packages/editor-core/src/
  pages.ts
  groups.ts
  history.test.ts (extended)

packages/canvas-fabric/src/
  adapters/groupAdapter.ts
  adapters/frameAdapter.ts
  rulers/RulerOverlay.tsx
  guides.ts (extended)

packages/storage/src/
  thumbnails.ts
  brandStore.ts

apps/web/src/
  home/HomeRoute.tsx
  home/TemplateGallery.tsx
  home/TemplateCard.tsx
  templates/registry.ts + templates/*.json + templates/assets/**
  pages/PagesStrip.tsx
  editor/toolbar/FloatingToolbar.tsx
  editor/crop/CropOverlay.tsx
  editor/panels/PositionPanel.tsx
  editor/panels/TextEffectsPanel.tsx
  editor/panels/ImageAdjustPanel.tsx
  editor/panels/BrandPanel.tsx
  brand/BrandContext.ts
  scripts/generate-previews.mjs
  scripts/figma-to-opencanvas.mjs

tests/e2e/
  home-gallery.spec.ts
  multi-page.spec.ts
  group.spec.ts
  crop.spec.ts
```

Total new code estimated: **~6k lines** across M4–M7 (consistent with ~300–400 lines/PR × 18 PRs).

---

## Appendix C: Out-of-Scope / Later

These are real Canva features intentionally deferred — they would dilute focus before core is solid:

- **Video timeline & audio** — needs media engine (`@opencanvas/media`) beyond Fabric.
- **Real-time multiplayer** — keep commands serializable now; add OT later (Milestone 5 Cloud).
- **Magic AI suite** — text generation, image generation, background remover (behind provider abstraction, user key, full disclosure).
- **Print fulfillment** — Canva Print is a business, not just a feature.
- **App marketplace** — plugin SDK after core stabilizes.
- **Full design system audit** — Canva’s brand kit is deep (tone, voice, illustration). Start with local palettes/fonts.

---

## Next Steps

1. **Review with maintainers:** Approve pillars & milestone split; confirm AGPL-compatible asset sourcing.
2. **Land Quick Wins (Week 1–2):** PRs for workspace refresh, dashboard cards, floating toolbar — visible payoff before deep work.
3. **Kick off M4:** First PR = `document` v2 schema + group factories + migration fixtures (reviewable, < 300 lines).
4. **Template sprint:** Parallel track — designers produce first 15 templates in Figma while engineers ship M4.
5. **CI:** Add Playwright project + a11y checks in `.github/workflows/ci.yml` (owner copies from `docs/ci/github-actions-ci.yml` as before).

---

*This plan preserves what makes OpenCanvas distinct (local-first, owned documents, reviewable PRs) while borrowing the best of Canva’s product sense: make creation start from inspiration, keep editing forgiving, and let export just work. The path is incremental, testable, and shippable every two weeks.*

