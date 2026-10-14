import { Button } from '@opencanvas/ui';
import { X } from 'lucide-react';
import { useEffect } from 'react';

import { useEditor, useEditorStore, useNotification, useNotificationStore } from './hooks';

const AUTO_DISMISS_MS = 6000;

/**
 * Surfaces rejected commands (invalid values, missing targets) and application failures
 * (file import, asset loading) instead of failing silently. A command error takes
 * precedence because it is always the most recent user action.
 */
export function ErrorToast() {
  const commandError = useEditor((state) => state.lastError);
  const notification = useNotification((state) => state.current);
  const store = useEditorStore();
  const notifications = useNotificationStore();

  const dismiss = () => {
    if (commandError) store.getState().clearError();
    else notifications.getState().dismiss();
  };

  useEffect(() => {
    if (!commandError && !notification) return;
    const timer = window.setTimeout(() => {
      if (commandError) store.getState().clearError();
      else notifications.getState().dismiss();
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [commandError, notification, store, notifications]);

  const shown = commandError
    ? { kind: 'error' as const, title: 'Change not applied', message: commandError.message }
    : notification;
  if (!shown) return null;
  return (
    <div
      role={shown.kind === 'error' ? 'alert' : 'status'}
      className="absolute bottom-4 left-1/2 flex max-w-md -translate-x-1/2 items-start gap-2 rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm shadow-lg"
    >
      <div className="flex-1">
        <p className={shown.kind === 'error' ? 'font-medium text-destructive' : 'font-medium'}>
          {shown.title}
        </p>
        <p className="text-muted-foreground">{shown.message}</p>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={dismiss}>
        <X />
      </Button>
    </div>
  );
}
