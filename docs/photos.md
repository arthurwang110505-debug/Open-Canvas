# Bundled photos

The editor ships a small photo library in `apps/web/src/assets/photos/`. A photo can be dropped
on the page from **Elements → Photos** (or clicked to add it in the middle), and it becomes a
normal image element: crop, fit, filters, flip, layering and export all work the same way as for
an upload.

## Licence

Every bundled photo was made for this project and is dedicated to the public domain under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). You can use them in commercial
work, modify them and redistribute them without attribution. The panel shows the licence next to
the library — it is not hidden in a file nobody opens.

Photos are served from the app bundle itself. Nothing is fetched from a CDN, nothing is uploaded,
and a design that uses a photo keeps working offline.

## How a document references a photo

Documents never store photo bytes. The asset record points at the catalogue id:

```json
{
  "id": "asset_3f9c",
  "kind": "image",
  "name": "Alpine lake",
  "mimeType": "image/webp",
  "width": 1408,
  "height": 768,
  "source": { "type": "bundled", "photoId": "alpine-lake" }
}
```

That has three consequences worth knowing:

- **Small project files.** A `.opencanvas` archive contains bytes for `local` uploads only; url and
  bundled assets are references, so a photo-heavy design stays small.
- **Reuse is free.** Inserting the same photo twice registers one asset and one copy in the page;
  undo removes the element, not the shared asset.
- **An older build degrades honestly.** A `photoId` that build does not ship resolves to nothing
  and the element is reported as a missing image; the document is not rewritten.

## Adding a photo

1. Put a WebP in `apps/web/src/assets/photos/` (1400 px on the long edge keeps the bundle small;
   the converter used here was `convert in.jpg -strip -quality 78 -define webp:method=6 out.webp`).
2. Add an entry to `BUNDLED_PHOTOS` in `apps/web/src/assets/photos/catalog.ts` with a slug `id`
   (never rename a shipped id), a title, 4–6 search tags and the real pixel size.
3. Run `pnpm test`. `catalog.test.ts` checks ids, dimensions and search; the panel and the
   bundler pick the photo up automatically.

There is no build step that generates thumbnails: the panel shows the WebP itself with
`loading="lazy"`, so a library of any size costs only the tiles on screen.
