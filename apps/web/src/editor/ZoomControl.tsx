import { formatZoom } from '@opencanvas/editor-core';
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Tooltip,
} from '@opencanvas/ui';
import { Maximize, Minus, Plus } from 'lucide-react';

import { useCanvasController, useCanvasReady, useEditor } from './hooks';

const PRESETS = [
  { label: '50%', zoom: 0.5 },
  { label: '100%', zoom: 1 },
  { label: '200%', zoom: 2 },
];

const STEP = 0.1;

/**
 * Canva-style zoom pill in the lower-right corner of the workspace: step buttons, a menu of
 * presets and fit-to-screen. Keyboard shortcuts still work from anywhere.
 */
export function ZoomControl() {
  const zoom = useEditor((state) => state.zoom);
  const ready = useCanvasReady();
  const canvas = useCanvasController();

  return (
    <div
      role="group"
      aria-label="Zoom"
      className="pointer-events-auto absolute right-3 bottom-3 z-30 flex items-center gap-0.5 rounded-full border border-border bg-white/95 px-1 py-1 shadow-[0_8px_24px_rgba(16,24,40,0.12)] backdrop-blur"
    >
      <Tooltip content="Zoom out (Ctrl −)">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          disabled={!ready}
          onClick={() => canvas.zoomTo(Math.max(0.05, Math.round((zoom - STEP) * 100) / 100))}
          className="rounded-full"
        >
          <Minus />
        </Button>
      </Tooltip>
      <Menu>
        <MenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Zoom level ${formatZoom(zoom)}. Choose a zoom level`}
            disabled={!ready}
            className="w-14 rounded-full tabular-nums"
          >
            {formatZoom(zoom)}
          </Button>
        </MenuTrigger>
        <MenuContent align="end">
          {PRESETS.map((preset) => (
            <MenuItem
              key={preset.label}
              hint={Math.abs(zoom - preset.zoom) < 0.001 ? 'current' : undefined}
              onSelect={() => canvas.zoomTo(preset.zoom)}
            >
              {preset.label}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onSelect={() => canvas.fitToScreen()}>Fit to screen</MenuItem>
        </MenuContent>
      </Menu>
      <Tooltip content="Zoom in (Ctrl +)">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          disabled={!ready}
          onClick={() => canvas.zoomTo(Math.min(8, Math.round((zoom + STEP) * 100) / 100))}
          className="rounded-full"
        >
          <Plus />
        </Button>
      </Tooltip>
      <Tooltip content="Fit to screen (Ctrl 0)">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Fit to screen"
          disabled={!ready}
          onClick={() => canvas.fitToScreen()}
          className="rounded-full"
        >
          <Maximize />
        </Button>
      </Tooltip>
    </div>
  );
}
