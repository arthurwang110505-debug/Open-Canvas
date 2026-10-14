import type { DesignDocument } from '@opencanvas/document';

import { AssetProvider, type AssetProviderProps } from './assets/AssetProvider';
import { EditorProvider } from './EditorProvider';
import { EditorShell } from './EditorShell';

export interface EditorPageProps {
  document: DesignDocument;
  /** Storage and decoding services; omit for the browser defaults. */
  assetServices?: AssetProviderProps['services'];
}

export function EditorPage({ document, assetServices }: EditorPageProps) {
  return (
    <AssetProvider services={assetServices}>
      <EditorProvider document={document}>
        <EditorShell />
      </EditorProvider>
    </AssetProvider>
  );
}
