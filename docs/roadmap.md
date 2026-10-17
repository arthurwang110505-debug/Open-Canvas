# Roadmap

Milestones are delivered as small, reviewable pull requests. A milestone is complete only when
its acceptance tests pass in CI.

## Milestone 1 — Foundation (done)

- [x] pnpm monorepo, strict TypeScript, type-aware ESLint, Prettier, Vitest projects, CI
- [x] Document model with validation, serialization and an explicit migration registry
- [x] Command layer with pure reducer, undo/redo, merge keys, selection
- [x] Fabric.js 7 adapter with pure geometry mapping and loop-safe reconciliation
- [x] Editor shell: top bar, insert sidebar, canvas workspace, properties panel, shortcuts
- [x] First working objects: rectangles, ellipses and text (move, resize, rotate, edit, delete)
- [x] Alignment guides and snapping _(delivered in Milestone 2)_

## Milestone 2 — Core editor

- [x] Image elements, uploads and asset references (document assets map, `image` element with
      cover/fill, `@opencanvas/storage` import pipeline, Uploads panel, drag-and-drop)
- [x] Alignment guides and snapping (Fabric `AligningGuidelines`, toggle in the top bar)
- [x] Alignment and distribution tools (`alignElements` / `distributeElements` in `editor-core`;
      align to the page for one element, to the selection box for several)
- [x] Layers panel (top-most first; click / Ctrl-click / Shift-click selection, drag-and-drop
      ordering, bracket shortcuts, per-element lock, visibility and inline rename)
- [ ] Group / ungroup (needs nested element ids, relative coordinates and group transforms in
      the document model — deliberately a separate slice)
- [x] IndexedDB-backed image blobs (asset bytes live next to their project and survive reloads)
- [ ] Image polish: `contain` fit, manual crop, replace image
- [ ] Text polish: font registry, loading states, rich defaults

## Milestone 3 — Projects and export (in progress)

- [x] IndexedDB persistence (Dexie) with debounced autosave and explicit save status
- [x] Project dashboard: create (canvas presets), open, rename, duplicate, delete
- [x] Native `.opencanvas` import/export with validation and migrations (ZIP container: manifest,
      canonical `document.json`, asset bytes; id collisions import as a copy)
- [x] PNG, SVG and PDF export from the document model (`packages/export`; raster PDF, vector SVG)
- [ ] Template registry seeded with ≥ 12 original templates and documented licenses

## Milestone 4 — AI assistant

- [ ] Provider abstraction (hosted service + user-supplied keys stored locally)
- [ ] Structured design generation validated against the schema, with preview and confirmation
- [ ] Undoable AI edits through the command layer; clear disclosure of data sent to providers

## Milestone 5 — Cloud (optional)

- [ ] `apps/api`: authentication, user-owned projects, S3-compatible asset storage
- [ ] Offline-aware sync with versioning, optimistic concurrency and conflict preservation

## Milestone 6 — Release

- [ ] Playwright end-to-end suite, accessibility and performance checks
- [ ] Docker / Docker Compose deployment and security review
- [ ] Contribution guide and complete documentation
