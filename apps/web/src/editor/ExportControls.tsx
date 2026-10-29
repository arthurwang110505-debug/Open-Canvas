import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '@opencanvas/ui';
import { Download, FileImage, FileText, LoaderCircle, PenTool } from 'lucide-react';

import { RASTER_SCALE, useDesignExport, type ExportKind } from './export/useDesignExport';

interface Format {
  kind: ExportKind;
  /** Menu label — the accessible name stays "Export PNG" and friends. */
  label: string;
  hint: string;
  icon: React.ReactNode;
  description: string;
}

const FORMATS: readonly Format[] = [
  {
    kind: 'png',
    label: 'Export PNG',
    hint: `${RASTER_SCALE}×`,
    icon: <FileImage />,
    description: `Image · current page at ${RASTER_SCALE}×`,
  },
  {
    kind: 'svg',
    label: 'Export SVG',
    hint: 'vector',
    icon: <PenTool />,
    description: 'Vector · current page',
  },
  {
    kind: 'pdf',
    label: 'Export PDF',
    hint: 'print',
    icon: <FileText />,
    description: 'Document · all pages',
  },
];

/**
 * One primary download action instead of three competing buttons. Each entry performs the
 * same export the individual buttons used to, and reports progress in place.
 */
export function ExportControls() {
  const { busy, exportPng, exportSvg, exportPdf } = useDesignExport();
  const run = { png: exportPng, svg: exportSvg, pdf: exportPdf };

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          className="rounded-full px-2.5 sm:px-3"
          aria-label="Download"
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <Download aria-hidden="true" />}
          <span className="hidden sm:inline">{busy ? 'Preparing…' : 'Download'}</span>
        </Button>
      </MenuTrigger>
      <MenuContent align="end" aria-label="Download formats">
        <MenuLabel>Download</MenuLabel>
        {FORMATS.map((format) => (
          <MenuItem
            key={format.kind}
            aria-label={format.label}
            icon={format.icon}
            hint={busy === format.kind ? '…' : format.hint}
            onSelect={() => void run[format.kind]()}
          >
            <span className="flex flex-col">
              <span>{format.label.replace('Export ', '')}</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {format.description}
              </span>
            </span>
          </MenuItem>
        ))}
        <MenuSeparator />
        <p className="px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          PNG and SVG export the current page. PDF includes every page. Raster downloads use{' '}
          {RASTER_SCALE}× resolution.
        </p>
      </MenuContent>
    </Menu>
  );
}
