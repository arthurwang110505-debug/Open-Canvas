import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithRef } from 'react';

import { cn } from '../lib/cn';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-input bg-background hover:bg-muted',
        ghost: 'hover:bg-muted text-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm: 'h-8 px-3 text-[13px] [&_svg]:size-3.5',
        md: 'h-9 px-3.5 text-[13px] [&_svg]:size-4',
        lg: 'h-10 px-4 text-sm [&_svg]:size-4',
        icon: 'size-9 [&_svg]:size-4',
        'icon-sm': 'size-8 [&_svg]:size-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ComponentPropsWithRef<'button'>, VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a `<button>` (keeps styling, forwards props). */
  asChild?: boolean;
  /** Visually-pressed state for toggle-style buttons. */
  pressed?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  pressed,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      type={asChild ? undefined : (type ?? 'button')}
      data-slot="button"
      aria-pressed={pressed}
      className={cn(
        buttonVariants({ variant, size }),
        pressed && 'bg-secondary text-secondary-foreground',
        className,
      )}
      {...props}
    />
  );
}
