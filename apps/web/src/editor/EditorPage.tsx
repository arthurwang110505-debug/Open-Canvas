import type { DesignDocument } from '@opencanvas/document';

import { EditorProvider } from './EditorProvider';
import { EditorShell } from './EditorShell';

export interface EditorPageProps {
  document: DesignDocument;
}

export function EditorPage({ document }: EditorPageProps) {
  return (
    <EditorProvider document={document}>
      <EditorShell />
    </EditorProvider>
  );
}
