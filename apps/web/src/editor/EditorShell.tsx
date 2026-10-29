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
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  const openPanel = (panel: SidebarTab) => {
    setActivePanel(panel);
    setSidebarCollapsed(false);
    setMobilePanelOpen(true);
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[52px_minmax(0,1fr)] bg-background text-foreground">
      <TopBar onOpenPanel={openPanel} onOpenShortcuts={openShortcuts} />
      <div className="relative min-h-0 min-w-0 lg:grid lg:grid-cols-[auto_minmax(0,1fr)]">
        <Sidebar
          active={activePanel}
          collapsed={sidebarCollapsed}
          mobileOpen={mobilePanelOpen}
          onChange={setActivePanel}
          onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
          onMobileOpenChange={setMobilePanelOpen}
        />
        <main
          aria-label="Workspace"
          className="grid h-full min-h-0 min-w-0 grid-rows-[44px_minmax(0,1fr)] overflow-hidden pb-[calc(4rem_+_env(safe-area-inset-bottom))] lg:pb-0"
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
