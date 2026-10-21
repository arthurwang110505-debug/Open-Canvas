import type { ComponentPropsWithRef } from 'react';

import { cn } from '../lib/cn';

export function Label({ className, ...props }: ComponentPropsWithRef<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'text-[12px] font-medium leading-none text-foreground/70 select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
