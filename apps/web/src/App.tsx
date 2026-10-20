import { Button, TooltipProvider } from '@opencanvas/ui';

import { Dashboard } from './projects/Dashboard';
import { ProjectEditor } from './projects/ProjectEditor';
import type { ProjectsServices } from './projects/ProjectsContext';
import { ProjectsProvider } from './projects/ProjectsProvider';
import { navigate, useRoute } from './router';
import { ShareViewer } from './share/ShareViewer';

function UnknownRoute({ path }: { path: string }) {
  return (
    <div className="grid h-full place-items-center bg-background p-6">
      <div className="max-w-md space-y-3 rounded-lg border border-border bg-panel p-6 text-center">
        <h1 className="font-semibold">Nothing here</h1>
        <p className="text-sm text-muted-foreground">
          No view matches <code className="font-mono">#{path}</code>.
        </p>
        <Button variant="secondary" size="sm" onClick={() => navigate({ name: 'dashboard' })}>
          Back to your designs
        </Button>
      </div>
    </div>
  );
}

function Routes() {
  const route = useRoute();
  switch (route.name) {
    case 'dashboard':
      return <Dashboard />;
    case 'editor':
      // Keyed by project so switching designs remounts the editor with a fresh store.
      return <ProjectEditor key={route.projectId} projectId={route.projectId} />;
    case 'share':
      return <ShareViewer shareId={route.shareId} />;
    case 'not-found':
      return <UnknownRoute path={route.path} />;
  }
}

export interface AppProps {
  /** Persistence backend override (tests, alternative storage). */
  projects?: ProjectsServices;
}

/**
 * Two views: the local project dashboard (`#/`) and the editor for one design
 * (`#/design/<id>`). No account, server or AI is involved — everything is local.
 */
export function App({ projects }: AppProps = {}) {
  return (
    <TooltipProvider>
      <ProjectsProvider services={projects}>
        <Routes />
      </ProjectsProvider>
    </TooltipProvider>
  );
}
