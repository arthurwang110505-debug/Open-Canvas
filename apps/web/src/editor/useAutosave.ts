import { useEffect } from 'react';

import { useEditorStore, useNotificationStore, usePersistence } from './hooks';

/**
 * Connects the editor store to autosave: every change schedules a debounced write, and a
 * failed write is reported through the same notification channel as other failures.
 */
export function useAutosave(): void {
  const editor = useEditorStore();
  const notifications = useNotificationStore();
  const persistence = usePersistence();

  useEffect(() => {
    persistence.attach(editor);
    return () => persistence.detach();
  }, [persistence, editor]);

  useEffect(() => {
    // Keyed on the message rather than the status: the autosaver publishes the failure reason
    // and the status change in two separate updates.
    return persistence.state.subscribe((current, previous) => {
      if (!current.errorMessage || current.errorMessage === previous.errorMessage) return;
      notifications.getState().show({
        kind: 'error',
        title: 'Changes not saved',
        message: current.errorMessage,
      });
    });
  }, [persistence, notifications]);
}
