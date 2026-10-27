import { CANVAS_PRESETS, LIMITS } from '@opencanvas/document';
import { Button, Input, Select } from '@opencanvas/ui';
import { ArrowLeftRight, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Modal } from './Modal';

export type DesignUnit = 'px' | 'in' | 'mm' | 'cm';

const UNITS: { id: DesignUnit; label: string; factor: number }[] = [
  { id: 'px', label: 'Pixels (px)', factor: 1 },
  { id: 'in', label: 'Inches (in)', factor: 300 },
  { id: 'mm', label: 'Millimeters (mm)', factor: 300 / 25.4 },
  { id: 'cm', label: 'Centimeters (cm)', factor: 300 / 2.54 },
];

function toPixels(value: number, unit: DesignUnit): number {
  const factor = UNITS.find((candidate) => candidate.id === unit)?.factor ?? 1;
  return Math.round(value * factor);
}

function fromPixels(value: number, unit: DesignUnit): string {
  const factor = UNITS.find((candidate) => candidate.id === unit)?.factor ?? 1;
  const converted = value / factor;
  return unit === 'px' ? String(Math.round(converted)) : String(Number(converted.toFixed(2)));
}

interface CreateDesignDialogProps {
  error: string | null;
  onClose: () => void;
  onCreate: (input: { name: string; width: number; height: number }) => Promise<boolean>;
}

export function CreateDesignDialog({ error, onClose, onCreate }: CreateDesignDialogProps) {
  const [name, setName] = useState('Untitled design');
  const [presetId, setPresetId] = useState(CANVAS_PRESETS[0]?.id ?? 'custom');
  const [unit, setUnit] = useState<DesignUnit>('px');
  const [width, setWidth] = useState(() => String(CANVAS_PRESETS[0]?.width ?? 1080));
  const [height, setHeight] = useState(() => String(CANVAS_PRESETS[0]?.height ?? 1080));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const changeUnit = (nextUnit: DesignUnit) => {
    const currentWidth = Number(width);
    const currentHeight = Number(height);
    if (Number.isFinite(currentWidth)) setWidth(fromPixels(toPixels(currentWidth, unit), nextUnit));
    if (Number.isFinite(currentHeight))
      setHeight(fromPixels(toPixels(currentHeight, unit), nextUnit));
    setUnit(nextUnit);
  };

  const selectPreset = (nextId: string) => {
    setPresetId(nextId);
    const preset = CANVAS_PRESETS.find((candidate) => candidate.id === nextId);
    if (preset) {
      setWidth(fromPixels(preset.width, unit));
      setHeight(fromPixels(preset.height, unit));
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError('Give your design a name to continue.');
      return;
    }
    const widthPx = toPixels(Number(width), unit);
    const heightPx = toPixels(Number(height), unit);
    if (
      !Number.isFinite(Number(width)) ||
      !Number.isFinite(Number(height)) ||
      widthPx < LIMITS.minCanvasDimension ||
      heightPx < LIMITS.minCanvasDimension ||
      widthPx > LIMITS.maxCanvasDimension ||
      heightPx > LIMITS.maxCanvasDimension
    ) {
      setValidationError(
        `Width and height must each convert to ${LIMITS.minCanvasDimension.toLocaleString()}–${LIMITS.maxCanvasDimension.toLocaleString()} pixels.`,
      );
      return;
    }
    setSubmitting(true);
    const created = await onCreate({ name: trimmedName, width: widthPx, height: heightPx });
    setSubmitting(false);
    if (created) onClose();
  };

  return (
    <Modal labelledBy="create-design-title" onClose={onClose} className="max-w-[620px]">
      <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            New canvas
          </p>
          <h2 id="create-design-title" className="mt-1 text-xl font-bold tracking-tight">
            Create a design
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a format or enter a custom size.
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close create design" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </header>

      <form onSubmit={(event) => void submit(event)} className="space-y-5 px-6 py-5">
        <label className="block space-y-1.5 text-sm font-medium">
          Design name
          <Input
            aria-label="Design name"
            maxLength={LIMITS.maxNameLength}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
        </label>

        <label className="block space-y-1.5 text-sm font-medium">
          Starting format
          <Select
            aria-label="Starting format"
            value={presetId}
            onChange={(event) => selectPreset(event.target.value)}
          >
            <option value="custom">Custom size</option>
            {CANVAS_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} · {preset.width} × {preset.height} px
              </option>
            ))}
          </Select>
        </label>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_180px] sm:items-end">
          <label className="block space-y-1.5 text-sm font-medium">
            Width
            <Input
              aria-label="Canvas width"
              type="number"
              min={unit === 'px' ? '1' : '0.01'}
              step={unit === 'px' ? '1' : '0.01'}
              value={width}
              onChange={(event) => {
                setPresetId('custom');
                setWidth(event.target.value);
              }}
            />
          </label>
          <ArrowLeftRight
            aria-hidden="true"
            className="mb-2 hidden size-4 text-muted-foreground sm:block"
          />
          <label className="block space-y-1.5 text-sm font-medium">
            Height
            <Input
              aria-label="Canvas height"
              type="number"
              min={unit === 'px' ? '1' : '0.01'}
              step={unit === 'px' ? '1' : '0.01'}
              value={height}
              onChange={(event) => {
                setPresetId('custom');
                setHeight(event.target.value);
              }}
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Units
            <Select
              aria-label="Design units"
              value={unit}
              onChange={(event) => changeUnit(event.target.value as DesignUnit)}
            >
              {UNITS.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Canvas dimensions are saved in pixels. Physical units use 300 px per inch, matching the
          print preset resolution.
        </p>

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
            onClick={onClose}
            disabled={submitting}
            className="rounded-full px-5"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="rounded-full px-5">
            <Plus className="size-4" />
            {submitting ? 'Creating…' : 'Create design'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
