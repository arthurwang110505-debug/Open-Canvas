import { useContext } from 'react';

import { ExportContext } from './ExportContext';
import type { ExportServices } from './ExportServices';

export function useExportServices(): ExportServices {
  const services = useContext(ExportContext);
  if (!services) throw new Error('Export hooks must be used inside <ExportProvider>.');
  return services;
}
