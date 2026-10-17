import {
  createDexieProjectStore,
  createMemoryProjectStore,
  indexedDbAvailable,
  openProjectDatabase,
  type ProjectStore,
} from '@opencanvas/storage';
import { createContext } from 'react';

import { downloadBlob } from '../download';

export type ProjectsBackend = 'indexeddb' | 'memory';

export interface ProjectsServices {
  store: ProjectStore;
  backend: ProjectsBackend;
  /** Hands a finished file to the browser's download UI; injectable in tests. */
  download: (blob: Blob, filename: string) => void;
}

/**
 * Picks the best local backend available. IndexedDB keeps designs (and their image bytes)
 * across reloads; the volatile store is the fallback for private-mode browsers so the editor
 * still works, with the limitation stated in the dashboard.
 */
export function createProjectsServices(): ProjectsServices {
  if (indexedDbAvailable()) {
    return {
      store: createDexieProjectStore(openProjectDatabase()),
      backend: 'indexeddb',
      download: downloadBlob,
    };
  }
  return { store: createMemoryProjectStore(), backend: 'memory', download: downloadBlob };
}

export const ProjectsContext = createContext<ProjectsServices | null>(null);
