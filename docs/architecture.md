# OpenCanvas architecture

This document describes the system as it exists after Milestone 1 and the contracts later
milestones build on. It is intentionally concrete: file names, types and invariants.

## 1. Packages and dependency direction

```
apps/web ──► packages/editor-core ──► packages/document
   │                                        ▲
   ├────────► packages/canvas-fabric ───────┤
   ├────────► packages/storage ─────────────┘
   └────────► packages/ui
```

- `packages/document` has no knowledge of rendering or React. Everything else depends on it.
- `packages/editor-core` depends only on `document` (+ `zustand/vanilla`). It is usable from
  Node, tests, the future API server and AI tooling.
- `packages/canvas-fabric` depends on `document` and `fabric`. It never imports `editor-core`:
  the adapter communicates through callbacks and a `render(scene)` method.
- `packages/storage` depends only on `document`: asset blob stores, image import and asset URL
  resolution (project persistence joins it in Milestone 3).
- `apps/web` is the only place where React, the store, the adapter and storage meet.

Internal packages are consumed as TypeScript source (`exports` → `src/index.ts`); Vite, Vitest
and `tsc` resolve them through the pnpm workspace. A compiled build step will be added when a
Node consumer (`apps/api`) needs it.

## 2. Document model (`packages/document`)

- **Schema version** `1` (`CURRENT_SCHEMA_VERSION`). Every document carries `schemaVersion`.
- **Structure**: `DesignDocument { id, name, size, pages[], assets, metadata }` →
  `Page { id, background, elements[] }` → `DesignElement` (discriminated union on `type`:
  `rect`, `ellipse`, `text`, `image`). Z-order is array order (index 0 = back).
- **Assets**: `assets` is a record of `ImageAsset { id, kind, name?, mimeType, width, height,
byteSize?, source, createdAt }`. It carries **metadata only** — bytes live in an asset store
  keyed by id (`source: { type: 'local' }`) or behind an http(s) URL (`source: { type: 'url' }`).
  `image` elements reference assets by `assetId` and choose a `fit` (`cover` crops to fill the
  box, `fill` stretches). A document-level check rejects images whose asset is not registered,
  so a document can never reference bytes it does not know about.
- **Geometry convention**: `x`/`y` is the top-left corner of the un-rotated element; `rotation`
  (degrees, clockwise) is applied around that corner. This equals SVG
  `translate(x y) rotate(r)` and is what exporters will implement.
- **Styling**: `Fill` (`solid` | `none`), optional `Stroke`, `opacity`, text typography
  (`fontFamily`, `fontSize`, `fontWeight` 100–900, `fontStyle`, `textAlign`, `lineHeight`
  multiplier, `letterSpacing` px, `underline`, `color`).
- **Limits** (`LIMITS`): canvas ≤ 16 384 px, ≤ 2 000 elements per page, ≤ 100 pages, text ≤ 20 000
  chars, etc. They guard the editor, exporters and AI validation against pathological input.
- **Validation**: `validateDocument(unknown)` and `parseDocument(string | unknown)` return a
  `Result` (never throw for bad input) with a readable error code and issue paths. Unknown keys
  are stripped; duplicate ids are rejected.
- **Migrations**: `MIGRATIONS` is an ordered registry of `{ from, to, migrate(raw) }` steps.
  `parseDocument` runs `migrateDocument` before validation. Newer-than-supported versions are
  rejected explicitly. Tests verify the chain is contiguous and ends at the current version.

Adding a field with a default or a new element type does **not** require a version bump.
Renaming or reinterpreting existing data does: bump `CURRENT_SCHEMA_VERSION`, append a migration,
add a fixture test.

## 3. Command layer and history (`packages/editor-core`)

All document mutations are `EditorCommand`s:

| Command                                | Notes                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `document.rename`, `document.resize`   | Resize validates against `DocumentSizeSchema`.                                                    |
| `page.setBackground`                   |                                                                                                   |
| `element.add`                          | Optional index; rejects duplicate ids.                                                            |
| `element.update`, `element.updateMany` | Patch merged then **re-validated** with `ElementSchema`; invalid patches are rejected as a whole. |
| `element.delete`, `element.duplicate`  | Duplicate offsets copies and accepts explicit ids for tests.                                      |
| `element.reorder`                      | `front` / `back` / `forward` / `backward` / `{ index }`.                                          |

`applyCommand(doc, command)` is a pure function returning `Result<DesignDocument, CommandError>`
with structural sharing (untouched pages/elements keep identity; no-ops return the same object).

`createEditorStore(document)` (Zustand vanilla) adds:

- **History** as document snapshots (`past` / `future`, capped by `historyLimit`). Snapshots are
  cheap because documents are immutable and share structure.
- **Merge keys**: `dispatch(cmd, { mergeKey })` coalesces consecutive edits with the same key
  inside `mergeWindowMs` into one undo step (typing in a field, nudging with arrows).
- **Derived updates**: `dispatch(cmd, { recordHistory: false })` for measurements (auto-sized
  text height) that must not create undo steps.
- **Selection** (not part of history). After undo/redo, elements that reappear on the active
  page become the selection; otherwise the selection is pruned to existing ids.
- **Dirty tracking** by saved-snapshot identity, so undoing back to the saved state reports clean.
- `lastError` surfaces rejected commands to the UI instead of failing silently.

### Asset commands

- `asset.register { asset }` validates the record with `AssetSchema`, rejects duplicate ids and
  enforces `LIMITS.maxAssetsPerDocument`. `asset.remove { assetId }` is rejected while any element
  still references the asset.
- `element.add` parses the element with `ElementSchema` (producers include drops and, later, AI)
  and `element.add`/`element.update(Many)` fail with `asset-not-found` when an image points at an
  unregistered asset.
- Inserting an upload dispatches `asset.register` and `element.add` with a shared `mergeKey`, so
  one Undo removes both.

### Geometry and arrangement helpers

- `packages/document/geometry.ts` computes axis-aligned bounds (`getElementBounds` for a rotated
  element, `unionBounds`, `pageBounds`). Rotation is clockwise around the element's top-left
  corner, exactly as the Fabric mapping renders it.
- `packages/editor-core/arrange.ts` turns a selection into `element.updateMany` patches:
  `alignElements(elements, mode, target)` moves elements by translation only (rotation and size
  never change), `distributeElements(elements, axis)` equalizes the gaps between three or more
  elements while the outer two stay put, and `alignmentTarget` picks the page for a single
  element and the selection box otherwise. Locked elements are skipped and elements already in
  place produce no patch, so the history never records a no-op.

## 4. Fabric adapter (`packages/canvas-fabric`)

Fabric.js 7 positions objects by **center** (`left`/`top`, `originX/Y` are deprecated) and counts
`strokeWidth` in its box math. The adapter owns this translation:

- `mapping.ts` is Fabric-free and unit-tested: `topLeftToCenter`, `centerToTopLeft`,
  `geometryFromTransform` (bakes `scaleX/Y` into width/height, normalizes angles, rounds noise),
  `elementToFabricProps` (sets `strokeWidth: 0` when there is no stroke, `strokeUniform`, converts
  `lineHeight` by Fabric's `_fontSizeMult` and `letterSpacing` px → thousandths of an em).
- `FabricCanvasAdapter.render({ page, size, selectedIds })` reconciles by element id: creates,
  updates (only changed props), replaces on type change, removes, re-orders (index 0 is the page
  background rect; the canvas `clipPath` hides content outside the page), and syncs selection
  (single object or `ActiveSelection`).
- **Loop prevention**: `applying` is true during `render()`; every Fabric event handler returns
  early while it is set, so programmatic updates never echo back as commands.
- **Interactions → patches**: `object:modified` reads `util.qrDecompose(calcTransformMatrix())`
  (correct inside multi-selections) and emits `onElementsModified([{ elementId, patch }])`.
  Text edits are committed on `text:editing:exited`; measured heights are reported separately.
- Zoom/pan: `setZoom(zoom, focalPoint)`, `panBy`, `fitToViewport(padding)`; `Ctrl/⌘ + wheel`
  zooms at the pointer, plain wheel pans.
- `dispose()` cancels pending renders so teardown is synchronous (React StrictMode safe).
- **Images**: an `image` element becomes a `FabricImage`. `computeImageFit(box, natural, fit)`
  turns `cover`/`fill` into Fabric's crop window (`cropX/Y`, `width/height`) plus `scaleX/Y`;
  the drawn size always equals the element box, so `geometryFromTransform` needs no special
  case. Bitmaps load asynchronously through two injectable functions passed in the options:
  `resolveAssetUrl(asset)` (object URL or http(s) URL) and `loadImage(url, { signal })`
  (defaults to Fabric's loader with anonymous CORS so exports stay untainted). While loading, a
  placeholder bitmap is stretched over the box so the element is immediately selectable; on
  failure an error placeholder stays and `onAssetError(elementId, assetId, { code })` fires
  (`asset-missing` | `unavailable` | `load-failed`). Loads are aborted when the element
  disappears or the adapter is disposed, and a failed asset is not retried until the element
  points at a different asset.
- **Snapping**: `setSnapping(enabled)` installs Fabric's `AligningGuidelines` extension
  (alignment to other objects and to the page rect, which is a regular Fabric object at index 0).
  `fabric/extensions` imports `westures` without declaring it, so `canvas-fabric` lists it as a
  dependency explicitly.
- `clientToPage(clientX, clientY)` inverts the viewport transform for drag-and-drop placement.

Unit tests run real Fabric classes in jsdom with a stubbed 2D context
(`test/setup-canvas.ts`); image tests inject a loader that returns sized `<canvas>` elements
because jsdom never fires `<img>` load events. Pixel output is left to browser E2E tests.

## 4a. Storage (`packages/storage`)

- `AssetBlobStore { put, get, has, delete, keys }` is the only storage contract the editor
  knows. `MemoryAssetBlobStore` backs the current session; a Dexie/IndexedDB implementation
  arrives with project persistence in Milestone 3.
- `importImageFile(file, { maxBytes, allowedTypes, decode })` returns a `Result`: it enforces the
  size cap, sniffs the real format from the bytes (PNG/JPEG/GIF/WebP magic numbers — `File.type`
  is never trusted), decodes to learn the pixel size (`createImageBitmap`, `<img>` fallback,
  injectable for tests) and checks `LIMITS.maxAssetDimension`.
- `ObjectUrlCache` hands out one object URL per asset, shares in-flight lookups and revokes on
  release; `createAssetResolver` maps `local` assets through it and allows `url` assets only
  over http(s) (`isSafeAssetUrl` rejects `javascript:`, `data:`, `blob:`, `file:`).

## 5. Web app (`apps/web`)

- `EditorProvider` creates one store, one `CanvasController` and one notification store per
  document. `AssetProvider` (outside it) owns the blob store, object URL cache, resolver and
  decoder; tests inject deterministic implementations through `EditorPage`'s `assetServices`.
- `CanvasStage` mounts the adapter, subscribes to the store (`document`, `selectedIds`,
  `activePageId`) and re-renders the scene; adapter callbacks dispatch commands. It is also the
  drop target: files dropped on the canvas are imported and centered on the drop point
  (`controller.clientToPage`).
- `actions.ts` (`useEditorActions`) is the single place UI code turns intents into commands;
  `assets/useImageImport.ts` owns the upload flow (validate → store bytes → register → add).
- `TopBar` (rename, undo/redo, change status, snapping toggle, zoom/fit), `Sidebar` (Shapes,
  Text, Uploads, Background, Layers), `PropertiesPanel` (layout, fill & stroke, typography,
  crop & fit for images, align/distribute, arrange; page size when nothing is selected),
  `useKeyboardShortcuts`, `ErrorToast` for rejected commands and application failures (import,
  asset loading).
- `panels/LayersPanel` is a z-order view of the active page (top-most first, i.e. the reversed
  element array). Rows are `role="option"` items: click / Ctrl-click / Shift-click drive
  `setSelection`, HTML5 drag-and-drop dispatches `element.reorder { to: { index } }` (the index
  is computed against the array without the dragged element, matching the reducer), per-row
  eye/lock buttons dispatch `element.update`, and double-click (or F2) opens an inline rename
  that commits `name` on Enter/blur and discards on Escape. Names fall back to
  `describeElement` (text content, image file name, element type) and the same helper labels
  the properties panel.
- Removing an upload only drops the asset record; its bytes stay in the session store so Undo
  can restore it. Unreferenced blobs are pruned when projects are saved (Milestone 3).
- Form fields commit validated values (clamped to schema limits) and follow external changes
  unless focused.

## 6. Testing strategy

| Layer         | Tool                          | What is covered                                                     |
| ------------- | ----------------------------- | ------------------------------------------------------------------- |
| document      | Vitest (node)                 | Schema limits, defaults, round-trips, migration pipeline, failures. |
| editor-core   | Vitest (node)                 | Reducer semantics, immutability, history/merge/limit, selection.    |
| canvas-fabric | Vitest (jsdom + context stub) | Mapping math, reconciliation, ordering, selection sync, events.     |
| web           | Vitest + Testing Library      | Real store + real adapter: insert, edit, undo/redo, shortcuts.      |
| E2E (planned) | Playwright                    | Pointer interactions, rendering, persistence, export.               |

## 7. Decisions and constraints

- **TypeScript 6.0** (not 7): `typescript-eslint` supports `< 6.1` today.
- **Fabric.js 7.4**: latest major with security fixes for SVG export; center-origin semantics are
  isolated in the adapter so the document format is unaffected.
- **Zod 4**, **Vite 8 / Vitest 5**, **Tailwind CSS 4** (CSS-first `@theme` tokens in
  `packages/ui/src/styles/theme.css`), **Zustand 5** (vanilla store in `editor-core`, React
  bindings only in `apps/web`).
- shadcn/ui components are hand-authored in `packages/ui` (same conventions: `cva`, `cn`, Radix
  primitives) because the CLI registry is not available in the build environment.
- Fonts: Inter (SIL OFL 1.1, bundled via `@fontsource/inter`) plus common system families.

## 8. Extension points reserved for later milestones

- `packages/storage`: `ProjectRepository` interface over Dexie/IndexedDB (documents + asset
  blobs) and a remote implementation; autosave subscribes to the store's `dirty` flag
  (Milestone 3). `contain` fit and manual crop offsets for images extend `ImageElement`
  additively.
- `packages/export`: renderers from the document model to SVG/PNG/PDF (Milestone 3).
- `packages/ai-core`: structured generation validated with `DocumentSchema`/`ElementSchema`,
  applied through `element.add`/`element.update` so AI edits are undoable (Milestone 4).
- Collaboration: commands are serializable; a future op log can replay them.
