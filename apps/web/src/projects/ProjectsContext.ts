import {
  createDexieProjectOrganizationStore,
  createDexieProjectStore,
  createMemoryProjectOrganizationStore,
  createMemoryProjectStore,
  indexedDbAvailable,
  openProjectDatabase,
  type ProjectOrganizationStore,
  type ProjectStore,
} from '@opencanvas/storage';
import { createContext } from 'react';

import { downloadBlob } from '../download';

export type ProjectsBackend = 'indexeddb' | 'memory';

export interface ProjectsServices {
  store: ProjectStore;
  organization: ProjectOrganizationStore;
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
    const db = openProjectDatabase();
    return {
      store: createDexieProjectStore(db),
      organization: createDexieProjectOrganizationStore(db),
      backend: 'indexeddb',
      download: downloadBlob,
    };
  }
  return {
    store: createMemoryProjectStore(),
    organization: createMemoryProjectOrganizationStore(),
    backend: 'memory',
    download: downloadBlob,
  };
}

export const ProjectsContext = createContext<ProjectsServices | null>(null);
