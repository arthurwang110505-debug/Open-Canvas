# OpenCanvas

OpenCanvas is an open-source, self-hostable visual design studio — an alternative to Canva for
posters, social media graphics, presentation covers and other visual content.

> **Status: Milestone 3 (Projects and export) — early development.**
> Designs are saved locally in the browser (IndexedDB) with debounced autosave, and a project
> dashboard creates, opens, renames, duplicates and deletes them. The editor works end to end for
> shapes, text, uploaded images and layers (drag-and-drop, cover/fill, snapping guides, align and
> distribute) with undo/redo and keyboard shortcuts. File import/export (`.opencanvas`, PNG, SVG,
> PDF), templates, AI assistance and cloud sync are not implemented yet.
> See [docs/roadmap.md](docs/roadmap.md) for what exists today and what comes next.

## Principles

- **Local-first.** The core editor works without an account, an AI key or any cloud service.
- **Own your documents.** Designs use a versioned, validated JSON format that is independent of
  the rendering engine (Fabric.js is an adapter, not the source of truth).
- **Every control does what it says.** No placeholder buttons; unfinished features are absent,
  not faked.
- **Reviewable and testable.** Small packages with explicit contracts and automated tests.

## Quick start

Requirements: Node.js ≥ 22.12 and pnpm 9 (`corepack enable` installs the pinned version).

```bash
pnpm install
pnpm dev          # http://localhost:5173 — project dashboard, then the editor
```

Designs are stored in this browser only (IndexedDB via Dexie, with a volatile in-memory fallback
when IndexedDB is unavailable). Nothing is uploaded anywhere.

Quality gates (the CI definition lives in [`docs/ci/github-actions-ci.yml`](docs/ci/github-actions-ci.yml);
copy it to `.github/workflows/ci.yml` — the automation account that opened the first PR is not
allowed to create workflow files):

```bash
pnpm typecheck    # strict TypeScript across all packages
pnpm lint         # type-aware ESLint, zero warnings allowed
pnpm test         # Vitest (unit + jsdom integration)
pnpm build        # production build of apps/web
pnpm check        # all of the above plus formatting
```

## Repository layout

| Path                     | Purpose                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `apps/web`               | React + Vite application: project dashboard, hash routing, editor shell, canvas workspace, panels. |
| `packages/document`      | Canonical document model: Zod schemas, factories, serialization, explicit schema migrations.       |
| `packages/editor-core`   | Editing engine: command vocabulary, pure reducer, undo/redo history, selection, zoom helpers.      |
| `packages/canvas-fabric` | Fabric.js 7 adapter: renders a page, syncs selection/ordering, translates interactions to patches. |
| `packages/storage`       | Project store (IndexedDB + memory), asset blob stores, autosave scheduling, image import.          |
| `packages/ui`            | Shared accessible UI primitives (shadcn/ui-style, Tailwind CSS v4 design tokens).                  |
| `docs`                   | Architecture notes and roadmap.                                                                    |

Planned (not yet present): `apps/api`, `packages/export`, `packages/ai-core`, `templates`,
`tests` (Playwright).

## Architecture in one paragraph

User actions dispatch **commands** (`element.add`, `element.update`, `document.resize`, …) to a
pure reducer in `editor-core`. The reducer validates the result against the document schema and
returns a new immutable document; the store keeps snapshots for undo/redo. The Fabric adapter
subscribes to the store and reconciles canvas objects by element id. Canvas interactions
(drag/resize/rotate/text edits) come back as commands — never as direct state writes — so history,
future autosave and AI edits all share one path. Details: [docs/architecture.md](docs/architecture.md).

## Keyboard shortcuts

| Action                      | Keys                                              |
| --------------------------- | ------------------------------------------------- |
| Save now                    | `Ctrl/⌘ S` (autosave runs on its own)             |
| Undo / Redo                 | `Ctrl/⌘ Z` · `Ctrl/⌘ Shift Z`, `Ctrl Y`           |
| Delete selection            | `Delete` / `Backspace`                            |
| Duplicate                   | `Ctrl/⌘ D`                                        |
| Select all / clear          | `Ctrl/⌘ A` · `Esc`                                |
| Nudge (×10 with Shift)      | Arrow keys                                        |
| Bring forward / send back   | `Ctrl/⌘ ]` · `Ctrl/⌘ [` (+ `Shift` = front/back)  |
| Zoom in / out / fit / 100 % | `Ctrl/⌘ +` · `Ctrl/⌘ −` · `Ctrl/⌘ 0` · `Ctrl/⌘ 1` |
| Zoom at pointer / pan       | `Ctrl/⌘ + wheel` · wheel / trackpad               |

## License

OpenCanvas is licensed under the [GNU Affero General Public License v3.0](LICENSE). You may use,
inspect, modify and redistribute it under the terms of that license; network deployments must
offer the corresponding source to their users.
