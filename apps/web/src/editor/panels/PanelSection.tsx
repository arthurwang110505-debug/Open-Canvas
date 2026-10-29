import type { ReactNode } from 'react';

import { cn } from '@opencanvas/ui';

interface PanelSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Consistent section heading and helper copy for editor creation panels. */
export function PanelSection({
  title,
  description,
  action,
  children,
  className,
}: PanelSectionProps) {
  return (
    <section className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
