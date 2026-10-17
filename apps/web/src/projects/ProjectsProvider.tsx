import { useState, type ReactNode } from 'react';

import { createProjectsServices, ProjectsContext, type ProjectsServices } from './ProjectsContext';

export interface ProjectsProviderProps {
  /** Overrides for tests and alternative backends. */
  services?: ProjectsServices;
  children: ReactNode;
}

export function ProjectsProvider({ services, children }: ProjectsProviderProps) {
  const [value] = useState<ProjectsServices>(() => services ?? createProjectsServices());
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}
