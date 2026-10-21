import type { DesignDocument } from '@opencanvas/document';

import { AssetProvider, type AssetProviderProps } from './assets/AssetProvider';
import { EditorProvider } from './EditorProvider';
import { EditorShell } from './EditorShell';
import { DrawProvider } from './draw/DrawProvider';
import { ExportProvider } from './export/ExportProvider';
import type { ExportServices } from './export/ExportServices';
import type { PersistenceController } from './persistence';

export interface EditorPageProps {
  document: DesignDocument;
  /** Storage and decoding services; omit for the browser defaults. */
  assetServices?: AssetProviderProps['services'];
  /** Rasterizing, measuring and download steps; omit for the browser defaults. */
  exportServices?: Partial<ExportServices>;
  /** Autosave bridge; omit to run without persistence. */
  persistence?: PersistenceController;
}

export function EditorPage({
  document,
  assetServices,
  exportServices,
  persistence,
}: EditorPageProps) {
  return (
    <AssetProvider services={assetServices}>
      <ExportProvider services={exportServices}>
        <EditorProvider document={document} persistence={persistence}>
          <DrawProvider>
            <EditorShell />
          </DrawProvider>
        </EditorProvider>
      </ExportProvider>
    </AssetProvider>
  );
}
