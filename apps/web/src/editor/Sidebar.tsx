import { Button, Separator, cn } from '@opencanvas/ui';
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Layers,
  LayoutTemplate,
  PaintBucket,
  PenTool,
  Ruler,
  Shapes,
  SlidersHorizontal,
  Type,
} from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { useEditorActions } from './actions';
import { FONT_PAIRINGS, TEXT_PRESETS, type TextPreset } from './textPresets';
import { ElementsPanel } from './elements/ElementsPanel';
import { BackgroundPanel } from './panels/BackgroundPanel';
import { LayersPanel } from './panels/LayersPanel';
import { UploadsPanel } from './panels/UploadsPanel';
import { PagePropertiesPanel, PropertiesPanel } from './PropertiesPanel';
import { useDraw } from './draw/DrawContext';
import { TemplateGallery } from '../templates/TemplateGallery';
import { getTemplate } from '../templates/catalog';

export type SidebarTab =
  | 'design'
  | 'elements'
  | 'text'
  | 'draw'
  | 'uploads'
  | 'background'
  | 'layers'
  | 'properties'
  | 'page';

const TABS: { id: SidebarTab; label: string; icon: ReactNode }[] = [
  { id: 'design', label: 'Design', icon: <LayoutTemplate /> },
  { id: 'elements', label: 'Elements', icon: <Shapes /> },
  { id: 'text', label: 'Text', icon: <Type /> },
  { id: 'draw', label: 'Draw', icon: <PenTool /> },
  { id: 'uploads', label: 'Uploads', icon: <ImageIcon /> },
  { id: 'background', label: 'Background', icon: <PaintBucket /> },
  { id: 'layers', label: 'Layers', icon: <Layers /> },
  { id: 'properties', label: 'Properties', icon: <SlidersHorizontal /> },
  { id: 'page', label: 'Page', icon: <Ruler /> },
];

function TextPanel() {
  const { addText, addTextPairing } = useEditorActions();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">Click to add text — then edit on the canvas.</p>
      <div className="flex flex-col gap-2" role="group" aria-label="Text styles">
        {(Object.keys(TEXT_PRESETS) as TextPreset[]).map((preset) => {
          const spec = TEXT_PRESETS[preset];
          return (
            <button
              key={preset}
              type="button"
              aria-label={spec.text}
              onClick={() => addText(preset)}
              className="rounded-xl border border-border bg-panel px-3 py-2 text-left text-foreground transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className="block truncate leading-tight"
                style={{
                  fontSize: `${spec.previewSize}px`,
                  fontWeight: spec.fontWeight,
                  fontStyle: spec.fontStyle,
                  letterSpacing: `${((spec.letterSpacing * spec.previewSize) / spec.fontSize).toFixed(2)}px`,
                  textTransform: spec.textTransform,
                }}
              >
                {spec.text}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold">Font pairings</h3>
        <p className="text-[11px] text-muted-foreground">
          A heading and body in a matched pair, inserted together.
        </p>
        <div className="flex flex-col gap-2" role="group" aria-label="Font pairings">
          {FONT_PAIRINGS.map((pairing) => (
            <button
              key={pairing.id}
              type="button"
              aria-label={`Add ${pairing.label} pairing`}
              onClick={() => addTextPairing(pairing.id)}
              className="flex items-center gap-3 rounded-xl border border-border bg-panel px-3 py-2 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden="true"
                className="w-9 shrink-0 text-2xl leading-none"
                style={{
                  fontFamily: `"${pairing.headingFamily}"`,
                  fontWeight: pairing.headingWeight,
                }}
              >
                Aa
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{pairing.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {pairing.headingFamily} + {pairing.bodyFamily}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DesignPanel() {
  const { applyTemplate, addTemplatePage } = useEditorActions();
  const [asNewPage, setAsNewPage] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={asNewPage}
          onChange={(event) => setAsNewPage(event.target.checked)}
          className="accent-primary"
        />
        Add as a new page
      </label>
      <TemplateGallery
        variant="panel"
        onUse={(templateId) => {
          const template = getTemplate(templateId);
          if (!template) return;
          const document = template.build();
          if (asNewPage) addTemplatePage(document);
          else applyTemplate(document);
        }}
      />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Applying a template replaces this page and keeps it undoable with{' '}
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Ctrl Z</kbd>. Layouts
        are fitted to this canvas size.
      </p>
    </div>
  );
}

function DrawPanel() {
  const { enabled, strokeColor, strokeWidth, setEnabled, setStrokeColor, setStrokeWidth } =
    useDraw();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Draw freehand on the canvas. Click and drag to create a stroke.
      </p>
      <Button
        variant={enabled ? 'default' : 'outline'}
        className="h-10 rounded-xl"
        onClick={() => setEnabled(!enabled)}
      >
        <PenTool className="size-4" />
        {enabled ? 'Drawing — click to exit' : 'Start drawing'}
      </Button>
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium">Color</label>
        <input
          type="color"
          value={strokeColor}
          onChange={(e) => setStrokeColor(e.target.value)}
          className="h-8 w-10 rounded border border-border p-1"
          aria-label="Stroke color"
        />
        <span className="text-xs text-muted-foreground">{strokeColor}</span>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">Width: {strokeWidth}px</label>
        <input
          type="range"
          min={1}
          max={24}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          className="w-full accent-primary"
          aria-label="Stroke width"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>1</span>
          <span>24</span>
        </div>
      </div>
      <div className="rounded-lg bg-muted p-3">
        <div
          className="mx-auto h-6 rounded-full"
          style={{
            background: strokeColor,
            width: `${Math.max(8, strokeWidth * 4)}px`,
            height: `${strokeWidth}px`,
          }}
        />
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Preview</p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Tip: Press <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">D</kbd> to
        toggle draw mode. Drag on the page to draw.
      </p>
    </div>
  );
}

export interface SidebarProps {
  active: SidebarTab;
  collapsed: boolean;
  onChange: (tab: SidebarTab) => void;
  onToggleCollapsed: () => void;
}

export function Sidebar({ active, collapsed, onChange, onToggleCollapsed }: SidebarProps) {
  const baseId = useId();
  const activeLabel = TABS.find((tab) => tab.id === active)?.label ?? 'Design';

  const activate = (tab: SidebarTab) => {
    if (tab === active && !collapsed) {
      onToggleCollapsed();
      return;
    }
    if (tab !== active) onChange(tab);
    if (collapsed) onToggleCollapsed();
  };

  return (
    <div className="flex h-full min-h-0 shrink-0 border-r border-border bg-panel">
      <nav
        aria-label="Editor panels"
        role="tablist"
        aria-orientation="vertical"
        className="flex w-[68px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-border bg-[#faf9fc] px-1.5 py-2"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapsed}
          className="mb-1 rounded-xl text-muted-foreground"
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </Button>
        <Separator className="mb-1 w-9" />
        {TABS.map((tab) => {
          const selected = tab.id === active;
          const expanded = selected && !collapsed;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={expanded}
              aria-expanded={expanded}
              aria-controls={expanded ? `${baseId}-panel-${tab.id}` : undefined}
              onClick={() => activate(tab.id)}
              title={collapsed ? tab.label : undefined}
              className={cn(
                'flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-[21px]',
                selected
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-white hover:text-foreground',
              )}
            >
              {tab.icon}
              <span className="max-w-full truncate">{tab.label}</span>
            </button>
          );
        })}
      </nav>
      {!collapsed ? (
        <section
          role="tabpanel"
          id={`${baseId}-panel-${active}`}
          aria-labelledby={`${baseId}-tab-${active}`}
          className="flex min-h-0 w-[300px] min-w-0 flex-col bg-panel"
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
            <h2 className="text-sm font-semibold">{activeLabel}</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Collapse sidebar panel"
              onClick={onToggleCollapsed}
              className="size-7 rounded-lg text-muted-foreground"
            >
              <ChevronLeft />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="p-4">
              {active === 'design' && <DesignPanel />}
              {active === 'elements' && <ElementsPanel />}
              {active === 'text' && <TextPanel />}
              {active === 'draw' && <DrawPanel />}
              {active === 'uploads' && <UploadsPanel />}
              {active === 'background' && <BackgroundPanel />}
              {active === 'layers' && <LayersPanel />}
            </div>
            {active === 'properties' && <PropertiesPanel />}
            {active === 'page' && <PagePropertiesPanel />}
          </div>
        </section>
      ) : null}
    </div>
  );
}
