import { generateId, type PageGuide } from '@opencanvas/document';
import { selectActivePage } from '@opencanvas/editor-core';
import { Button, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@opencanvas/ui';
import { Check, Ruler, Trash2 } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { useEditorActions } from '../actions';
import { useCanvasController, useCanvasState, useEditor } from '../hooks';

const RULER_SIZE = 24;
const STEPS = [1, 2, 5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000] as const;

interface Tick {
  value: number;
  position: number;
}

function rulerTicks(origin: number, viewport: number, zoom: number, pageSize: number): Tick[] {
  if (viewport <= 0 || zoom <= 0) return [];
  const step = STEPS.find((candidate) => candidate * zoom >= 50) ?? 5000;
  const first = Math.max(0, Math.floor(-origin / zoom / step) * step);
  const last = Math.min(pageSize, Math.ceil((viewport - origin) / zoom / step) * step);
  const ticks: Tick[] = [];
  for (let value = first; value <= last && ticks.length < 300; value += step) {
    ticks.push({ value, position: origin + value * zoom });
  }
  return ticks;
}

function HorizontalTicks({ ticks }: { ticks: Tick[] }) {
  return (
    <svg aria-hidden="true" className="size-full overflow-visible">
      {ticks.map((tick) => (
        <g key={tick.value}>
          <line
            x1={tick.position}
            x2={tick.position}
            y1={tick.value % 100 === 0 ? 7 : 14}
            y2={RULER_SIZE}
            stroke="currentColor"
            strokeWidth={1}
          />
          {tick.value % 100 === 0 ? (
            <text x={tick.position + 3} y={9} fontSize={9} fill="currentColor">
              {tick.value}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

function VerticalTicks({ ticks }: { ticks: Tick[] }) {
  return (
    <svg aria-hidden="true" className="size-full overflow-visible">
      {ticks.map((tick) => (
        <g key={tick.value}>
          <line
            x1={tick.value % 100 === 0 ? 7 : 14}
            x2={RULER_SIZE}
            y1={tick.position}
            y2={tick.position}
            stroke="currentColor"
            strokeWidth={1}
          />
          {tick.value % 100 === 0 ? (
            <text
              x={9}
              y={tick.position + 3}
              fontSize={9}
              fill="currentColor"
              transform={`rotate(-90 9 ${tick.position + 3})`}
            >
              {tick.value}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

/** Workspace rulers and non-printing, page-owned margin/bleed guides. */
export function Rulers() {
  const visible = useEditor((state) => state.rulersVisible);
  const page = useEditor(selectActivePage);
  const size = useEditor((state) => state.document.size);
  const zoom = useEditor((state) => state.zoom);
  const controller = useCanvasController();
  const viewportRevision = useCanvasState((state) => state.viewportRevision);
  const actions = useEditorActions();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; mergeKey: string } | null>(null);
  const sequence = useRef(0);
  const [newGuideKind, setNewGuideKind] = useState<PageGuide['kind']>('margin');
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [container, setContainer] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element || !visible) {
      setContainer(null);
      return;
    }
    const measure = () => setContainer(element.getBoundingClientRect());
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible, viewportRevision]);

  useEffect(() => {
    if (!visible) return;
    const onPointerMove = (event: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      setPointer(inside ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
    };
    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [visible]);

  const pageOrigin = controller.pageToClient(0, 0);
  const origin = {
    x: pageOrigin && container ? pageOrigin.x - container.left : 0,
    y: pageOrigin && container ? pageOrigin.y - container.top : 0,
  };
  // Viewport revision intentionally anchors this derived layout to pan/fit as well as zoom.
  void viewportRevision;
  const horizontalTicks = rulerTicks(
    origin.x - RULER_SIZE,
    (container?.width ?? 0) - RULER_SIZE,
    zoom,
    size.width,
  );
  const verticalTicks = rulerTicks(
    origin.y - RULER_SIZE,
    (container?.height ?? 0) - RULER_SIZE,
    zoom,
    size.height,
  );

  if (!visible) return null;

  const clampPosition = (axis: PageGuide['axis'], position: number) =>
    Math.round(Math.min(Math.max(position, 0), axis === 'horizontal' ? size.height : size.width));

  const updatePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = controller.clientToPage(event.clientX, event.clientY);
    if (!point) return;
    const guide = page.guides.find((candidate) => candidate.id === drag.id);
    if (!guide) return;
    actions.updateGuide(
      drag.id,
      clampPosition(guide.axis, guide.axis === 'horizontal' ? point.y : point.x),
      drag.mergeKey,
    );
  };

  const startDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    axis: PageGuide['axis'],
    guide?: PageGuide,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = controller.clientToPage(event.clientX, event.clientY);
    if (!point) return;
    const id = guide?.id ?? generateId('guide');
    const mergeKey = `guide-drag:${id}:${++sequence.current}`;
    if (!guide) {
      actions.addGuide(
        axis,
        newGuideKind,
        clampPosition(axis, axis === 'horizontal' ? point.y : point.x),
        id,
        mergeKey,
      );
    }
    dragRef.current = { id, mergeKey };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const addAtCenter = (axis: PageGuide['axis']) => {
    actions.addGuide(axis, newGuideKind, (axis === 'horizontal' ? size.height : size.width) / 2);
  };

  const guideKeyDown = (event: KeyboardEvent<HTMLButtonElement>, guide: PageGuide) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      actions.removeGuide(guide.id);
      return;
    }
    const direction =
      guide.axis === 'horizontal'
        ? event.key === 'ArrowUp'
          ? -1
          : event.key === 'ArrowDown'
            ? 1
            : 0
        : event.key === 'ArrowLeft'
          ? -1
          : event.key === 'ArrowRight'
            ? 1
            : 0;
    if (direction !== 0) {
      event.preventDefault();
      event.stopPropagation();
      actions.updateGuide(
        guide.id,
        clampPosition(guide.axis, guide.position + direction * (event.shiftKey ? 10 : 1)),
      );
    }
  };

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Rulers and guides"
      className="pointer-events-none absolute inset-0 z-[15] overflow-hidden text-muted-foreground"
      onPointerMove={updatePointer}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onPointerLeave={() => {
        if (!dragRef.current) setPointer(null);
      }}
    >
      {page.guides.map((guide) => {
        const position =
          guide.axis === 'horizontal'
            ? origin.y + guide.position * zoom
            : origin.x + guide.position * zoom;
        const horizontal = guide.axis === 'horizontal';
        return (
          <button
            key={guide.id}
            type="button"
            aria-label={`${guide.kind === 'margin' ? 'Margin' : 'Bleed'} ${guide.axis} guide at ${guide.position} pixels`}
            title="Drag to move · arrows to nudge · double-click or Delete to remove"
            onPointerDown={(event) => startDrag(event, guide.axis, guide)}
            onDoubleClick={() => actions.removeGuide(guide.id)}
            onKeyDown={(event) => guideKeyDown(event, guide)}
            className={`pointer-events-auto absolute outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              horizontal
                ? 'right-0 left-0 h-3 -translate-y-1/2 cursor-row-resize'
                : 'top-0 bottom-0 w-3 -translate-x-1/2 cursor-col-resize'
            }`}
            style={horizontal ? { top: position } : { left: position }}
          >
            <span
              aria-hidden="true"
              className={`absolute ${
                horizontal ? 'top-1/2 right-0 left-0 border-t' : 'top-0 bottom-0 left-1/2 border-l'
              } ${guide.kind === 'bleed' ? 'border-dashed border-rose-500' : 'border-indigo-500'}`}
            />
          </button>
        );
      })}

      <button
        type="button"
        aria-label="Create horizontal guide"
        title="Drag to create a horizontal guide; Enter adds one at page center"
        onPointerDown={(event) => startDrag(event, 'horizontal')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            addAtCenter('horizontal');
          }
        }}
        className="pointer-events-auto absolute top-0 right-0 left-6 h-6 cursor-row-resize border-b border-border bg-white/95 shadow-sm outline-none focus-visible:bg-muted"
      >
        <HorizontalTicks ticks={horizontalTicks} />
        {pointer ? (
          <span
            aria-hidden="true"
            data-testid="horizontal-pointer-tick"
            className="absolute top-0 bottom-0 w-px bg-primary"
            style={{ left: pointer.x - RULER_SIZE }}
          />
        ) : null}
      </button>
      <button
        type="button"
        aria-label="Create vertical guide"
        title="Drag to create a vertical guide; Enter adds one at page center"
        onPointerDown={(event) => startDrag(event, 'vertical')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            addAtCenter('vertical');
          }
        }}
        className="pointer-events-auto absolute top-6 bottom-0 left-0 w-6 cursor-col-resize border-r border-border bg-white/95 shadow-sm outline-none focus-visible:bg-muted"
      >
        <VerticalTicks ticks={verticalTicks} />
        {pointer ? (
          <span
            aria-hidden="true"
            data-testid="vertical-pointer-tick"
            className="absolute right-0 left-0 h-px bg-primary"
            style={{ top: pointer.y - RULER_SIZE }}
          />
        ) : null}
      </button>

      <div className="pointer-events-auto absolute top-0 left-0 size-6 border-r border-b border-border bg-white">
        <Menu>
          <MenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Guide options"
              className="size-6 rounded-none"
            >
              <Ruler className="size-3.5" />
            </Button>
          </MenuTrigger>
          <MenuContent aria-label="Guide options menu">
            <MenuItem
              icon={newGuideKind === 'margin' ? <Check /> : undefined}
              onSelect={() => setNewGuideKind('margin')}
            >
              New guides: margin
            </MenuItem>
            <MenuItem
              icon={newGuideKind === 'bleed' ? <Check /> : undefined}
              onSelect={() => setNewGuideKind('bleed')}
            >
              New guides: bleed
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Trash2 />}
              disabled={page.guides.length === 0}
              onSelect={actions.clearGuides}
            >
              Clear page guides
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </div>
  );
}
