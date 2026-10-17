# Template licensing

Every template in this directory is an **original work created for OpenCanvas**. They are
licensed under the same terms as the rest of the repository: **AGPL-3.0-only** (see
[`../LICENSE`](../LICENSE)).

## What a template contains

A template definition is plain data: canvas size, a background colour and a list of rectangles,
ellipses and text runs with their geometry and typography. Concretely, that means:

- **No binary assets.** No template ships a photograph, illustration, icon file or font file, and
  `instantiateTemplate()` produces a document whose `assets` map is empty. There is nothing here
  that could carry a third-party license.
- **No third-party artwork.** All shapes, layouts, colour pairings and placeholder copy were
  written for this repository. Placeholder text is generic filler (fictional shop, café, studio
  and event names, `example`-domain URLs) and is not copied from any real campaign.
- **Fonts are referenced by family name only.** Templates name families the app can already
  render without a download: `Inter` (bundled with the app under SIL Open Font License 1.1) plus
  common system families (`Arial`, `Helvetica`, `Georgia`, `Times New Roman`, `Courier New`,
  `Verdana`, `Trebuchet MS`). No font file is redistributed here; whether a named family resolves
  depends on the fonts installed on the machine running OpenCanvas, and the editor tells the user
  when a family is unavailable.

## Colours

Hex colours used in the templates are plain values chosen for these layouts. Colour values are not
copyrightable, and none of them is a claim about a trademark or brand palette. The names
("Northwind", "The Daily Grind", "Riverside Sessions") are invented placeholders.

## Adding a template

A new template must keep these properties: shapes and text only, colours as hex values, fonts from
`TEMPLATE_FONT_FAMILIES`, and copy you wrote yourself. `templates/src/templates.test.ts` enforces
the structural part of this (no image elements, valid ids, sizes and colours inside the document
model's limits, valid fonts, and a document that passes schema validation).

If a template ever needs a real image — a photo background, an illustration, a logo — it has to be
added as a documented, separately licensed asset with its source and license recorded here, not
embedded silently in a definition.
