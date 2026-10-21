import { Button, Input, Label, Tooltip, cn } from '@opencanvas/ui';
import { Pipette } from 'lucide-react';
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal places shown and kept when committing. */
  precision?: number;
  unit?: string;
  disabled?: boolean;
  className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Numeric input that commits on Enter/blur and steps with the arrow keys (Shift = x10).
 * Typing never dispatches half-finished values such as "" or "-".
 */
export function NumberField({
  label,
  value,
  onCommit,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  precision = 2,
  unit,
  disabled,
  className,
}: NumberFieldProps) {
  const id = useId();
  const format = (n: number) => String(Number(n.toFixed(precision)));
  const [draft, setDraft] = useState(() => format(value));
  const [focused, setFocused] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  // Follow external changes (undo, canvas drags) unless the user is typing. `Object.is`
  // treats NaN as equal to itself, so a bad value can never cause a render loop.
  if (!Object.is(value, lastValue)) {
    setLastValue(value);
    if (!focused) setDraft(format(value));
  }

  const commit = (raw: string) => {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) {
      setDraft(format(value));
      return;
    }
    const next = Number(clamp(parsed, min, max).toFixed(precision));
    setDraft(format(next));
    if (next !== value) onCommit(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commit(event.currentTarget.value);
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      setDraft(format(value));
      event.currentTarget.blur();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const direction = event.key === 'ArrowUp' ? 1 : -1;
      const amount = step * (event.shiftKey ? 10 : 1);
      const base = Number.parseFloat(event.currentTarget.value);
      commit(String((Number.isFinite(base) ? base : value) + direction * amount));
    }
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            setFocused(false);
            commit(event.target.value);
          }}
          onKeyDown={onKeyDown}
          className={cn('tabular-nums', unit && 'pr-6')}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export interface ColorFieldProps {
  label: string;
  /** `#rrggbb` or `#rrggbbaa`. */
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const HEX_PATTERN = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Color input paired with an editable hex field; both commit validated hex colors only. */
export function ColorField({ label, value, onCommit, disabled, className }: ColorFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    if (!focused) setDraft(value);
  }

  const commitHex = (raw: string) => {
    const normalized = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`;
    if (HEX_PATTERN.test(normalized)) {
      setDraft(normalized.toLowerCase());
      if (normalized.toLowerCase() !== value.toLowerCase()) onCommit(normalized.toLowerCase());
    } else {
      setDraft(value);
    }
  };

  const canPick = typeof window !== 'undefined' && 'EyeDropper' in window;

  const pick = async () => {
    if (!canPick || disabled) return;
    try {
      // @ts-expect-error — EyeDropper is not in lib.dom yet in some TS versions
      const picker = new window.EyeDropper();
      const result: { sRGBHex: string } = await picker.open();
      if (result?.sRGBHex) onCommit(result.sRGBHex.toLowerCase());
    } catch {
      // user cancelled
    }
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value.slice(0, 7)}
          disabled={disabled}
          onChange={(event) => onCommit(event.target.value)}
          className="size-8 shrink-0 cursor-pointer rounded-md border border-input bg-background p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Input
          id={id}
          value={draft}
          disabled={disabled}
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            setFocused(false);
            commitHex(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setDraft(value);
              event.currentTarget.blur();
            }
          }}
          className="font-mono text-xs uppercase"
        />
        {canPick ? (
          <Tooltip content="Pick color from screen">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={`Pick ${label} from screen`}
              disabled={disabled}
              onClick={() => void pick()}
              className="shrink-0 rounded-full"
            >
              <Pipette />
            </Button>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-border px-3 py-3 last:border-b-0">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
