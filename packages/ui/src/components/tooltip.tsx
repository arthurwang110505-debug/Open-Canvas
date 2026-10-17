import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../lib/cn';

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: ComponentProps<typeof TooltipPrimitive.Content>['side'];
  /** Set when the trigger is disabled, so the tooltip still explains why. */
  open?: boolean;
}

/** Wraps an interactive element with an accessible tooltip (content is also exposed via aria). */
export function Tooltip({ content, children, side = 'bottom', open }: TooltipProps) {
  return (
    <TooltipPrimitive.Root open={open} delayDuration={300}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md select-none',
            'animate-in fade-in-0 zoom-in-95',
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-foreground" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
