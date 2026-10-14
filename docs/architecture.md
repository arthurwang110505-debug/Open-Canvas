# OpenCanvas architecture

This document describes the system as it exists after Milestone 1 and the contracts later
milestones build on. It is intentionally concrete: file names, types and invariants.

## 1. Packages and dependency direction

```
apps/web ──► packages/editor-core ──► packages/document
   │                                        ▲
   ├────────► packages/canvas-fabric ───────┘
   └────────► packages/ui
```

- `packages/document` has no knowledge of rendering or React. Everything else depends on it.
- `packages/editor-core` depends only on `document` (+ `zustand/vanilla`). It is usable from
  Node, tests, the future API server and AI tooling.
- `packages/canvas-fabric` depends on `document` and `fabric`. It never imports `editor-core`:
  the adapter communicates through callbacks and a `render(scene)` method.
- `apps/web` is the only place where React, the store and the adapter meet.

Internal packages are consumed as TypeScript source (`exports` → `src/index.ts`); Vite, Vitest
and `tsc` resolve them through the pnpm workspace. A compiled build step will be added when a
Node consumer (`apps/api`) needs it.

## 2. Document model (`packages/document`)

- **Schema version** `1` (`CURRENT_SCHEMA_VERSION`). Every document carries `schemaVersion`.
- **Structure**: `DesignDocument { id, name, size, pages[], metadata }` →
  `Page { id, background, elements[] }` → `DesignElement` (discriminated union on `type`:
  `rect`, `ellipse`, `text`). Z-order is array order (index 0 = back).
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

Unit tests run real Fabric classes in jsdom with a stubbed 2D context
(`test/setup-canvas.ts`); pixel output is left to browser E2E tests.

## 5. Web app (`apps/web`)

- `EditorProvider` creates one store + one `CanvasController` per document.
- `CanvasStage` mounts the adapter, subscribes to the store (`document`, `selectedIds`,
  `activePageId`) and re-renders the scene; adapter callbacks dispatch commands.
- `actions.ts` (`useEditorActions`) is the single place UI code turns intents into commands.
- `TopBar` (rename, undo/redo, zoom/fit, change status), `Sidebar` (Shapes, Text, Background),
  `PropertiesPanel` (layout, fill & stroke, typography, arrange; page size when nothing is
  selected), `useKeyboardShortcuts`, `ErrorToast` for rejected commands.
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

- `assets` map on the document + `image` element (Milestone 2).
- `packages/storage`: `ProjectRepository` interface over Dexie/IndexedDB and a remote
  implementation; autosave subscribes to the store's `dirty` flag (Milestone 3).
- `packages/export`: renderers from the document model to SVG/PNG/PDF (Milestone 3).
- `packages/ai-core`: structured generation validated with `DocumentSchema`/`ElementSchema`,
  applied through `element.add`/`element.update` so AI edits are undoable (Milestone 4).
- Collaboration: commands are serializable; a future op log can replay them.
