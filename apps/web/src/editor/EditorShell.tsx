import { useCallback, useState } from 'react';

import { CanvasStage } from './CanvasStage';
import { ContextualToolbar } from './ContextualToolbar';
import { ErrorToast } from './ErrorToast';
import { FloatingToolbar } from './FloatingToolbar';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { PagesStrip } from './PagesStrip';
import { Sidebar, type SidebarTab } from './Sidebar';
import { TopBar } from './TopBar';
import { useAutosave } from './useAutosave';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

export function EditorShell() {
  useAutosave();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const openShortcuts = useCallback(() => setShowShortcuts(true), []);
  useKeyboardShortcuts(openShortcuts);
  const [activePanel, setActivePanel] = useState<SidebarTab>('design');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const openPanel = (panel: SidebarTab) => {
    setActivePanel(panel);
    setSidebarCollapsed(false);
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[52px_minmax(0,1fr)] bg-background text-foreground">
      <TopBar onOpenPanel={openPanel} onOpenShortcuts={openShortcuts} />
      <div className="grid min-h-0 min-w-0 grid-cols-[auto_minmax(0,1fr)]">
        <Sidebar
          active={activePanel}
          collapsed={sidebarCollapsed}
          onChange={setActivePanel}
          onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
        />
        <main
          aria-label="Workspace"
          className="grid min-h-0 min-w-0 grid-rows-[44px_minmax(0,1fr)] overflow-hidden"
        >
          <ContextualToolbar onOpenPanel={openPanel} />
          <div className="relative min-h-0 min-w-0">
            <CanvasStage
              onOpenPageSettings={() => openPanel('page')}
              onOpenProperties={() => openPanel('properties')}
            />
            <FloatingToolbar onOpenProperties={() => openPanel('properties')} />
            <PagesStrip />
            <ErrorToast />
          </div>
        </main>
      </div>
      {showShortcuts ? <KeyboardShortcutsDialog onClose={() => setShowShortcuts(false)} /> : null}
    </div>
  );
}
