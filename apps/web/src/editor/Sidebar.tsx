import { Button, cn } from '@opencanvas/ui';
import { Circle, ImageIcon, PaintBucket, Shapes, Square, Squircle, Type } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { useEditorActions } from './actions';
import { BackgroundPanel } from './panels/BackgroundPanel';
import { UploadsPanel } from './panels/UploadsPanel';

type SidebarTab = 'shapes' | 'text' | 'uploads' | 'background';

const TABS: { id: SidebarTab; label: string; icon: ReactNode }[] = [
  { id: 'shapes', label: 'Shapes', icon: <Shapes /> },
  { id: 'text', label: 'Text', icon: <Type /> },
  { id: 'uploads', label: 'Uploads', icon: <ImageIcon /> },
  { id: 'background', label: 'Background', icon: <PaintBucket /> },
];

function ShapesPanel() {
  const { addShape } = useEditorActions();
  const items = [
    { kind: 'rect' as const, label: 'Rectangle', icon: <Square className="size-8" /> },
    {
      kind: 'rounded-rect' as const,
      label: 'Rounded rectangle',
      icon: <Squircle className="size-8" />,
    },
    { kind: 'ellipse' as const, label: 'Ellipse', icon: <Circle className="size-8" /> },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <Button
          key={item.kind}
          variant="outline"
          className="h-20 flex-col gap-1 text-xs font-normal"
          onClick={() => addShape(item.kind)}
        >
          {item.icon}
          {item.label}
        </Button>
      ))}
    </div>
  );
}

function TextPanel() {
  const { addText } = useEditorActions();
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        className="h-12 justify-start text-xl font-extrabold"
        onClick={() => addText('heading')}
      >
        Add a heading
      </Button>
      <Button
        variant="outline"
        className="h-11 justify-start text-base font-semibold"
        onClick={() => addText('subheading')}
      >
        Add a subheading
      </Button>
      <Button
        variant="outline"
        className="h-10 justify-start text-sm font-normal"
        onClick={() => addText('body')}
      >
        Add a little bit of body text
      </Button>
    </div>
  );
}

export function Sidebar() {
  const [active, setActive] = useState<SidebarTab>('shapes');
  const baseId = useId();

  return (
    <aside className="flex h-full border-r border-border bg-panel">
      <nav
        aria-label="Insert"
        className="flex w-16 flex-col items-stretch gap-1 border-r border-border p-1.5"
      >
        {TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5',
                selected
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </nav>
      <section
        role="tabpanel"
        id={`${baseId}-panel-${active}`}
        aria-labelledby={`${baseId}-tab-${active}`}
        className="w-72 overflow-y-auto p-3"
      >
        <h2 className="mb-3 text-sm font-semibold">
          {TABS.find((tab) => tab.id === active)?.label}
        </h2>
        {active === 'shapes' && <ShapesPanel />}
        {active === 'text' && <TextPanel />}
        {active === 'uploads' && <UploadsPanel />}
        {active === 'background' && <BackgroundPanel />}
      </section>
    </aside>
  );
}
