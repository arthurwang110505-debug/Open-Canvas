import type { DesignDocument } from '@opencanvas/document';

import { AssetProvider, type AssetProviderProps } from './assets/AssetProvider';
import type { EditorContextValue } from './EditorContext';
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
  /** Saves a resized copy as a new design; omit when there is no project store. */
  onCreateResizedCopy?: EditorContextValue['onCreateResizedCopy'];
}

export function EditorPage({
  document,
  assetServices,
  exportServices,
  persistence,
  onCreateResizedCopy,
}: EditorPageProps) {
  return (
    <AssetProvider services={assetServices}>
      <ExportProvider services={exportServices}>
        <EditorProvider
          document={document}
          persistence={persistence}
          onCreateResizedCopy={onCreateResizedCopy}
        >
          <DrawProvider>
            <EditorShell />
          </DrawProvider>
        </EditorProvider>
      </ExportProvider>
    </AssetProvider>
  );
}
