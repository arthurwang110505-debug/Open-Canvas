import { createStore, type StoreApi } from 'zustand/vanilla';

export interface NotificationAction {
  /** What the button says. */
  label: string;
  /**
   * What it is called to assistive technology.
   *
   * The toolbar already has an "Undo"; two controls with the same name and different scope is
   * exactly the ambiguity a screen-reader user cannot resolve, so the toast says which undo.
   */
  ariaLabel?: string;
  run: () => void;
}

export interface AppNotification {
  kind: 'error' | 'info';
  title: string;
  message: string;
  /**
   * One thing the user can do about it, right where they are looking.
   *
   * A destructive change that only says "deleted" makes people reach for Ctrl Z and hope; an
   * Undo button in the same place the message appeared removes the guesswork.
   */
  action?: NotificationAction;
}

export interface NotificationState {
  current: AppNotification | null;
  show: (notification: AppNotification) => void;
  dismiss: () => void;
}

export type NotificationStore = StoreApi<NotificationState>;

/**
 * Non-command failures (file import, asset loading) need the same visibility as rejected
 * commands. One notification is shown at a time; a newer one replaces the previous.
 */
export function createNotificationStore(): NotificationStore {
  return createStore<NotificationState>((set) => ({
    current: null,
    show: (notification) => set({ current: notification }),
    dismiss: () => set({ current: null }),
  }));
}
