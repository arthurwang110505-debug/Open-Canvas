import { selectActivePage } from '@opencanvas/editor-core';
import { cn } from '@opencanvas/ui';

import { useEditorActions } from '../actions';
import { useEditor } from '../hooks';
import { ColorField } from './fields';

const SWATCHES = [
  '#ffffff',
  '#f8fafc',
  '#fef3c7',
  '#fde68a',
  '#fecaca',
  '#fbcfe8',
  '#e9d5ff',
  '#c7d2fe',
  '#bfdbfe',
  '#a7f3d0',
  '#d9f99d',
  '#e5e7eb',
  '#9ca3af',
  '#4b5563',
  '#1f2937',
  '#0f172a',
  '#4f46e5',
  '#db2777',
  '#ea580c',
  '#16a34a',
];

export function BackgroundPanel() {
  const background = useEditor((state) => selectActivePage(state).background);
  const { setPageBackground } = useEditorActions();
  const current = background.type === 'solid' ? background.color : '#ffffff';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Solid colors</p>
        <div className="grid grid-cols-5 gap-2" role="listbox" aria-label="Background colors">
          {SWATCHES.map((color) => {
            const selected = color.toLowerCase() === current.toLowerCase();
            return (
              <button
                key={color}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={`Background ${color}`}
                title={color}
                onClick={() => setPageBackground({ type: 'solid', color })}
                style={{ backgroundColor: color }}
                className={cn(
                  'aspect-square rounded-md border border-border transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected && 'ring-2 ring-primary ring-offset-1',
                )}
              />
            );
          })}
        </div>
      </div>
      <ColorField
        label="Custom color"
        value={current}
        onCommit={(color) => setPageBackground({ type: 'solid', color }, 'page-background')}
      />
    </div>
  );
}
