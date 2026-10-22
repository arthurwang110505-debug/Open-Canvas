import type { Fill, GradientFill } from '@opencanvas/document';
import { cn } from '@opencanvas/ui';

import { NumberField } from './fields';
import { GRADIENT_PRESETS, presetCss, presetFill, type GradientPreset } from './gradients';

function sameStops(a: readonly { color: string }[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((stop, index) => stop.color === b[index]);
}

function selectedPreset(fill: Fill | undefined): GradientPreset | undefined {
  if (!fill || (fill.type !== 'linear' && fill.type !== 'radial')) return undefined;
  return GRADIENT_PRESETS.find(
    (preset) => preset.type === fill.type && sameStops(fill.stops, preset.stops),
  );
}

/**
 * The gradient library. Picking a preset replaces the fill in one undo step; an angle field
 * appears only when the current fill is linear, because a radial gradient has nothing to turn.
 */
export function GradientPicker({
  value,
  onPick,
  className,
}: {
  value?: Fill;
  /** `mergeKey` coalesces repeated angle edits into a single undo step. */
  onPick: (fill: GradientFill, mergeKey?: string) => void;
  className?: string;
}) {
  const selected = selectedPreset(value);
  const current = value?.type === 'linear' ? value : undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Gradient presets">
        {GRADIENT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-label={`Gradient ${preset.label}`}
            aria-pressed={selected?.id === preset.id}
            title={preset.label}
            onClick={() => onPick(presetFill(preset))}
            style={{ backgroundImage: presetCss(preset) }}
            className={cn(
              'aspect-square rounded-full border border-black/10 transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected?.id === preset.id && 'ring-2 ring-primary ring-offset-1',
            )}
          />
        ))}
      </div>
      {current ? (
        <div className="flex items-end gap-2">
          <NumberField
            label="Angle"
            value={current.angle}
            min={0}
            max={360}
            unit="°"
            className="w-24"
            onCommit={(angle) => onPick({ ...current, angle }, 'gradient-angle')}
          />
          <p className="pb-1.5 text-[11px] text-muted-foreground">0° up · 90° right · 180° down</p>
        </div>
      ) : null}
    </div>
  );
}
