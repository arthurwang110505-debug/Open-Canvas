import { createContext } from 'react';

import type { ExportServices } from './ExportServices';

export const ExportContext = createContext<ExportServices | null>(null);
