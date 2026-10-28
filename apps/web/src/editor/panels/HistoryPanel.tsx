import { Button } from '@opencanvas/ui';
import { useMemo } from 'react';

import { Modal } from '../../projects/Modal';
import { useEditor, useEditorStore } from '../hooks';

/** Non-destructive timeline: every retained state is clickable, including redo states. */
export function HistoryPanel({ onClose }: { onClose: () => void }) {
  const store = useEditorStore();
  const document = useEditor((state) => state.document);
  const past = useEditor((state) => state.past);
  const future = useEditor((state) => state.future);
  const pastLabels = useEditor((state) => state.pastLabels);
  const futureLabels = useEditor((state) => state.futureLabels);
  const currentIndex = past.length;
  const entries = useMemo(() => {
    const documents = [...past, document, ...future];
    const labels = [...pastLabels, ...futureLabels];
    return documents.map((_, index) => ({
      index,
      label: index === 0 ? 'Starting point' : (labels[index - 1] ?? 'Edited design'),
      current: index === currentIndex,
      future: index > currentIndex,
    }));
  }, [currentIndex, document, future, futureLabels, past, pastLabels]);

  const jump = (index: number) => store.getState().jumpToHistory(index);

  return (
    <Modal labelledBy="history-title" onClose={onClose} className="max-w-[560px]">
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h2 id="history-title" className="text-lg font-semibold tracking-tight">
            History
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Revisit an edit without losing the states after it.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
      <div className="border-b border-border px-6 py-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="history-position" className="text-xs font-medium">
            History position
          </label>
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} of {entries.length}
          </span>
        </div>
        <input
          id="history-position"
          type="range"
          min={0}
          max={Math.max(0, entries.length - 1)}
          step={1}
          value={currentIndex}
          aria-valuetext={entries[currentIndex]?.label}
          onChange={(event) => jump(Number(event.target.value))}
          className="w-full accent-primary"
        />
      </div>
      <ol className="max-h-[55vh] overflow-y-auto p-2" aria-label="Document history">
        {entries.map((entry) => (
          <li key={entry.index}>
            <button
              type="button"
              aria-current={entry.current ? 'step' : undefined}
              onClick={() => jump(entry.index)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${
                entry.current ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${
                  entry.current ? 'bg-primary' : entry.future ? 'bg-border' : 'bg-muted-foreground'
                }`}
              />
              <span className="flex-1 text-sm font-medium">{entry.label}</span>
              <span className="text-[11px]">
                {entry.current ? 'Current' : entry.future ? 'Redo' : `${entry.index + 1}`}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="border-t border-border bg-muted/35 px-6 py-3 text-xs text-muted-foreground">
        A new edit after going back replaces the redo branch, just like Undo and Redo.
      </p>
    </Modal>
  );
}
