# Roadmap

Milestones are delivered as small, reviewable pull requests. A milestone is complete only when
its acceptance tests pass in CI.

## Milestone 1 — Foundation (in progress)

- [x] pnpm monorepo, strict TypeScript, type-aware ESLint, Prettier, Vitest projects, CI
- [x] Document model with validation, serialization and an explicit migration registry
- [x] Command layer with pure reducer, undo/redo, merge keys, selection
- [x] Fabric.js 7 adapter with pure geometry mapping and loop-safe reconciliation
- [x] Editor shell: top bar, insert sidebar, canvas workspace, properties panel, shortcuts
- [x] First working objects: rectangles, ellipses and text (move, resize, rotate, edit, delete)
- [ ] Alignment guides and snapping _(moved to Milestone 2 with multi-select polish)_

## Milestone 2 — Core editor

- [ ] Image elements, uploads and asset references
- [ ] Group / ungroup, alignment and distribution tools
- [ ] Alignment guides and snapping
- [ ] Layers panel (ordering, lock, visibility, rename)
- [ ] Text polish: font registry, loading states, rich defaults

## Milestone 3 — Projects and export

- [ ] IndexedDB persistence (Dexie) with debounced autosave and explicit save status
- [ ] Project dashboard: create, open, rename, duplicate, delete
- [ ] Native `.opencanvas` import/export with validation and migrations
- [ ] PNG, SVG and PDF export from the document model
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
