import { useContext } from 'react';

import { ProjectsContext, type ProjectsServices } from './ProjectsContext';

export function useProjects(): ProjectsServices {
  const services = useContext(ProjectsContext);
  if (!services) throw new Error('Project views must be used inside <ProjectsProvider>.');
  return services;
}
