import type { ComponentPropsWithRef } from 'react';

import { cn } from '../lib/cn';

export function Label({ className, ...props }: ComponentPropsWithRef<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'text-xs font-medium leading-none text-muted-foreground select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
