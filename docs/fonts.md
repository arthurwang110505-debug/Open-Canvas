# Bundled fonts

OpenCanvas ships its typefaces with the app. There is no Google Fonts request, no CDN, no account
and no network access at runtime: every family below is served from the same origin as the editor
and embedded into exported files.

## The library

| Family              | Category    | Weights  | Files                    |
| ------------------- | ----------- | -------- | ------------------------ |
| Inter               | Sans serif  | 100–900  | variable, roman + italic |
| DM Sans             | Sans serif  | 100–1000 | variable, roman + italic |
| Manrope             | Sans serif  | 200–800  | variable, roman          |
| Space Grotesk       | Sans serif  | 300–700  | variable, roman          |
| Sora                | Sans serif  | 100–800  | variable, roman          |
| Archivo             | Sans serif  | 100–900  | variable, roman + italic |
| Outfit              | Sans serif  | 100–900  | variable, roman          |
| Bricolage Grotesque | Sans serif  | 200–800  | variable, roman          |
| Oswald              | Sans serif  | 200–700  | variable, roman          |
| Playfair Display    | Serif       | 400–900  | variable, roman + italic |
| Fraunces            | Serif       | 100–900  | variable, roman + italic |
| DM Serif Display    | Serif       | 400      | static, roman + italic   |
| Instrument Serif    | Serif       | 400      | static, roman + italic   |
| Libre Baskerville   | Serif       | 400, 700 | static, roman + italic   |
| Caveat              | Handwriting | 400–700  | variable, roman          |

All 15 families are licensed under the [SIL Open Font License 1.1](https://openfontlicense.org)
and are distributed by [Fontsource](https://fontsource.org). Each package keeps its own `LICENSE`
file under `node_modules/@fontsource*`; the copyright line lives in that file and in
`packages/document`'s build inputs are unaffected — OpenCanvas stores only a family name, so
documents never embed licence-bearing font data themselves.

Latin and latin-ext subsets are used; text in other scripts falls back to the reader's system
fonts, exactly as it does on the canvas.

## How a font reaches the canvas and the file

```
apps/web/src/fonts/catalog.ts   one registry: family → weights + woff2 URLs
        │
        ├─ install.ts  → @font-face rules added once at startup (editor rendering)
        │
        └─ embed.ts    → fetch + base64 the faces a page uses
                         │
                         └─ export: <defs><style>@font-face{src:url(data:font/woff2;base64,…)}</style></defs>
```

- The editor loads a family the first time it is drawn; unused families cost nothing.
- Canvas text is re-measured when fonts finish loading (`loadingdone`), so a newly chosen family
  does not keep fallback metrics.
- Exports wait for the faces (`document.fonts.load`) before measuring wrapped lines, then inline
  only the families and weights actually used. The SVG therefore renders the same offline, on
  another machine, and when the PNG/PDF pipeline rasterizes it through `<img>`.
- A bundled family whose bytes cannot be read fails the export with a message naming the family.
  Falling back to a different typeface silently would be worse than an error.
- Legacy documents that name a system font (Arial, Georgia, …) still open and export by name; the
  file simply asks the viewer for that font.

## Adding a family

1. `pnpm --filter @opencanvas/web add @fontsource-variable/<family>` (or `@fontsource/<family>` for
   a static cut).
2. Add the `?url` imports and a `variableFont(...)` / `staticFont(...)` entry to
   [`apps/web/src/fonts/catalog.ts`](../apps/web/src/fonts/catalog.ts) — that is the only place
   that needs to change; the picker, the editor stylesheet and export embedding all read it.
3. Add the family to the table above with its licence and weight range.
