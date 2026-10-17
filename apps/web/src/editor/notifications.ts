import { createStore, type StoreApi } from 'zustand/vanilla';

export interface AppNotification {
  kind: 'error' | 'info';
  title: string;
  message: string;
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
