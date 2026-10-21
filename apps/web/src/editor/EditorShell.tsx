import { CanvasStage } from './CanvasStage';
import { ErrorToast } from './ErrorToast';
import { FloatingToolbar } from './FloatingToolbar';
import { PagesStrip } from './PagesStrip';
import { PropertiesPanel } from './PropertiesPanel';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useAutosave } from './useAutosave';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

export function EditorShell() {
  useAutosave();
  useKeyboardShortcuts();
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] bg-background text-foreground">
      <TopBar />
      <div className="grid min-h-0 grid-cols-[auto_1fr_auto]">
        <Sidebar />
        <main className="relative min-h-0 min-w-0" aria-label="Workspace">
          <CanvasStage />
          <FloatingToolbar />
          <PagesStrip />
          <ErrorToast />
        </main>
        <PropertiesPanel />
      </div>
    </div>
  );
}
