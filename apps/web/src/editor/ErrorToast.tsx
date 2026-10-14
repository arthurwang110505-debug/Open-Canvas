import { Button } from '@opencanvas/ui';
import { X } from 'lucide-react';
import { useEffect } from 'react';

import { useEditor, useEditorStore } from './hooks';

/** Surfaces rejected commands (invalid values, missing targets) instead of failing silently. */
export function ErrorToast() {
  const error = useEditor((state) => state.lastError);
  const store = useEditorStore();

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => store.getState().clearError(), 6000);
    return () => window.clearTimeout(timer);
  }, [error, store]);

  if (!error) return null;
  return (
    <div
      role="alert"
      className="absolute bottom-4 left-1/2 flex max-w-md -translate-x-1/2 items-start gap-2 rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm shadow-lg"
    >
      <div className="flex-1">
        <p className="font-medium text-destructive">Change not applied</p>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Dismiss"
        onClick={() => store.getState().clearError()}
      >
        <X />
      </Button>
    </div>
  );
}
