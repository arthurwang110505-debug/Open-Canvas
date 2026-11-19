import { Button } from '@opencanvas/ui';
import { BookmarkPlus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Modal } from '../../projects/Modal';
import { useEditorActions } from '../actions';
import { useEditor, useEditorStore, useNotificationStore } from '../hooks';
import {
  deleteVersion,
  listVersions,
  MAX_SAVED_VERSIONS,
  saveVersion,
  type SavedVersion,
} from '../versions';

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Non-destructive timeline: every retained state is clickable, including redo states. */
export function HistoryPanel({ onClose }: { onClose: () => void }) {
  const store = useEditorStore();
  const document = useEditor((state) => state.document);
  const past = useEditor((state) => state.past);
  const future = useEditor((state) => state.future);
  const pastLabels = useEditor((state) => state.pastLabels);
  const futureLabels = useEditor((state) => state.futureLabels);
  const actions = useEditorActions();
  const notifications = useNotificationStore();
  const [versions, setVersions] = useState<SavedVersion[]>(() => listVersions(document.id));
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
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

  const notify = (title: string, message: string) =>
    notifications.getState().show({ kind: 'info', title, message });

  const handleSave = () => {
    const saved = saveVersion(document, name);
    if (!saved) {
      setError(
        name.trim().length === 0
          ? 'Give this version a name first.'
          : `This browser already holds ${MAX_SAVED_VERSIONS} versions for this design. Delete one to save another.`,
      );
      return;
    }
    setVersions(listVersions(document.id));
    setName('');
    setError(null);
    notify('Version saved', `"${saved.name}" is stored in this browser.`);
  };

  const handleRestore = (version: SavedVersion) => {
    actions.restoreVersion(version.document);
    notify(
      'Version restored',
      `"${version.name}" is back on screen. Undo returns to where you were.`,
    );
  };

  const handleDelete = (version: SavedVersion) => {
    if (deleteVersion(document.id, version.id)) {
      setVersions(listVersions(document.id));
      notify('Version deleted', `"${version.name}" was removed from this browser.`);
    }
  };

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
        <h3 className="text-sm font-semibold">Saved versions</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Name a snapshot to come back to later. Stored in this browser only; restoring is one undo
          step.
        </p>
        <div className="mt-2.5 flex gap-2">
          <label htmlFor="version-name" className="sr-only">
            Version name
          </label>
          <input
            id="version-name"
            type="text"
            value={name}
            maxLength={60}
            placeholder="e.g. Before launch"
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSave();
            }}
            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button size="sm" className="h-9 shrink-0 rounded-lg text-xs" onClick={handleSave}>
            <BookmarkPlus aria-hidden="true" /> Save
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-1.5 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        {versions.length > 0 ? (
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {versions.map((version) => (
              <li
                key={version.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium" title={version.name}>
                    {version.name}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {formatTime(version.createdAt)}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 rounded-lg text-xs"
                  onClick={() => handleRestore(version)}
                >
                  Restore
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete version ${version.name}`}
                  onClick={() => handleDelete(version)}
                  className="shrink-0 rounded-lg"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
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
