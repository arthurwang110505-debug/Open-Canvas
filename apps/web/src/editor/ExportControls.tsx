import { Button, Tooltip } from '@opencanvas/ui';
import { Download, LoaderCircle } from 'lucide-react';

import { RASTER_SCALE, useDesignExport, type ExportKind } from './export/useDesignExport';

const FORMATS: readonly { kind: ExportKind; label: string; hint: string }[] = [
  { kind: 'png', label: 'PNG', hint: `PNG image at ${RASTER_SCALE}× resolution` },
  { kind: 'svg', label: 'SVG', hint: 'SVG vector file (text stays editable)' },
  { kind: 'pdf', label: 'PDF', hint: `PDF with every page rendered at ${RASTER_SCALE}×` },
];

/** Downloads the current design as PNG, SVG or PDF. Each button performs its export. */
export function ExportControls() {
  const { busy, exportPng, exportSvg, exportPdf } = useDesignExport();
  const run = { png: exportPng, svg: exportSvg, pdf: exportPdf };

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Export">
      {FORMATS.map((format) => (
        <Tooltip
          key={format.kind}
          content={busy === format.kind ? 'Preparing the file…' : format.hint}
        >
          <Button
            variant="outline"
            size="sm"
            aria-label={`Export ${format.label}`}
            disabled={busy !== null}
            onClick={() => void run[format.kind]()}
            className="rounded-full"
          >
            {busy === format.kind ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Download aria-hidden="true" />
            )}
            {format.label}
          </Button>
        </Tooltip>
      ))}
    </div>
  );
}
