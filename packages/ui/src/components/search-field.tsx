import type { ComponentPropsWithRef } from 'react';

import { cn } from '../lib/cn';
import { Input } from './input';

export interface SearchFieldProps extends ComponentPropsWithRef<'input'> {
  wrapperClassName?: string;
  /** Shows an accessible reset button while a controlled value is non-empty. */
  onClear?: () => void;
  clearLabel?: string;
}

/** Consistent search affordance with an optional keyboard-accessible clear action. */
export function SearchField({
  className,
  wrapperClassName,
  onClear,
  clearLabel = 'Clear search',
  value,
  ...props
}: SearchFieldProps) {
  const showClear = Boolean(onClear && typeof value === 'string' && value.length > 0);

  return (
    <div className={cn('relative', wrapperClassName)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <Input
        {...props}
        type="search"
        value={value}
        className={cn('pl-9', showClear ? 'pr-10' : 'pr-4', className)}
      />
      {showClear ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={(event) => {
            onClear?.();
            event.currentTarget.parentElement?.querySelector('input')?.focus();
          }}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="size-4"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
