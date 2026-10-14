import { createBlankDocument } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { useState } from 'react';

import { EditorPage } from './editor/EditorPage';

/**
 * Milestone 1 boots straight into the editor with a fresh document. The project dashboard,
 * routing and persistence arrive with Milestone 3.
 */
export function App() {
  const [initialDocument] = useState(() => createBlankDocument({ name: 'Untitled design' }));
  return (
    <TooltipProvider>
      <EditorPage document={initialDocument} />
    </TooltipProvider>
  );
}
