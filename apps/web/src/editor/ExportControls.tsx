import { Button } from '@opencanvas/ui';
import { Download, LoaderCircle } from 'lucide-react';
import { useState } from 'react';

import { ExportDialog } from './ExportDialog';
import { useDesignExport } from './export/useDesignExport';

/**
 * One primary download action. It opens the download dialog, where the format, page scope,
 * and output dimensions are confirmed before anything is rendered.
 */
export function ExportControls() {
  const { busy, exportDesign } = useDesignExport();
  const [open, setOpen] = useState(false);

  // An in-flight export owns the dialog: dismissing it would hide the progress and result.
  const handleClose = () => {
    if (busy === null) setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={busy !== null}
        className="rounded-full px-2.5 sm:px-3"
        aria-label="Download"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : <Download aria-hidden="true" />}
        <span className="hidden sm:inline">{busy ? 'Preparing…' : 'Download'}</span>
      </Button>
      {open ? <ExportDialog busy={busy} onExport={exportDesign} onClose={handleClose} /> : null}
    </>
  );
}
