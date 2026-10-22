# @opencanvas/icons

The icon catalogue behind the `icon` element. 372 icons on a 24×24 grid, generated from
[Lucide](https://lucide.dev) (ISC licence) and committed as data.

```ts
import { getIcon, searchIcons, shapeToSvg, iconShapeToPathData } from '@opencanvas/icons';

getIcon('heart'); // shape data, family and keywords, or undefined
searchIcons('money'); // ranked by name, then keyword
```

Nothing here imports React or Fabric: the editor draws the shapes as SVG, the canvas adapter turns
them into Fabric paths (`iconShapeToPathData`), and the exporter emits them natively. That shared
`shapes` array is why an icon looks the same in the panel, on the canvas and in a downloaded file.

## Why data instead of components

Documents store `{ iconId, color, strokeWidth }` — about 80 bytes per icon — and look the geometry
up at render time. A React icon component cannot be used in `packages/export` (it renders in Node,
without React or a DOM), and an image asset would make icons blurry and un-recolourable.

## Regenerating

```bash
node scripts/generate-icons.mjs
```

The script reads the icon set installed in `apps/web`, resolves Lucide's deprecated aliases
(`home` → `house`), strips the React wrapper, and writes `src/data.ts`. It takes a curated list —
the `CATALOGUE` constant in the script — rather than all 2 000+ icons, because a design tool needs
icons that sit well next to text and shapes. Add an entry there, run the script, and commit both
files.
