import { useState, type ReactNode } from 'react';

import { createBrowserExportServices } from './browserExportServices';
import { ExportContext } from './ExportContext';
import type { ExportServices } from './ExportServices';

export interface ExportProviderProps {
  /** Overrides for tests and non-browser hosts. */
  services?: Partial<ExportServices>;
  children: ReactNode;
}

export function ExportProvider({ services, children }: ExportProviderProps) {
  const [value] = useState<ExportServices>(() => ({
    ...createBrowserExportServices(),
    ...services,
  }));
  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>;
}
