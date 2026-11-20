# OpenCanvas UI/UX improvement plan

**Date:** 2026-10-29 · **Audited baseline:** `6bf3c75` · **Planning horizon:** 6 weeks

## Recommendation

Make OpenCanvas feel like an approachable design product, not a control panel with a canvas attached. Borrow Canva's useful interaction patterns—start from a template, insert attractive content, edit in context, and download with confidence—while keeping OpenCanvas's own brand and local-first architecture.

**Do not start with an editor rewrite.** The app already has 60 templates, 372 icons, 10 bundled photos, 15 font families, frames, crop, image replacement, gradients, multi-page designs, undo/redo, and export. The next gains come from content quality, clearer hierarchy, and removing friction from those existing capabilities.

This document is the current UI/UX execution plan. [The earlier Canva-parity plan](canva-parity-improvement-plan.md) remains useful as a feature backlog, but its original schema-v4/334-test snapshot is historical; the audited app now uses schema v10.

## 1. What the audit found

Review covered the source, desktop screens at 1440×900, a phone screen at 390×844, selected-text layouts at 1280 and 1024 pixels, and automated accessibility checks. The existing suite passed **686 tests in 67 files**. These checks establish a baseline, not a claim of accessibility compliance or real-user validation.

### Keep these strengths

- A real, editable template library—not decorative starter cards.
- Local project storage, folders, favorites, import/export, and autosave.
- A document-model-driven editor with undoable changes and reusable UI primitives.
- Selection-anchored actions, on-canvas crop, photo frames, and useful keyboard shortcuts.
- Honest wording about view links working only in the current browser.

### Fix these before adding more features

| Priority | Observed issue                                                                                                                                                                                  | Why it matters                                                                                                             | Main implementation area                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| P0       | The “Pastel Summer Sale” heading overlaps its subtitle; “Keep Going” has text extending beyond its intended area. These problems appear in thumbnails and the editor.                           | A beautiful starting point is central to the Canva-like experience. Broken templates undermine trust immediately.          | `templates/signature.ts`, generated template layouts, font-aware preview rendering |
| P0       | Mixed-format gallery cards stretch to the tallest card. In the first desktop row, square previews were about 259 px tall inside cards about 547 px tall.                                        | Large empty cards look unfinished and reduce the number of visible choices.                                                | `TemplateGallery.tsx`, `TemplateThumbnail.tsx`                                     |
| P0       | Automated checks found insufficient contrast, accessible names that omit visible label text, and invalid tab-list structure. The share dialog also needs the shared focus-containment behavior. | Polish must include keyboard, screen-reader, and low-vision usability.                                                     | `packages/ui`, `HomeSidebar.tsx`, `Sidebar.tsx`, `ShareDialog.tsx`                 |
| P1       | The home hero occupies roughly 350 px before format choices; template discovery is pushed down the page. Hero search looks general but searches existing designs only.                          | The main screen spends its strongest space on decoration and duplicate creation actions instead of useful starting points. | `HomeHero.tsx`, `Dashboard.tsx`                                                    |
| P1       | Nine always-visible editor destinations compete for attention; “Background” truncates in the rail. Resize appears in both the header and page toolbar.                                          | Users must interpret the chrome before they can focus on their design.                                                     | `Sidebar.tsx`, `TopBar.tsx`, `ContextualToolbar.tsx`                               |
| P1       | The selected-text toolbar needed 864 px but had only 647 px at a 1024 px viewport and 390 px on a phone. Controls remain in a horizontally scrolling strip without a clear overflow affordance. | The layout does not overflow the document, but important actions are effectively hidden.                                   | `ContextualToolbar.tsx`, shared overflow menu                                      |
| P1       | The page thumbnail dock overlays the bottom of the design. Fit-to-screen centers within the entire canvas rather than a dock-aware safe area.                                                   | Navigation can cover artwork and makes the usable canvas feel smaller.                                                     | `EditorShell.tsx`, `PagesStrip.tsx`, `CanvasStage.tsx`, adapter fit calculation    |
| P1       | Full save status is hidden below the XL breakpoint.                                                                                                                                             | Local storage is the source of truth; save confidence should not disappear on smaller screens.                             | `TopBar.tsx`                                                                       |
| P2       | Download is a format menu with fixed raster scale and implicit page scope; there is no output preview or configurable export flow.                                                              | Beginners need to know what they will receive before downloading.                                                          | `ExportControls.tsx`, `useDesignExport.ts`, `packages/export`                      |
| P2       | Resize changes document dimensions without a layout-adaptation preview. There is no reusable local brand kit.                                                                                   | These are major workflow advantages after the basic experience is reliable.                                                | `editor-core`, `PropertiesPanel.tsx`, new brand storage/UI                         |

## 2. Target experience

### Visual direction: Canva-inspired, OpenCanvas-branded

- **Neutral workspace, expressive content.** Keep white panels and the light-gray canvas. Let the templates supply most of the color.
- **One clear primary action per region.** Use violet for creation, selection, and focus—not every card, icon, badge, and surface.
- **A smaller, more confident home hero.** Replace the large decorative gradient with a compact welcome/search area, approximately 160–200 px high on desktop.
- **Readable controls.** Use 13–14 px for most UI text, 12 px minimum for secondary metadata, and clearer section headings. Avoid squeezing labels to fit.
- **Consistent geometry.** Start with 8 px control radii, 12 px cards, and 16 px dialogs; reserve pills for important actions and compact status controls. Use shadows mainly for floating surfaces.
- **Accessible color tokens.** A candidate primary is `#6d45e8`; it has approximately 5.73:1 contrast with white. A candidate muted-text color is `#5f6673`; it has approximately 5.25:1 on `#f3f4f6`. Validate final combinations rather than changing tokens blindly.
- **Quiet motion.** Use 120–180 ms transitions and honor `prefers-reduced-motion`.

### Home screen

```text
Navigation       Explicit template search                 Create design
--------------- ----------------------------------------------------------
Sidebar          Compact welcome + popular format shortcuts
Home             Continue editing: recent design thumbnails
Projects         Curated template collection
Templates        Curated template collection
Favorites
Folders          No oversized marketing block or repeated empty-state CTA
```

### Desktop editor

```text
Home / File / Design name / Save state       Undo Redo       Share Download
---------- ----------------------------------------------------------------
Compact    Selection-sensitive controls                       More menu
tool rail  ----------------------------------------------------------------
Content
panel      Canvas with a dock-aware safe area
           Selection toolbar stays inside the visible workspace

           Page thumbnails / Add page                         Zoom controls
```

The page dock gets reserved layout space rather than covering the artwork. On phones, use a compact page control and an expandable sheet instead of shrinking the entire desktop interface.

## 3. Delivery plan

Assumption: one frontend engineer with part-time design/content review. Allow **5–7 weeks**; brand assets, user testing, and export-engine work can change the estimate. Each phase must be usable and tested before moving on.

### Phase 1 — Correctness and visual foundation

**Timing:** Week 1 · **Priority:** P0

1. **Audit all 60 templates with their actual fonts loaded.** Fix text collisions, overflow, unintended wrapping, and missing assets. Review both generated and signature designs.
2. **Make template validation visual, not only schema-based.** Add font-aware checks for text bounds and collisions where elements are not intentionally layered. Generate review thumbnails after fonts are ready.
3. **Repair gallery sizing.** Preserve every design's aspect ratio. Use format-grouped grids or an aspect-aware masonry layout; never stretch a square preview to match a portrait neighbor.
4. **Apply the shared token/type pass.** Standardize buttons, inputs, menus, tooltips, section spacing, focus rings, and disabled states through `packages/ui`.
5. **Fix the accessibility baseline.** Correct contrast and visible-name mismatches; keep utility buttons outside semantic tab lists; reuse a focus-contained dialog for sharing and make background content inert while a modal is open.

**Acceptance checks:**

- Every shipped template passes visual review at its native size; the two observed defects have regression coverage.
- Gallery previews remain undistorted across all category and orientation filters.
- No critical or serious automated accessibility violations in the tested home, gallery, editor, and dialog states; manually verify keyboard behavior too.
- Existing document and export tests continue to pass.

**Main files:** `packages/ui/src/styles/theme.css`, shared components, `TemplateGallery.tsx`, `TemplateThumbnail.tsx`, template factories, `Sidebar.tsx`, `HomeSidebar.tsx`, `ShareDialog.tsx`.

### Phase 2 — A template-first home and discovery flow

**Timing:** Week 2 · **Priority:** P1

1. Replace the oversized hero with a compact welcome and **explicit template search**. Keep project-name search in Projects, where its scope is clear.
2. Add useful query suggestions such as “Instagram post,” “Presentation,” and “Poster.” Carry the query into the gallery and provide a meaningful no-results state.
3. Keep a prominent Create design action, but remove duplicate hero/empty-state calls to action that compete with it.
4. Show popular formats as compact visual choices, then **Continue editing**, then curated templates. Do not show a large “No designs yet” block when creation and format choices are already visible.
5. Organize discovery around user intent: social posts, stories, presentations, posters, and business documents. Keep the existing category, color, and orientation filters, but reveal refinements progressively.
6. Improve template previews with dimensions, page count, included content, and one clear **Use template** action. In the editor, distinguish **Replace page** from **Add as new page** before a destructive application.
7. Curate the first 12–20 templates rather than treating all 60 as equally strong. Add original templates only after the quality gate is reliable.

**Acceptance checks:**

- A first-time user can find, preview, and open an editable template without understanding project storage or editor panels.
- Searching for a template never silently searches only existing projects.
- Recent designs and useful template choices appear much earlier in the desktop page.
- Applying a template to an existing page requires an explicit choice and remains one undo step.

**Main files:** `HomeHero.tsx`, `Dashboard.tsx`, `TemplateGallery.tsx`, `TemplatePreviewModal.tsx`, `Sidebar.tsx`, template metadata.

### Phase 3 — A calmer, more direct editor

**Timing:** Week 3 · **Priority:** P1

1. Reduce the primary rail to **Design, Elements, Text, Uploads, and Brand**. Keep Draw and Layers available in a clearly labeled utility/More group; verify that this does not hurt discovery.
2. Move Background and Page settings to the page toolbar/menu. Open Properties from the selection rather than presenting it as another permanent content library.
3. Give each object type a short, predictable contextual toolbar:
   - Text: font, size, emphasis, alignment, color.
   - Image/frame: replace, crop or adjust photo, fit, opacity.
   - Shape/icon: fill/stroke, opacity, arrange.
   - Everything else goes into a visible More menu or the properties panel.
4. Remove duplicated Resize actions. Keep one obvious entry point with the other available through a menu if needed.
5. Reserve space for the page dock and calculate fit-to-screen against the remaining safe area. Keep page actions and zoom reachable without covering the design.
6. Always expose a compact save state. Failed saving must remain visible and actionable on every screen size.
7. On phones, prioritize essential controls, use at least 44×44 px touch targets, and provide dismissible property sheets. Preserve access to undo/redo, save, pages, and zoom.
8. Preserve panel/search state when switching tools where practical. Do not reset a user's place in the library after every insertion.

**Acceptance checks:**

- Common selected-object actions are visible or one labeled More-menu click away at 390, 768, 1024, and 1440 px widths.
- No required action depends on discovering an unmarked horizontal scroll area.
- Fit-to-screen leaves the whole page visible above the dock.
- Keyboard users can reach equivalent actions through toolbars, menus, layers, and properties.

**Main files:** `EditorShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `ContextualToolbar.tsx`, `FloatingToolbar.tsx`, `PropertiesPanel.tsx`, `PagesStrip.tsx`, `CanvasStage.tsx`, canvas adapter.

### Phase 4 — Reusable brand styles

**Timing:** Week 4 · **Priority:** P2

1. Add a local Brand panel with a small palette, heading/body font pairing, and uploaded logos.
2. Store brand preferences separately from documents initially; this does not require a new document schema.
3. Provide **Apply to selection** and **Apply to page** with an explicit color-mapping preview. Preserve photographs and unrelated properties.
4. Make each application one undoable transaction. Show which elements will change before applying to the whole page.
5. Reuse brand swatches and font pairs in the existing color and text controls. Do not create a second competing styling system.

**Acceptance checks:**

- A user can save a palette/font pair, reopen the browser, and reuse them in another design.
- Applying a brand never silently uploads data or changes image content.
- Cancel leaves the document untouched; undo restores the entire application in one step.

**Main files:** new `apps/web/src/brand`, a storage brand store, `Sidebar.tsx`, color fields, text controls, `editor-core` transactions.

### Phase 5 — Confident resizing and downloading

**Timing:** Week 5 · **Priority:** P2

#### Resize with preview

- Add a pure layout-adaptation function rather than putting geometry rules in a dialog.
- Offer **Create resized copy** as the safe default, with **Resize this design** as an explicit alternative.
- Preview the target format before applying. Since page size is document-wide, clearly state that the operation affects the design's pages.
- Preserve image aspect ratios and group/frame relationships; reflow text using font metrics. Flag layouts that need review rather than promising perfect automatic conversion.
- Commit size and element changes as one undoable operation. Start with square post, story, presentation, and poster fixtures.

#### Download dialog

- First expose the capabilities that already work: PNG, SVG, PDF, actual output dimensions, and page scope.
- Add a preview, file description, busy state, success/error feedback, and a clear Download button.
- Then add JPEG/WebP, transparency, scale, and page selection **only when each option is implemented and tested in the export package**.
- Do not label raster PDF as print-ready. Bleed, crop marks, and vector-text PDF are separate export milestones.
- Keep sharing truthful: label browser-local links clearly and offer the native design file for transfer. Cross-device sharing requires an optional backend and is not part of this UI polish scope.

**Acceptance checks:**

- Users can explain what pages, format, and dimensions they are downloading before confirming.
- Every visible export option changes the actual output and has a test.
- Resize preview and committed result agree; cancel is non-destructive and undo is atomic.
- Existing PNG/SVG/PDF output remains compatible with current documents.

**Main files:** new `editor-core/src/resizeLayout.ts`, command/reducer/store integration, page settings, new export dialog, `useDesignExport.ts`, `packages/export`.

### Phase 6 — Performance, usability, and release

**Timing:** Week 6 · **Priority:** P1 quality gate

1. Run moderated task tests with 6–8 people who have not used OpenCanvas. Include at least one keyboard user and one phone user.
2. Test three journeys: start from a template and edit text; replace a photo and export; resume, resize, and download a design.
3. Measure baseline and post-change performance on the same hardware. Lazy-load heavy panels and avoid regenerating all template previews unnecessarily.
4. Add screenshot coverage for the home, mixed-format gallery, blank editor, selected text, selected image, download dialog, and mobile panel states.
5. Add automated accessibility checks plus manual focus-order, zoom/reflow, reduced-motion, and screen-reader checks.
6. Release in small slices: correctness → home/discovery → editor → brand → resize/export. Do not hold all improvements behind one large redesign branch.

## 4. Success criteria

These are **targets to validate**, not current measurements:

| Outcome                           | Target                                                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Find and open a suitable template | At least 7 of 8 test participants succeed without assistance                                                                                                |
| Time to first editable template   | Median under 30 seconds after the home screen loads                                                                                                         |
| First customized export           | Median under 3 minutes for the template journey                                                                                                             |
| Common styling action             | At most 2 interactions after selecting the object                                                                                                           |
| Template quality                  | No unintended text collision or clipping in the shipped catalog                                                                                             |
| Accessibility                     | No critical/serious automated findings in tested states; no known keyboard blockers in core journeys                                                        |
| Small-screen editing              | Core actions reachable at 390 px; no artwork obscured by the default page dock                                                                              |
| Performance                       | Establish a baseline first; target no long task over 200 ms when opening a library and smooth manipulation of a 200-element fixture on the reference laptop |

Keep telemetry off by default. Use consented observation, local development measurements, and optional privacy-preserving analytics only if the project later chooses to add them.

## 5. First sprint: concrete ticket order

1. Fix and regression-test the two observed template defects; review the rest of the catalog.
2. Stop mixed-format gallery cards from stretching; preserve preview ratios.
3. Correct color tokens, visible accessible names, and tab-list semantics.
4. Consolidate modal focus behavior and apply it to sharing.
5. Add a priority-based contextual overflow menu for narrow screens.
6. Reserve page-dock space and update fit-to-screen.
7. Keep a compact but accessible save indicator at every breakpoint.
8. Prototype the compact home and explicit template search; test it before polishing animations.

**If only two weeks are available:** ship the correctness/accessibility work, home/discovery improvements, and narrow-screen toolbar/page-dock fixes. Defer Brand, automatic layout adaptation, and new export formats—not template quality or save visibility.

## 6. Explicitly out of scope

- Copying Canva's logo, proprietary templates, illustrations, or exact visual identity.
- Replacing Fabric.js or rewriting the document model for appearance alone.
- Video editing, real-time collaboration, AI generation, paid content, or a marketplace.
- Cloud accounts/synchronization as a prerequisite for a better local editor.
- Adding placeholder controls for features that do not work.

**Decision rule:** prioritize changes that help someone find a good starting point, make an edit without hunting, or trust the result. A screen that merely looks more decorated is not an improvement.

## Implementation status — first sprint

**Updated:** 2026-10-29. The first implementation pass is complete on `arena/9f3a2bb2-open-canvas`; the remaining phases below are still roadmap work, not shipped features.

### Shipped in this pass

- Font-measured, cached template previews with loading and failure states; natural-height masonry cards instead of stretched mixed-format cards.
- Repaired the Summer Sale, Sunset Story, and Quarterly Review text collisions. Launch Week now uses Oswald so its longest headline line fits its declared box. A browser audit of all 60 templates with bundled fonts loaded reports no measured text-box collisions or overflow.
- Compact, template-first home with explicit template search, query handoff to the gallery, popular searches, blank-format shortcuts, and no duplicate empty-state block.
- Accessible primary/muted color tokens, count-aware navigation names, a solid primary create action, and a shared portal dialog with focus containment/restoration, inert background, Escape, backdrop dismissal, and scroll locking. Share and the page grid use it; existing project dialogs use the compatibility wrapper.
- Correct tab-list structure and arrow/Home/End navigation in the editor rail.
- Responsive selection toolbar with a labelled More menu for secondary formatting and properties; duplicate header Resize removed.
- Persistent compact save status, including a retry action on failure.
- Pages and zoom moved into a reserved workspace row, so they no longer cover the artwork or consume the canvas fit area.

### Verification

- Full workspace typecheck and ESLint pass.
- Vitest: **694 tests in 69 files** pass, including new dialog, thumbnail, template-layout, keyboard-rail, and compact-overflow regressions.
- Playwright: create → edit → copy/paste → SVG export → reload passes; template aspect-ratio and 390px editor dock/toolbar checks pass.
- Axe WCAG A/AA automated scans report **zero violations** on the tested desktop home, template gallery, editor, and Share dialog states. This is not a claim of full accessibility compliance.
- Desktop 1440×900 and phone 390×844 checks report no document overflow or runtime page errors. Selected-text toolbar overflow is zero at 1440, 1280, 1024, and 390px.

### Still open

The five-destination rail reorganization and Brand panel, reusable brand kits, layout-aware resize preview, configurable export dialog, broader usability studies, and production performance budgets remain later-phase work. The mobile rail still scrolls horizontally; its semantics and keyboard behavior are fixed, but the planned reduction in destinations is not yet implemented. Native `canvas`-dependent PNG/PDF runtime verification remains separate from the passing SVG/browser checks because the optional native dependency could not be built in this sandbox.

## Implementation status — second sprint

**Updated:** 2026-10-30. The calmer rail (Phase 3), local Brand kit (Phase 4), and download dialog (Phase 5, download half) are implemented on `arena/9f3a2bb2-open-canvas`.

### Shipped in this pass

- **Two-group editor rail.** The rail now leads with five primary destinations — Design, Elements, Text, Uploads, Brand — and groups Draw, Background, Layers, Properties, and Page under a labeled "More tools" tablist. Each group keeps valid tab semantics with its own roving-tabindex arrow/Home/End navigation that follows actual focus. Desktop shows the group label; the phone bar scrolls the two groups horizontally.
- **Local Brand kit.** A Brand panel holds up to 12 palette colors and a heading/body font pairing, persisted in `localStorage` (`opencanvas:brand-kit:v1`) so it follows the user across designs with no account and no document-schema change. Colors apply to the current selection (fill for shapes/frames, color for text/icons) through the normal command pipeline; "Use colors from this page" seeds the palette from the design itself. Fonts apply to selected text directly, or to the whole page via an explicit summary ("Largest text (N) becomes X; other text (M) becomes Y") that the user confirms — grouped text included, committed as a single page-content replacement, so one undo restores every font. Cancel leaves the document untouched. Brand logos are not part of this pass.
- **Download dialog.** Download now opens a dialog that states the exact filename, shows a live preview of the current page, and confirms before rendering: PNG with 1×/2×/3× size and exact output pixel dimensions, SVG vector, or PDF with All pages / Current page only scope. PDF copy truthfully notes pages are rendered as images at 2× (sharp, not text-selectable). Failures keep the dialog open with the reason inline (the notification toast still fires), and success closes it. The export hook gained tested `scale` and `pageScope` options for this; existing PNG/SVG/PDF output is unchanged at defaults.
- **Fabric editing field label.** The adapter now labels Fabric's hidden text-editing `<textarea>` ("Edit text") when editing starts; axe previously reported it as an unlabeled form control in editing states.

### Verification

- Full workspace typecheck, ESLint, and Prettier checks pass.
- Vitest: **709 tests in 71 files** pass, including new brand-kit storage/extraction/font-plan unit tests, brand panel integration tests (color apply, one-undo font apply, browser persistence), download-dialog tests (chosen scale reaches the rasterizer, current-page PDF renders one page, failure keeps the dialog open), the updated rail keyboard-navigation expectations, and the adapter test for the labeled editing field.
- Playwright: **4 tests pass** — the create → edit → copy/paste → SVG export → reload flow (now through the dialog), template aspect ratios, the 390px dock/toolbar checks, and a new brand-kit + download-dialog flow that also verifies the kit persists to localStorage.
- Axe WCAG A/AA automated scans report **zero violations** on the tested desktop editor (text selected, Brand panel open) and Download dialog states. This is not a claim of full accessibility compliance.
- One measurement caveat: while a text edit is actively open during a live viewport resize, Fabric positions its invisible 1px editing textarea at the edited text, which inflates `documentElement.scrollWidth` until editing exits (390px again immediately after). Nothing is painted outside the viewport; a fresh 390px editor measures no overflow.

### Still open

Layout-aware resize preview, brand logos, broader usability studies, and production performance budgets remain later-phase work. Native `canvas`-dependent PNG/PDF runtime verification remains separate from the passing SVG/browser checks because the optional native dependency could not be built in this sandbox.

## Implementation status — third sprint

**Updated:** 2026-10-30. A shared motion system, layout-aware resize with preview (Phase 5, resize half), present-mode page transitions, and brand swatches in color fields are implemented on `arena/9f3a2bb2-open-canvas`.

### Shipped in this pass

- **Motion system.** Animation tokens (`--animate-*`) and keyframes now live in the shared theme: dialogs fade/scale in (200ms), overlays fade, menus pop (130ms), toasts slide up, editor panels settle, the mobile panel sheet slides up, the contextual toolbar animates when the selection changes, and template/project cards rise in with a capped 45ms stagger. All motion is transform/opacity only, stays in the 120–280ms band, and a global `prefers-reduced-motion` rule collapses every animation and transition to an instant state change (verified in a browser with reduced motion emulated). Entry animations only — dialogs still unmount immediately on close rather than delaying dismissal for an exit animation.
- **Layout-aware resize with preview.** `editor-core` gained a tested per-axis `scaleElementsToSize` alongside the existing uniform `fitElementsToSize` (text scales with the horizontal factor so wrapping survives; groups and paths included). The Page panel's new **Resize design with preview…** dialog offers the canvas presets or a custom size, a Fit content / Stretch to fill choice with honest trade-offs, and a live rendered preview of the current page. **Resize this design** applies the size and adapted content to every page as a single history entry (one undo restores everything). **Create resized copy** (the safe default when the editor is hosted by the project app) duplicates the design — image bytes included — saves the adapted pages under a `Name · Preset` title, and opens the copy; the original is never touched.
- **Present-mode page transitions.** Presentations now animate between pages with a None / Fade / Slide choice in the header; Slide is direction-aware (advancing and going back move opposite ways), and the choice persists in `localStorage`.
- **Brand swatches in color fields.** Every `ColorField` (fill, text color, background, …) now shows the brand palette as one-click swatches, completing the "reuse brand styles in existing controls" item from Phase 4 — no second styling system.

### Verification

- Full workspace typecheck, ESLint, Prettier, and production build pass.
- Vitest: **720 tests in 73 files** pass, including new per-axis scaling unit tests, resize dialog integration tests (fit lands as one undoable step, stretch fills, copy request leaves the design untouched), present-transition tests, and a ColorField brand-swatch regression.
- Playwright: **5 tests pass**, including a new end-to-end resized-copy flow: create → resize via dialog → copy opens as `Resize check · Instagram story` at 1080×1920 → both designs listed in Projects.
- Browser checks confirm the Tailwind animation utilities are actually generated (`rise-in` 0.42s, `dialog-in` 0.2s), reduced-motion emulation collapses durations to ~0s with content fully visible, and no page/console errors occur.
- Axe WCAG A/AA automated scans report **zero violations** on the tested home, resize dialog, and present-mode states. This is not a claim of full accessibility compliance.

### Still open

Brand logos, broader usability studies, and production performance budgets remain later-phase work. Native `canvas`-dependent PNG/PDF runtime verification remains separate from the passing SVG/browser checks because the optional native dependency could not be built in this sandbox.

## Implementation status — fourth sprint (Canva elements parity)

**Updated:** 2026-10-29. Shapes 8→22, Charts (bar/pie/line), photo Grids, and canvas presets 8→18 are implemented on `arena/57f807e5-open-canvas`. Full gap analysis: `docs/canva-gap-analysis.md`.

### Shipped in this pass

- **Shapes 8→22.** Added pentagon, octagon, diamond, four block arrows + double arrow, heart (parametric curve), plus, moon (crescent), cloud (dual-Gaussian top), speech bubble, and ribbon — all as `path` elements via pure `shapeGeometry.ts` helpers, so no schema change and export/resize/grouping work unchanged. Panel shows 22 Lucide-icon tiles with Canva-style keywords; drag payloads accept the new kinds.
- **Charts (bar/pie/line).** New Charts section inserts each chart as one editable group (bars/slices/trend + value/category labels + legend/baseline) built from existing primitives. Groups move, resize (children scale via `layout.ts`), export, and ungroup for per-bar editing. Data-table editing (change a number, chart redraws) is Sprint 5.
- **Photo grids (2×2, 3×3, strip, duo).** New Grids section inserts a group of empty `frame` elements; dropping a photo fills that cell. Whole grid moves/resizes as one group.
- **Canvas presets 8→18.** Added TikTok, Pinterest Pin, LinkedIn post, Facebook story, YouTube banner, Poster A5, Instagram landscape, X header, Presentation 4:3, and Facebook cover to the Create/Resize dialogs.
- **Drag & drop.** `drag.ts` validates `chart`/`grid` payloads; `CanvasStage` drops them at the pointer via `addChart`/`addGrid`.

### Verification

- Full workspace typecheck, ESLint, Prettier, and production build pass.
- Vitest: **732 tests in 74 files** pass (was 720/73), including new `EditorCharts.test.tsx` (shape geometry counts, chart/grid builder child counts, schema-valid insertion, panel insert + category filtering, heart-shape insert) and updated `EditorElements.test.tsx` (heart now matches both shape and icon; pentagon is a valid drag payload; chart/grid payload validation).
- Charts/grids verified schema-valid via `validateDocument`; export uses existing group/path/frame pipeline.

### Still open

JPG + transparent PNG export, brand logos, version history, template/font/photo depth, broader usability studies, and production performance budgets remain later-phase work. Native `canvas`-dependent PNG/PDF runtime verification remains separate from the passing SVG/browser checks because the optional native dependency could not be built in this sandbox.

## Implementation status — fifth sprint (chart data, tables, text effects)

**Updated:** 2026-10-29. Chart data editing, tables, and text outline/shadow are implemented on `arena/57f807e5-open-canvas`. Full gap analysis: `docs/canva-gap-analysis.md`.

### Shipped in this pass

- **Text outline & shadow (schema v11).** Text elements gained optional `stroke` and `shadow` fields (additive migration 10→11; old documents render unchanged). Fabric renders them via `Shadow` + stroke props, SVG export emits `stroke`/`stroke-width` and an `feDropShadow` filter, resize scaling adapts stroke width and shadow offsets/blur, and style copy carries them between text elements. The Properties panel shows a **Text effects** section (Outline/Shadow toggles with color, width, offset, and blur controls).
- **Chart data editing.** Chart builders now accept `ChartDatum[]` (label/value/color). Selecting a Bar/Pie/Line group shows a **Chart data** editor in Properties; Apply rebuilds the group children in place (same id/position/size) as one undo step. Data is recovered from existing labels/legends (`parseChartGroup`), so hand-edited charts degrade gracefully with an explanatory note.
- **Tables.** New Tables section inserts a 4×3 table group (header tint, grid strokes, cell text). Selecting it shows a **Table data** editor: edit cells, add/remove rows and columns, Apply as one undo step. Drag payload `{ kind: 'table' }` is supported.

### Verification

- Full workspace typecheck, ESLint, Prettier, and production build pass.
- Vitest: **741 tests in 75 files** pass (was 732/74), including new `EditorSprint5.test.tsx` (schema validation, SVG stroke/shadow output, panel toggles, chart parse/regenerate round-trip for all three kinds, chart data edit as one undo, table build/parse/regenerate, table insert + cell edit, row add/remove) and updated `migrations.test.ts` (v11 fixture + v10→v11 step).
- Chart/table groups verified schema-valid; export uses existing group/text/rect pipeline.

### Still open

JPG + transparent PNG export, brand logos, version history, template/font/photo depth, broader usability studies, and production performance budgets remain later-phase work. Native `canvas`-dependent PNG/PDF runtime verification remains separate from the passing SVG/browser checks because the optional native dependency could not be built in this sandbox.

## Implementation status — sixth sprint (JPG/transparent export, brand logo, version history)

**Updated:** 2026-10-29. JPG + transparent PNG export, brand logo, and named version history are implemented on `arena/57f807e5-open-canvas`. Full gap analysis: `docs/canva-gap-analysis.md`.

### Shipped in this pass

- **JPG + transparent PNG export.** The Download dialog gained a JPG format (rasterizer supports a `jpeg` format: canvas is flattened onto white since JPEG has no alpha, output at 0.92 quality) and a **Transparent background** toggle for PNG (SVG renders without the page background rect, so the PNG carries no background color). Both honor the 1×/2×/3× size choices and the existing filename/pixel summaries.
- **Brand logo.** The brand kit gained an optional logo (data URL + file name, 1 MB cap for localStorage). The Brand panel shows a **Brand logo** section: upload (validated image type/size), preview, replace, remove, and **Insert logo into design**, which routes through the normal image-import pipeline (sniff/decode/store/place) as one undo step.
- **Version history.** The existing History dialog (undo timeline with jump-to-step) gained **Saved versions**: name and save a snapshot of the current design, restore it, or delete it. Snapshots live in localStorage under one key per design (20-version cap, corrupt entries dropped on read). Restore dispatches a new `document.replace` command (same-id enforced, schema-validated), so restoring is itself one undo step.

### Verification

- Full workspace typecheck, ESLint, Prettier, and production build pass.
- Vitest: **760 tests in 77 files** pass (was 741/75), including new `EditorVersions.test.tsx` (save/restore as one undo, name required, delete) and `versions.test.ts` (newest-first listing, per-design isolation, cap, corrupt-entry dropping), plus extended `raster.test.ts` (JPEG white-flatten + data URL), `EditorExport.test.tsx` (JPG download, transparent PNG omits background), `EditorBrand.test.tsx` (logo upload/insert/remove), `brandKit.test.ts` (logo sanitize/round-trip), and `reducer.test.ts` (`document.replace` same-id/invalid rejection).
- Note: the pre-existing Modal-based `HistoryPanel` (opened from the TopBar) was extended in place rather than replaced, so the established History entry point is unchanged.

### Still open

Template/font/photo depth, broader usability studies, and production performance budgets remain later-phase work. Native `canvas`-dependent PNG/PDF runtime verification remains separate from the passing SVG/browser checks because the optional native dependency could not be built in this sandbox.

## Seventh sprint — content depth (2026-11-19)

### What shipped

- **Fonts 15 → 33 families.** Added 18 OFL families through `@fontsource`/`@fontsource-variable` (Montserrat, Poppins, Roboto, Open Sans, Lato, Bebas Neue, Anton, Pacifico, Dancing Script, Work Sans, Nunito, Rubik, Karla, Figtree, Merriweather, Lora, EB Garamond, Cormorant Garamond). The font picker now spans 21 sans, 9 serif, and 3 handwriting families, all bundled locally for offline use.
- **Templates 60 → 156.** A new cross-product generator (`templates/generated.ts`) builds 96 additional designs from 6 collections × 2 content sets × 4 palettes × 2 type pairings on the existing blueprint system, so every generated design passes the same schema, bounds, overlap, SVG-render, and determinism gates as the hand-tuned ones. Category spread: Social 38, Poster 34, Presentation 28, Print 28, Marketing 28.
- **Pluggable photo URLs.** The Elements Photos section and both PhotoPicker call sites (frame fill, image replace) accept a pasted image URL: the bytes are fetched, validated, and stored with the design (offline-safe), and the URL is remembered in this browser (up to 12) with a one-click forget. Fetch failures report honestly instead of silently failing.

### Verification

- Full workspace typecheck, ESLint, Prettier, and production build pass.
- Vitest: **767 tests in 78 files** pass (was 760/77), including new `photoUrls.test.ts` (remember/forget/cap/corrupt-entry handling) and `EditorPhotos.test.tsx` URL-import cases (success remembers the link; failure reports and leaves the design untouched), plus updated catalogue/gallery/dashboard counts that now derive from `TEMPLATES.length` instead of a hard-coded 60.

### Still open

Canva-scale cloud photo search, AI tools, and marketplace content remain out of scope for a local-first product. Native `canvas`-dependent PNG/PDF runtime verification remains separate from the passing SVG/browser checks because the optional native dependency could not be built in this sandbox.
