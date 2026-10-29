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
  X,
} from 'lucide-react';
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';

import { useEditorActions } from './actions';
import { FONT_PAIRINGS, TEXT_PRESETS, type TextPreset } from './textPresets';
import { ElementsPanel } from './elements/ElementsPanel';
import { BackgroundPanel } from './panels/BackgroundPanel';
import { LayersPanel } from './panels/LayersPanel';
import { PanelSection } from './panels/PanelSection';
import { UploadsPanel } from './panels/UploadsPanel';
import { PagePropertiesPanel, PropertiesPanel } from './PropertiesPanel';
import { useDraw } from './draw/DrawContext';
import { TemplateGallery } from '../templates/TemplateGallery';
import { getTemplate } from '../templates/catalog';
import { useMediaQuery } from '../useMediaQuery';

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

const PANEL_DESCRIPTIONS: Record<SidebarTab, string> = {
  design: 'Start with an editable layout.',
  elements: 'Shapes, frames, icons, and photos.',
  text: 'Add type styles and matched font pairings.',
  draw: 'Create freehand strokes on the canvas.',
  uploads: 'Reuse images stored with this design.',
  background: 'Set the page color or gradient.',
  layers: 'Select, arrange, and organize objects.',
  properties: 'Fine-tune the current selection.',
  page: 'Canvas dimensions, metadata, and guides.',
};

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
    <div className="flex flex-col gap-5">
      <PanelSection
        title="Text styles"
        description="Click to add text, then edit it directly on the canvas."
      >
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
      </PanelSection>
      <PanelSection
        title="Font pairings"
        description="A heading and body in a matched pair, inserted together."
      >
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
      </PanelSection>
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
  mobileOpen: boolean;
  onChange: (tab: SidebarTab) => void;
  onToggleCollapsed: () => void;
  onMobileOpenChange: (open: boolean) => void;
}

export function Sidebar({
  active,
  collapsed,
  mobileOpen,
  onChange,
  onToggleCollapsed,
  onMobileOpenChange,
}: SidebarProps) {
  const baseId = useId();
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const activeLabel = TABS.find((tab) => tab.id === active)?.label ?? 'Design';
  const panelHidden = isMobile && !mobileOpen;

  const closeMobilePanel = useCallback(() => {
    onMobileOpenChange(false);
    requestAnimationFrame(() => {
      document.getElementById(`${baseId}-tab-${active}`)?.focus();
    });
  }, [active, baseId, onMobileOpenChange]);

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeMobilePanel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeMobilePanel, isMobile, mobileOpen]);

  const activate = (tab: SidebarTab) => {
    onMobileOpenChange(true);
    if (tab !== active) onChange(tab);
    if (collapsed) onToggleCollapsed();
  };

  return (
    <div className="contents lg:flex lg:h-full lg:min-h-0 lg:shrink-0 lg:border-r lg:border-border lg:bg-panel">
      {isMobile && mobileOpen && !collapsed ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 bottom-[calc(4rem_+_env(safe-area-inset-bottom))] z-30 bg-slate-950/20 backdrop-blur-[1px] lg:hidden"
          onClick={closeMobilePanel}
        />
      ) : null}
      <nav
        aria-label="Editor panels"
        role="tablist"
        aria-orientation={isMobile ? 'horizontal' : 'vertical'}
        className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem_+_env(safe-area-inset-bottom))] shrink-0 flex-row items-stretch gap-1 overflow-x-auto overscroll-x-contain border-t border-border bg-[#faf9fc] px-1 pb-[env(safe-area-inset-bottom)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:static lg:z-20 lg:h-auto lg:w-[76px] lg:flex-col lg:items-center lg:overflow-x-visible lg:overflow-y-auto lg:border-r lg:border-t-0 lg:px-1.5 lg:py-2 lg:pb-2"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapsed}
          className="mb-1 hidden rounded-xl text-muted-foreground lg:inline-flex"
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </Button>
        <Separator className="mb-1 hidden w-9 lg:block" />
        {TABS.map((tab) => {
          const selected = tab.id === active;
          const expanded = selected && !collapsed && (!isMobile || mobileOpen);
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-expanded={expanded}
              aria-controls={!collapsed ? `${baseId}-panel-${tab.id}` : undefined}
              onClick={() => activate(tab.id)}
              title={collapsed ? tab.label : undefined}
              className={cn(
                'relative flex h-full min-w-16 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-[21px] lg:h-[66px] lg:w-full lg:min-w-0 lg:flex-none lg:rounded-xl lg:py-2',
                selected
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-white hover:text-foreground',
              )}
            >
              {selected ? (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-0 h-0.5 w-7 -translate-x-1/2 rounded-full bg-primary lg:left-0 lg:top-1/2 lg:h-7 lg:w-0.5 lg:-translate-x-0 lg:-translate-y-1/2"
                />
              ) : null}
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
          hidden={panelHidden}
          className={cn(
            'fixed inset-x-0 bottom-[calc(4rem_+_env(safe-area-inset-bottom))] z-40 h-[min(62dvh,560px)] min-h-0 min-w-0 flex-col rounded-t-2xl border-t border-border bg-panel shadow-[0_-16px_48px_rgba(15,23,42,0.18)] lg:static lg:z-auto lg:h-full lg:w-[300px] lg:rounded-none lg:border-t-0 lg:shadow-none',
            mobileOpen ? 'flex' : 'hidden lg:flex',
          )}
        >
          <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{activeLabel}</h2>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {PANEL_DESCRIPTIONS[active]}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close panel"
                onClick={closeMobilePanel}
                className="size-9 rounded-lg text-muted-foreground lg:hidden"
              >
                <X />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Collapse sidebar panel"
                onClick={onToggleCollapsed}
                className="hidden size-7 rounded-lg text-muted-foreground lg:inline-flex"
              >
                <ChevronLeft />
              </Button>
            </div>
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
