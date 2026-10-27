import { Button, Input } from '@opencanvas/ui';
import { FolderPlus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { MAX_PROJECT_FOLDER_NAME } from '@opencanvas/storage';
import { Modal } from './Modal';

interface FolderDialogProps {
  initialName?: string;
  error: string | null;
  onClose: () => void;
  onSave: (name: string) => Promise<boolean>;
}

export function FolderDialog({ initialName, error, onClose, onSave }: FolderDialogProps) {
  const [name, setName] = useState(initialName ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = initialName !== undefined;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError('A folder name cannot be empty.');
      return;
    }
    setValidationError(null);
    setSaving(true);
    const saved = await onSave(trimmed);
    setSaving(false);
    if (saved) onClose();
  };

  return (
    <Modal labelledBy="folder-dialog-title" onClose={onClose} className="max-w-[440px]">
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <FolderPlus className="size-4" />
          </span>
          <h2 id="folder-dialog-title" className="mt-3 text-lg font-bold">
            {editing ? 'Rename folder' : 'Create a folder'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {editing ? 'Give this folder a new name.' : 'Group related designs together.'}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close folder dialog" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </header>
      <form onSubmit={(event) => void submit(event)} className="space-y-4 px-5 py-5">
        <label className="block space-y-1.5 text-sm font-medium">
          Folder name
          <Input
            aria-label="Folder name"
            value={name}
            maxLength={MAX_PROJECT_FOLDER_NAME}
            autoComplete="off"
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {validationError || error ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {validationError ?? error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
            className="rounded-full px-4"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="rounded-full px-4">
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create folder'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
