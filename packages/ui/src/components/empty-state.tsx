import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Match the surrounding document hierarchy; defaults to an h2. */
  titleAs?: 'h2' | 'h3' | 'p';
  /** Split layouts place the action beside the copy on larger screens. */
  layout?: 'centered' | 'split';
  className?: string;
}

/** A consistent, actionable placeholder for empty collections and filtered results. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  titleAs: Title = 'h2',
  layout = 'centered',
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'rounded-2xl border border-dashed border-border bg-white px-5 py-8',
        layout === 'centered'
          ? 'flex flex-col items-center text-center'
          : 'flex flex-col items-center text-center sm:flex-row sm:text-left',
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary [&_svg]:size-5"
        >
          {icon}
        </span>
      ) : null}
      <div
        className={cn(
          'min-w-0 flex-1',
          icon && layout === 'centered' ? 'mt-4' : null,
          layout === 'split' ? (icon ? 'mt-3 sm:mt-0 sm:ml-4' : 'mt-3 sm:mt-0') : null,
        )}
      >
        <Title className="font-semibold text-foreground">{title}</Title>
        {description ? (
          <p
            className={cn(
              'mt-1 text-sm leading-relaxed text-muted-foreground',
              layout === 'centered' && 'max-w-md',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className={layout === 'split' ? 'mt-4 sm:mt-0' : 'mt-5'}>{action}</div> : null}
    </div>
  );
}
