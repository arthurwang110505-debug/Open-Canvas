import type { DesignDocument } from '@opencanvas/document';

import { AssetProvider, type AssetProviderProps } from './assets/AssetProvider';
import { EditorProvider } from './EditorProvider';
import { EditorShell } from './EditorShell';
import type { PersistenceController } from './persistence';

export interface EditorPageProps {
  document: DesignDocument;
  /** Storage and decoding services; omit for the browser defaults. */
  assetServices?: AssetProviderProps['services'];
  /** Autosave bridge; omit to run without persistence. */
  persistence?: PersistenceController;
}

export function EditorPage({ document, assetServices, persistence }: EditorPageProps) {
  return (
    <AssetProvider services={assetServices}>
      <EditorProvider document={document} persistence={persistence}>
        <EditorShell />
      </EditorProvider>
    </AssetProvider>
  );
}
