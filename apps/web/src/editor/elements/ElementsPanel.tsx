import { IconPreview } from '../panels/IconPicker';
import { popularIcons, searchIcons } from '@opencanvas/icons';
import { Button, EmptyState, SearchField, cn } from '@opencanvas/ui';
import {
  BarChart3,
  Camera,
  ChartLine,
  ChartPie,
  Columns3,
  Grid2x2,
  Grid3x3,
  LayoutGrid,
  Link2,
  Rows2,
  Search,
  Table2,
} from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';

import { BUNDLED_PHOTO_LICENCE, searchBundledPhotos } from '../../assets/photos/catalog';
import { useEditorActions } from '../actions';
import { useImageImport } from '../assets/useImageImport';
import { elementDragProps } from '../elements/drag';
import { CHART_ITEMS, matchChart } from '../elements/charts';
import { GRID_ITEMS, matchGrid } from '../elements/grids';
import { FRAME_ITEMS, matchFrame, matchShape, SHAPE_ITEMS } from '../elements/shapeItems';

/** How many icons one screen of results shows before asking the user to narrow it down. */
const ICON_PAGE = 96;

/** Photos shown in the unfiltered "All" view; the Photos chip shows the whole match set. */
const PHOTO_PREVIEW = 8;

type Category = 'all' | 'shapes' | 'frames' | 'charts' | 'grids' | 'tables' | 'icons' | 'photos';

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'frames', label: 'Frames' },
  { id: 'charts', label: 'Charts' },
  { id: 'grids', label: 'Grids' },
  { id: 'tables', label: 'Tables' },
  { id: 'icons', label: 'Icons' },
  { id: 'photos', label: 'Photos' },
];

const CHART_ICONS: Record<string, React.ReactNode> = {
  bar: <BarChart3 className="size-6" />,
  pie: <ChartPie className="size-6" />,
  line: <ChartLine className="size-6" />,
};

const GRID_ICONS: Record<string, React.ReactNode> = {
  'grid-2x2': <Grid2x2 className="size-6" />,
  'grid-3x3': <Grid3x3 className="size-6" />,
  'grid-strip-3': <Columns3 className="size-6" />,
  'grid-duo': <Rows2 className="size-6" />,
};

/**
 * The library: one search across shapes and icons, one place to drag from. Everything listed
 * here exists — there are no placeholder tiles for libraries that have not shipped yet.
 */
export function ElementsPanel() {
  const { addShape, addFrame, addChart, addGrid, addTable, addIcon } = useEditorActions();
  const { insertPhoto, importUrl } = useImageImport();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [licenceOpen, setLicenceOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const deferredQuery = useDeferredValue(query);

  const photos = useMemo(
    () =>
      category === 'shapes' ||
      category === 'icons' ||
      category === 'frames' ||
      category === 'charts' ||
      category === 'grids' ||
      category === 'tables'
        ? []
        : searchBundledPhotos(deferredQuery).slice(
            0,
            category === 'photos' ? Number.POSITIVE_INFINITY : PHOTO_PREVIEW,
          ),
    [category, deferredQuery],
  );

  const shapes = useMemo(
    () =>
      category === 'icons' ||
      category === 'frames' ||
      category === 'charts' ||
      category === 'grids' ||
      category === 'tables'
        ? []
        : SHAPE_ITEMS.filter((item) => matchShape(item, deferredQuery)),
    [category, deferredQuery],
  );
  const frames = useMemo(
    () =>
      category === 'icons' ||
      category === 'shapes' ||
      category === 'charts' ||
      category === 'grids' ||
      category === 'tables'
        ? []
        : FRAME_ITEMS.filter((item) => matchFrame(item, deferredQuery)),
    [category, deferredQuery],
  );
  const charts = useMemo(
    () =>
      category === 'icons' ||
      category === 'shapes' ||
      category === 'frames' ||
      category === 'grids' ||
      category === 'tables'
        ? []
        : CHART_ITEMS.filter((item) => matchChart(item, deferredQuery)),
    [category, deferredQuery],
  );
  const grids = useMemo(
    () =>
      category === 'icons' ||
      category === 'shapes' ||
      category === 'frames' ||
      category === 'charts' ||
      category === 'tables'
        ? []
        : GRID_ITEMS.filter((item) => matchGrid(item, deferredQuery)),
    [category, deferredQuery],
  );
  const tables = useMemo(() => {
    if (
      category === 'icons' ||
      category === 'shapes' ||
      category === 'frames' ||
      category === 'charts' ||
      category === 'grids'
    )
      return [];
    const q = deferredQuery.trim().toLowerCase();
    return q.length === 0 || 'table'.includes(q) || q.includes('table') ? [true] : [];
  }, [category, deferredQuery]);
  const icons = useMemo(() => {
    if (
      category === 'shapes' ||
      category === 'frames' ||
      category === 'charts' ||
      category === 'grids' ||
      category === 'tables'
    )
      return [];
    const term = deferredQuery.trim();
    // Before anyone types, lead with the icons a page actually uses; an alphabetical dump of 372
    // is not a library, it is a directory.
    if (term.length === 0) {
      const popular = popularIcons();
      const seen = new Set(popular.map((entry) => entry.id));
      const rest = searchIcons('').filter((entry) => !seen.has(entry.id));
      return [...popular, ...rest];
    }
    return searchIcons(term);
  }, [category, deferredQuery]);
  const visibleIcons = icons.slice(0, ICON_PAGE);

  const nothingMatches =
    shapes.length === 0 &&
    frames.length === 0 &&
    charts.length === 0 &&
    grids.length === 0 &&
    tables.length === 0 &&
    icons.length === 0 &&
    photos.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <SearchField
        placeholder="Search elements"
        aria-label="Search elements"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onClear={() => setQuery('')}
        clearLabel="Clear element search"
        className="h-9 rounded-full bg-muted/60 text-sm"
      />

      <div className="flex flex-wrap gap-1" role="group" aria-label="Element categories">
        {CATEGORIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={category === entry.id}
            onClick={() => setCategory(entry.id)}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              category === entry.id
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {shapes.length > 0 && (
        <section aria-label="Shapes" className="flex flex-col gap-2">
          {category === 'all' && (
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <LayoutGrid className="size-3" /> Shapes
            </h3>
          )}
          <div className="grid grid-cols-4 gap-2">
            {shapes.map((item) => (
              <Button
                key={item.kind}
                variant="outline"
                aria-label={item.label}
                title={`${item.label} — click or drag onto the canvas`}
                className="h-16 flex-col gap-1 rounded-xl p-1 text-[10px] font-normal hover:border-primary/30 hover:bg-primary/[0.04]"
                onClick={() => addShape(item.kind)}
                {...elementDragProps({ kind: 'shape', shape: item.kind })}
              >
                {item.icon}
                <span className="w-full truncate text-center">{item.label}</span>
              </Button>
            ))}
          </div>
        </section>
      )}

      {frames.length > 0 && (
        <section aria-label="Frames" className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <LayoutGrid className="size-3" /> Frames
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {frames.map((item) => (
              <Button
                key={item.kind}
                variant="outline"
                aria-label={item.label}
                title={`${item.label} — drop a photo on it to fill`}
                className="h-16 flex-col gap-1 rounded-xl p-1 text-[10px] font-normal hover:border-primary/30 hover:bg-primary/[0.04]"
                onClick={() => addFrame(item.kind)}
                {...elementDragProps({ kind: 'frame', frame: item.kind })}
              >
                {item.icon}
                <span className="w-full truncate text-center">{item.label}</span>
              </Button>
            ))}
          </div>
        </section>
      )}

      {charts.length > 0 && (
        <section aria-label="Charts" className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <BarChart3 className="size-3" /> Charts
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {charts.map((item) => (
              <Button
                key={item.kind}
                variant="outline"
                aria-label={item.label}
                title={`${item.label} — ${item.description}`}
                className="h-16 flex-col gap-1 rounded-xl p-1 text-[10px] font-normal hover:border-primary/30 hover:bg-primary/[0.04]"
                onClick={() => addChart(item.kind)}
                {...elementDragProps({ kind: 'chart', chart: item.kind })}
              >
                {CHART_ICONS[item.kind]}
                <span className="w-full truncate text-center">{item.label}</span>
              </Button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Charts insert as one group. Ungroup to edit bars, slices, or points individually.
          </p>
        </section>
      )}

      {grids.length > 0 && (
        <section aria-label="Grids" className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <LayoutGrid className="size-3" /> Grids
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {grids.map((item) => (
              <Button
                key={item.kind}
                variant="outline"
                aria-label={item.label}
                title={`${item.label} — ${item.description}`}
                className="h-16 flex-col gap-1 rounded-xl p-1 text-[10px] font-normal hover:border-primary/30 hover:bg-primary/[0.04]"
                onClick={() => addGrid(item.kind)}
                {...elementDragProps({ kind: 'grid', grid: item.kind })}
              >
                {GRID_ICONS[item.kind]}
                <span className="w-full truncate text-center">{item.label}</span>
              </Button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Drop a photo onto any cell to fill it. The grid moves as one group.
          </p>
        </section>
      )}

      {tables.length > 0 && (
        <section aria-label="Tables" className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Table2 className="size-3" /> Tables
          </h3>
          <div className="grid grid-cols-4 gap-2">
            <Button
              variant="outline"
              aria-label="Table"
              title="Table — a 4×3 table with a header row. Edit cells in Properties."
              className="h-16 flex-col gap-1 rounded-xl p-1 text-[10px] font-normal hover:border-primary/30 hover:bg-primary/[0.04]"
              onClick={() => addTable()}
              {...elementDragProps({ kind: 'table' })}
            >
              <Table2 className="size-6" />
              <span className="w-full truncate text-center">Table</span>
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Edit cell text in Properties. The table moves as one group.
          </p>
        </section>
      )}

      {photos.length > 0 && (
        <section aria-label="Photos" className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Camera className="size-3" /> Photos
          </h3>
          <div className="grid grid-cols-2 gap-2" role="listbox" aria-label="Photos">
            {photos.map((photo) => (
              <Button
                key={photo.id}
                variant="outline"
                role="option"
                aria-selected={false}
                aria-label={`Insert photo ${photo.title}`}
                title={photo.title}
                className="h-16 overflow-hidden rounded-xl p-0 hover:border-primary/30"
                onClick={() => insertPhoto(photo.id)}
                {...elementDragProps({ kind: 'photo', photoId: photo.id })}
              >
                <img
                  src={photo.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={photo.width}
                  height={photo.height}
                  className="size-full object-cover"
                />
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
            <span>{BUNDLED_PHOTO_LICENCE.name} · no attribution needed</span>
            <button
              type="button"
              aria-expanded={licenceOpen}
              onClick={() => setLicenceOpen((open) => !open)}
              className="rounded underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              See licence
            </button>
          </div>
          {licenceOpen ? (
            <p role="note" className="rounded-lg bg-muted/60 p-2 text-[11px] leading-relaxed">
              {BUNDLED_PHOTO_LICENCE.summary}{' '}
              <a
                href={BUNDLED_PHOTO_LICENCE.href}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Read the {BUNDLED_PHOTO_LICENCE.name} licence
              </a>
              . Photos are stored in the app, so they keep working offline and are never uploaded.
            </p>
          ) : null}
          <div className="flex gap-1.5">
            <label htmlFor="elements-photo-url" className="sr-only">
              Image URL
            </label>
            <input
              id="elements-photo-url"
              type="url"
              value={photoUrl}
              placeholder="Paste an image link…"
              onChange={(event) => setPhotoUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && photoUrl.trim()) {
                  void importUrl(photoUrl);
                  setPhotoUrl('');
                }
              }}
              className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              disabled={!photoUrl.trim()}
              onClick={() => {
                void importUrl(photoUrl);
                setPhotoUrl('');
              }}
            >
              <Link2 aria-hidden="true" /> Add
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            The image is downloaded and stored with this design, so it keeps working offline.
          </p>
        </section>
      )}

      {visibleIcons.length > 0 && (
        <section aria-label="Icons" className="flex flex-col gap-2">
          <h3 className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Icons</span>
            <span className="font-normal normal-case tracking-normal">
              {icons.length} {deferredQuery.trim() ? 'match' : 'icons'}
            </span>
          </h3>
          <div className="grid grid-cols-4 gap-2" role="listbox" aria-label="Icons">
            {visibleIcons.map((icon) => (
              <Button
                key={icon.id}
                variant="outline"
                role="option"
                aria-selected={false}
                aria-label={`Insert ${icon.id.replace(/-/g, ' ')}`}
                title={icon.id}
                className="h-14 flex-col gap-0.5 rounded-xl p-1 text-[10px] font-normal text-muted-foreground hover:border-primary/30"
                onClick={() => addIcon(icon.id)}
                {...elementDragProps({ kind: 'icon', iconId: icon.id })}
              >
                <IconPreview iconId={icon.id} className="size-6" />
                <span className="w-full truncate text-center">{icon.id.replace(/-/g, ' ')}</span>
              </Button>
            ))}
          </div>
          {icons.length > visibleIcons.length ? (
            <p className="text-[11px] text-muted-foreground">
              Showing the first {visibleIcons.length} of {icons.length} — type to narrow the list.
            </p>
          ) : null}
        </section>
      )}

      {nothingMatches ? (
        <EmptyState
          icon={<Search />}
          titleAs="h3"
          title={`No elements match “${query}”.`}
          description="Try a broader keyword or clear the search and category filters."
          className="px-4 py-6"
          action={
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setQuery('');
                setCategory('all');
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : null}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Drag onto the page to place it where you drop it, or click to add it in the middle. Press{' '}
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">R</kbd> for a rectangle,{' '}
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">O</kbd> for an ellipse,{' '}
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">T</kbd> for text.
      </p>
    </div>
  );
}
