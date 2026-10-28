import { Button } from '@opencanvas/ui';
import { X } from 'lucide-react';

import { Modal } from '../projects/Modal';

const SECTIONS: readonly {
  title: string;
  shortcuts: readonly { action: string; keys: string }[];
}[] = [
  {
    title: 'Edit',
    shortcuts: [
      { action: 'Copy / cut / paste', keys: 'Ctrl C · X · V' },
      { action: 'Duplicate selection', keys: 'Ctrl D' },
      { action: 'Duplicate by dragging', keys: 'Alt + drag' },
      { action: 'Copy / paste style', keys: 'Ctrl Alt C · V' },
      { action: 'Undo / redo', keys: 'Ctrl Z · Ctrl Shift Z' },
      { action: 'Delete selection', keys: 'Delete' },
    ],
  },
  {
    title: 'Selection and layers',
    shortcuts: [
      { action: 'Select all', keys: 'Ctrl A' },
      { action: 'Clear selection', keys: 'Escape' },
      { action: 'Nudge (larger step)', keys: 'Arrows · Shift Arrows' },
      { action: 'Group / ungroup', keys: 'Ctrl G · Ctrl Shift G' },
      { action: 'Bring forward / send backward', keys: 'Ctrl ] · Ctrl [' },
      { action: 'Bring to front / send to back', keys: 'Ctrl Shift ] · Ctrl Shift [' },
    ],
  },
  {
    title: 'Insert',
    shortcuts: [
      { action: 'Rectangle', keys: 'R' },
      { action: 'Ellipse', keys: 'O' },
      { action: 'Text box', keys: 'T' },
      { action: 'Line', keys: 'L' },
      { action: 'Draw / stop drawing', keys: 'D' },
    ],
  },
  {
    title: 'Canvas and document',
    shortcuts: [
      { action: 'Zoom in / out', keys: 'Ctrl + · Ctrl −' },
      { action: 'Fit page / actual size', keys: 'Ctrl 0 · Ctrl 1' },
      { action: 'Rulers and guides', keys: 'Shift R' },
      { action: 'Save now', keys: 'Ctrl S' },
      { action: 'Apply / cancel crop', keys: 'Enter · Escape' },
      { action: 'Keyboard shortcuts', keys: '?' },
    ],
  },
];

interface KeyboardShortcutsDialogProps {
  onClose: () => void;
}

export function KeyboardShortcutsDialog({ onClose }: KeyboardShortcutsDialogProps) {
  return (
    <Modal labelledBy="keyboard-shortcuts-title" onClose={onClose} className="max-w-[780px]">
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h2 id="keyboard-shortcuts-title" className="text-lg font-semibold tracking-tight">
            Keyboard shortcuts
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Move less between the canvas and the panels.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close keyboard shortcuts"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="grid gap-x-8 gap-y-6 px-6 py-6 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {section.title}
            </h3>
            <dl className="divide-y divide-border/70">
              {section.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.action}
                  className="flex items-center justify-between gap-4 py-2.5"
                >
                  <dt className="text-sm text-foreground">{shortcut.action}</dt>
                  <dd>
                    <kbd className="rounded-md border border-border bg-muted px-2 py-1 font-sans text-[11px] whitespace-nowrap text-muted-foreground">
                      {shortcut.keys}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="border-t border-border bg-muted/35 px-6 py-4 text-xs leading-relaxed text-muted-foreground">
        Use Ctrl on Windows/Linux or ⌘ on macOS; Alt is Option on macOS. Copied elements and styles
        stay in memory for this open design; text fields keep their native clipboard behavior.
      </p>
    </Modal>
  );
}
